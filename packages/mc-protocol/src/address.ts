// Server addresses as people type them (host, host:port, an IPv4 or [IPv6]
// address), checked strictly, and the check for addresses that aren't on the
// public internet: a status checker must never be a way into a private network.

export type HostKind = "hostname" | "ipv4" | "ipv6";

export interface Address {
  /** Lower case, with no trailing dot; an IPv6 address without brackets. */
  host: string;
  kind: HostKind;
  /** Null when none was typed. */
  port: number | null;
}

export type AddressError =
  | "empty"
  | "bad_port"
  | "bad_host"
  /** localhost, .local and the other names that only mean something on a private network. */
  | "private_name"
  /** A private, loopback, link-local or otherwise non-public IP. */
  | "private_ip";

export type AddressResult = { ok: true; address: Address } | { ok: false; error: AddressError };

export const JAVA_PORT = 25565;
export const BEDROCK_PORT = 19132;

// Suffixes that never resolve on the public internet (RFC 6761, 6762, 8375 and
// common private ones). Rejected as typed, before any DNS lookup.
const PRIVATE_SUFFIXES = [
  "localhost",
  "local",
  "internal",
  "intranet",
  "lan",
  "home",
  "corp",
  "private",
  "home.arpa",
  "test",
  "invalid",
  "example",
  "onion",
  "in-addr.arpa",
  "ip6.arpa",
];

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

export function isValidHostname(host: string): boolean {
  if (host.length === 0 || host.length > 253) return false;
  const labels = host.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => LABEL.test(l))) return false;
  // An all-numeric last label is an IP in disguise ("127.1"), not a name.
  return !/^[0-9]+$/.test(labels[labels.length - 1] as string);
}

export function isPrivateName(host: string): boolean {
  return PRIVATE_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`));
}

// IPv4

export function parseIPv4(s: string): number[] | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const p of parts) {
    // Decimal only, no leading zeros: "010" is octal to some resolvers.
    if (!/^(0|[1-9][0-9]{0,2})$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out.push(n);
  }
  return out;
}

function inV4(ip: number[], base: [number, number, number, number], bits: number): boolean {
  const a =
    ((ip[0] as number) << 24) |
    ((ip[1] as number) << 16) |
    ((ip[2] as number) << 8) |
    (ip[3] as number);
  const b = (base[0] << 24) | (base[1] << 16) | (base[2] << 8) | base[3];
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) | 0;
  return (a & mask) === (b & mask);
}

const V4_BLOCKED: [[number, number, number, number], number][] = [
  [[0, 0, 0, 0], 8], // "this network"
  [[10, 0, 0, 0], 8], // private
  [[100, 64, 0, 0], 10], // carrier-grade NAT
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local
  [[172, 16, 0, 0], 12], // private
  [[192, 0, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2, 0], 24], // documentation
  [[192, 88, 99, 0], 24], // 6to4 relay
  [[192, 168, 0, 0], 16], // private
  [[198, 18, 0, 0], 15], // benchmarking
  [[198, 51, 100, 0], 24], // documentation
  [[203, 0, 113, 0], 24], // documentation
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4], // reserved, and broadcast
];

export function isPublicIPv4(ip: number[]): boolean {
  return !V4_BLOCKED.some(([base, bits]) => inV4(ip, base, bits));
}

// IPv6

/** Eight 16-bit groups, or null. Accepts :: and a dotted IPv4 tail. */
export function parseIPv6(input: string): number[] | null {
  let s = input;
  if (s.includes("%")) return null; // zone ids are link-local by definition
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(":");
  if (lastColon < 0) return null;
  if (s.slice(lastColon + 1).includes(".")) {
    const v4 = parseIPv4(s.slice(lastColon + 1));
    if (!v4) return null;
    tail = [
      ((v4[0] as number) << 8) | (v4[1] as number),
      ((v4[2] as number) << 8) | (v4[3] as number),
    ];
    // Keep a "::" right before the IPv4 part; drop a single separating ":".
    s = s.slice(0, lastColon + 1);
    if (!s.endsWith("::")) s = s.slice(0, -1);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const group = (g: string) => (/^[0-9a-f]{1,4}$/i.test(g) ? Number.parseInt(g, 16) : Number.NaN);
  const left = halves[0] ? (halves[0] as string).split(":").map(group) : [];
  const right = halves.length === 2 && halves[1] ? (halves[1] as string).split(":").map(group) : [];
  if ([...left, ...right].some(Number.isNaN)) return null;
  const total = left.length + right.length + tail.length;
  if (halves.length === 2) {
    if (total > 7) return null;
    return [...left, ...Array(8 - total).fill(0), ...right, ...tail];
  }
  return total === 8 ? [...left, ...tail] : null;
}

export function isPublicIPv6(g: number[]): boolean {
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = g;
  const embedded = [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff];
  // ::ffff:a.b.c.d (IPv4-mapped) and 64:ff9b::a.b.c.d (NAT64): judge the IPv4 inside.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff)
    return isPublicIPv4(embedded);
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0)
    return isPublicIPv4(embedded);
  // Only global unicast (2000::/3) is public...
  if (g0 < 0x2000 || g0 > 0x3fff) return false;
  // ...less what's carved out of it.
  if (g0 === 0x2001 && g1 < 0x0200) return false; // IETF protocol assignments, Teredo
  if (g0 === 0x2001 && g1 === 0x0db8) return false; // documentation
  if (g0 === 0x2002) return false; // 6to4, which can wrap any IPv4
  if (g0 === 0x3fff && g1 < 0x1000) return false; // documentation (RFC 9637)
  return true;
}

/** True for an IP literal on the public internet. False for anything else, names included. */
export function isPublicIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) return isPublicIPv4(v4);
  const v6 = parseIPv6(ip);
  return v6 ? isPublicIPv6(v6) : false;
}

function parsePort(s: string): number | null {
  if (!/^[0-9]{1,5}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= 65535 ? n : null;
}

/**
 * Reads what someone typed: "play.example.com", "play.example.com:25566",
 * "203.0.113.5:25565", "[2001:db8::1]:25565" or a bare IPv6 address. Rejects
 * private names and IPs as typed; names are checked again after DNS.
 */
export function parseAddress(input: string): AddressResult {
  const s = input.trim().toLowerCase();
  if (!s) return { ok: false, error: "empty" };
  if (s.length > 270 || /[/\\@?#\s]/.test(s)) return { ok: false, error: "bad_host" };

  let host: string;
  let portText: string | null = null;
  if (s.startsWith("[")) {
    const end = s.indexOf("]");
    if (end < 0) return { ok: false, error: "bad_host" };
    host = s.slice(1, end);
    const rest = s.slice(end + 1);
    if (rest) {
      if (!rest.startsWith(":")) return { ok: false, error: "bad_host" };
      portText = rest.slice(1);
    }
  } else if ((s.match(/:/g) ?? []).length > 1) {
    host = s; // a bare IPv6 address: no port possible
  } else {
    const colon = s.indexOf(":");
    host = colon < 0 ? s : s.slice(0, colon);
    if (colon >= 0) portText = s.slice(colon + 1);
  }
  host = host.replace(/\.$/, "");

  let port: number | null = null;
  if (portText !== null) {
    port = parsePort(portText);
    if (port === null) return { ok: false, error: "bad_port" };
  }

  const v4 = parseIPv4(host);
  if (v4) {
    return isPublicIPv4(v4)
      ? { ok: true, address: { host, kind: "ipv4", port } }
      : { ok: false, error: "private_ip" };
  }
  if (host.includes(":")) {
    const v6 = parseIPv6(host);
    if (!v6) return { ok: false, error: "bad_host" };
    return isPublicIPv6(v6)
      ? { ok: true, address: { host, kind: "ipv6", port } }
      : { ok: false, error: "private_ip" };
  }
  if (isPrivateName(host) || !host.includes(".")) {
    // "localhost" and single-label names (a machine on the LAN) included.
    return /^[a-z0-9-]{1,63}$/.test(host) || isPrivateName(host)
      ? { ok: false, error: "private_name" }
      : { ok: false, error: "bad_host" };
  }
  if (!isValidHostname(host)) return { ok: false, error: "bad_host" };
  return { ok: true, address: { host, kind: "hostname", port } };
}

/** The address as it would be typed back: brackets round IPv6, the port if there is one. */
export function formatAddress(host: string, port: number | null): string {
  const h = host.includes(":") ? `[${host}]` : host;
  return port === null ? h : `${h}:${port}`;
}
