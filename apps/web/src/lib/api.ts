// The JSON the Worker's API returns, shared by the server code and the pages.
// Every answer carries `checkedAt` (ms since the epoch): when it was fetched,
// so a cached answer can say how old it is.

import type { JavaStatus } from "@xena-tools/mc-protocol";

export type JavaError =
  /** The input isn't an address, or the port is out of range. */
  | "bad_request"
  /** A private, loopback or other non-public address, as typed or after DNS. */
  | "blocked_address"
  /** The name doesn't resolve. */
  | "dns_failed"
  /** No answer within the time limit. */
  | "timeout"
  /** Nothing accepted the connection. */
  | "refused"
  /** Something answered, but not with a Minecraft status. */
  | "bad_response"
  /**
   * The server is on Cloudflare's network (Spectrum), which Workers can't open
   * sockets to. The page checks it through mcstatus.io instead.
   */
  | "cloudflare_ip";

export interface JavaTarget {
  /** The SRV record followed, if any: _minecraft._tcp.<host>. */
  srv: { target: string; port: number } | null;
  /** The host the handshake named: the SRV target, or the host typed. */
  host: string;
  ip: string;
  port: number;
}

export type JavaResult =
  | {
      online: true;
      query: string;
      checkedAt: number;
      target: JavaTarget;
      /** Round trip of the ping, from Cloudflare's edge to the server, in ms. */
      latency: number | null;
      /** The Cloudflare data centre that ran the check (IATA code). */
      from: string | null;
      status: JavaStatus;
    }
  | {
      online: false;
      query: string;
      checkedAt: number;
      error: JavaError;
      message: string;
      target?: Partial<JavaTarget>;
      from?: string | null;
    };

export type PlayerError = "bad_request" | "not_found" | "rate_limited" | "upstream_error";

export interface Player {
  /** 32 hex digits, no dashes. */
  id: string;
  name: string;
  /** Null when the player uses a default skin. */
  skin: { hash: string; model: "classic" | "slim" } | null;
  cape: { hash: string } | null;
}

export type PlayerResult =
  | { ok: true; checkedAt: number; player: Player }
  | { ok: false; checkedAt: number; error: PlayerError; message: string };

/** A texture's id on textures.minecraft.net, which /api/skin/<hash> serves. */
export const TEXTURE_HASH = /^[0-9a-f]{32,128}$/;
