// Cloudflare's own IP ranges (cloudflare.com/ips). Workers can't open TCP
// sockets to them ("proxy request failed, cannot connect to the specified
// address"), and some big networks sit behind Cloudflare Spectrum, so a server
// on one of these is checked through mcstatus.io instead.

import { parseIPv4, parseIPv6 } from "@xena-tools/mc-protocol";

const V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];

const V6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

const u32 = (p: number[]) =>
  (((p[0] as number) << 24) |
    ((p[1] as number) << 16) |
    ((p[2] as number) << 8) |
    (p[3] as number)) >>>
  0;

const v4Ranges = V4.map((r) => {
  const [ip, bits] = r.split("/");
  const mask = (~0 << (32 - Number(bits))) >>> 0;
  return { base: (u32(parseIPv4(ip as string) as number[]) & mask) >>> 0, mask };
});

/** IPv6 prefixes here are all at most 32 bits: the first two groups. */
const v6Ranges = V6.map((r) => {
  const [ip, bits] = r.split("/");
  const g = parseIPv6(ip as string) as number[];
  const mask = (~0 << (32 - Number(bits))) >>> 0;
  return { base: (((((g[0] as number) << 16) | (g[1] as number)) >>> 0) & mask) >>> 0, mask };
});

export function isCloudflareIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) {
    const n = u32(v4);
    return v4Ranges.some((r) => (n & r.mask) >>> 0 === r.base);
  }
  const v6 = parseIPv6(ip);
  if (!v6) return false;
  const n = ((((v6[0] as number) << 16) | (v6[1] as number)) >>> 0) >>> 0;
  return v6Ranges.some((r) => (n & r.mask) >>> 0 === r.base);
}
