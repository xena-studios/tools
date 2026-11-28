// Java Edition status: SRV, then DNS, then a Server List Ping over a TCP
// socket (connect() from cloudflare:sockets). Every address is checked before
// anything connects to it, and the socket connects to the checked IP itself,
// so a name can't resolve to something else between the check and the connect.

import { connect } from "cloudflare:sockets";
import {
  concat,
  FrameReader,
  handshakePacket,
  isPublicIp,
  JAVA_PORT,
  parseAddress,
  parseStatus,
  pingPacket,
  readPong,
  readStatusResponse,
  StatusParseError,
  statusRequestPacket,
} from "@xena-tools/mc-protocol";
import type { JavaError, JavaResult, JavaTarget } from "../lib/api";
import { isCloudflareIp } from "./cloudflare-ips";
import { DnsError, lookupSrv, resolveIps } from "./dns";

/** Seconds a status is cached for, online or not. */
export const STATUS_TTL = 60;
/** The whole check, from connect to status. */
const TIMEOUT_MS = 5000;
/** The ping after the status gets what's left, up to this. */
const PONG_MS = 1500;
/** A status with a big icon and a long mod list is well under this. */
export const MAX_RESPONSE_BYTES = 256 * 1024;

class PingError extends Error {
  constructor(
    readonly code: JavaError,
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES: Record<JavaError, string> = {
  bad_request: "That isn't a server address.",
  blocked_address: "That address isn't on the public internet, so it can't be checked from here.",
  dns_failed: "That name doesn't point anywhere: there's no DNS record for it.",
  timeout: "The server didn't answer within 5 seconds.",
  refused: "Nothing accepted the connection on that port.",
  bad_response: "Something answered, but not with a Minecraft server status.",
  cloudflare_ip:
    "That server is on Cloudflare's network, which our checker can't open connections to.",
};

function sleep(ms: number, code: JavaError, message: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new PingError(code, message)), ms));
}

async function nextFrame(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  frames: FrameReader,
  what: string,
) {
  for (;;) {
    const frame = frames.next();
    if (frame) return frame;
    const { value, done } = await reader.read();
    if (done)
      throw new PingError("bad_response", `The server closed the connection before ${what}.`);
    frames.push(value);
  }
}

interface Ping {
  raw: string;
  latency: number | null;
}

async function ping(ip: string, port: number, host: string): Promise<Ping> {
  const started = Date.now();
  const socket = connect({ hostname: ip, port }, { allowHalfOpen: false });
  const deadline = sleep(TIMEOUT_MS, "timeout", MESSAGES.timeout);
  deadline.catch(() => {});
  try {
    const status = (async () => {
      try {
        await socket.opened;
      } catch (e) {
        const text = e instanceof Error ? e.message : String(e);
        // A Cloudflare range missing from our list fails here, with this wording.
        if (/cannot connect to the specified address/i.test(text))
          throw new PingError("cloudflare_ip", MESSAGES.cloudflare_ip);
        throw new PingError("refused", MESSAGES.refused);
      }
      const writer = socket.writable.getWriter();
      const reader = socket.readable.getReader();
      const frames = new FrameReader(MAX_RESPONSE_BYTES);
      const sent = Date.now();
      await writer.write(concat([handshakePacket({ host, port }), statusRequestPacket()]));
      let raw: string;
      try {
        raw = readStatusResponse(await nextFrame(reader, frames, "sending its status"));
      } catch (e) {
        if (e instanceof PingError) throw e;
        throw new PingError("bad_response", MESSAGES.bad_response);
      }
      const statusRtt = Date.now() - sent;
      return { raw, writer, reader, frames, statusRtt };
    })();
    const got = await Promise.race([status, deadline]);

    // The ping is a bonus: without a pong, the status still stands.
    let latency: number | null = null;
    const left = Math.min(PONG_MS, TIMEOUT_MS - (Date.now() - started));
    if (left > 100) {
      try {
        const payload = BigInt(Date.now());
        const sent = Date.now();
        await got.writer.write(pingPacket(payload));
        const pong = await Promise.race([
          nextFrame(got.reader, got.frames, "the pong"),
          sleep(left, "timeout", "No pong"),
        ]);
        if (readPong(pong) === payload) latency = Date.now() - sent;
      } catch {
        // Some servers and proxies never answer the ping.
      }
    }
    return { raw: got.raw, latency: latency ?? got.statusRtt };
  } catch (e) {
    if (e instanceof PingError) throw e;
    throw new PingError("bad_response", MESSAGES.bad_response);
  } finally {
    socket.close().catch(() => {});
  }
}

const fail = (
  query: string,
  error: JavaError,
  message = MESSAGES[error],
  target?: Partial<JavaTarget>,
  from?: string | null,
): JavaResult => ({ online: false, query, checkedAt: Date.now(), error, message, target, from });

/** The whole check for what someone typed. Never throws. */
export async function checkJava(input: string, from: string | null): Promise<JavaResult> {
  const parsed = parseAddress(input);
  if (!parsed.ok) {
    return parsed.error === "private_ip" || parsed.error === "private_name"
      ? fail(input, "blocked_address")
      : fail(input, "bad_request");
  }
  const { host, kind, port: typedPort } = parsed.address;

  let srv: JavaTarget["srv"] = null;
  let handshakeHost = host;
  let port = typedPort ?? JAVA_PORT;
  let ip = host;

  if (kind === "hostname") {
    try {
      // Like the game, SRV is only followed when no port was typed.
      if (typedPort === null) {
        srv = await lookupSrv(host);
        if (srv) {
          const again = parseAddress(srv.target);
          if (!again.ok || again.address.kind !== "hostname")
            return fail(
              input,
              again.ok || again.error === "bad_host" ? "dns_failed" : "blocked_address",
              undefined,
              { srv },
            );
          handshakeHost = srv.target;
          port = srv.port;
        }
      }
      const ips = await resolveIps(handshakeHost);
      if (ips.length === 0)
        return fail(
          input,
          "dns_failed",
          srv
            ? `The SRV record points to ${srv.target}, which doesn't resolve.`
            : MESSAGES.dns_failed,
          { srv },
        );
      // If any record is private, refuse: no picking the public one and hoping.
      if (!ips.every(isPublicIp))
        return fail(
          input,
          "blocked_address",
          "That name points to a private or reserved IP, so it can't be checked from here.",
          { srv, host: handshakeHost },
        );
      ip = ips[0] as string;
    } catch (e) {
      return fail(
        input,
        "dns_failed",
        e instanceof DnsError ? `${e.message}. Try again in a moment.` : MESSAGES.dns_failed,
        { srv },
      );
    }
  }

  const target: JavaTarget = { srv, host: handshakeHost, ip, port };
  if (isCloudflareIp(ip)) return fail(input, "cloudflare_ip", undefined, target, from);
  try {
    const { raw, latency } = await ping(ip, port, handshakeHost);
    let status: ReturnType<typeof parseStatus>;
    try {
      status = parseStatus(raw);
    } catch (e) {
      if (e instanceof StatusParseError)
        return fail(input, "bad_response", undefined, target, from);
      throw e;
    }
    return { online: true, query: input, checkedAt: Date.now(), target, latency, from, status };
  } catch (e) {
    if (e instanceof PingError) return fail(input, e.code, e.message, target, from);
    return fail(input, "bad_response", undefined, target, from);
  }
}
