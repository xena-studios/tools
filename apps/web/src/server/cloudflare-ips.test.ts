import { describe, expect, it } from "vitest";
import { isCloudflareIp } from "./cloudflare-ips";

describe("Cloudflare's IP ranges", () => {
  it("knows its own", () => {
    for (const ip of [
      "172.65.197.160",
      "104.20.23.154",
      "162.159.1.1",
      "198.41.200.1",
      "2606:4700::1111",
      "2a06:98c1::1",
    ])
      expect([ip, isCloudflareIp(ip)]).toEqual([ip, true]);
  });
  it("passes everything else", () => {
    for (const ip of ["217.145.237.237", "8.8.8.8", "172.72.0.1", "2001:4860::8888", "nope"])
      expect([ip, isCloudflareIp(ip)]).toEqual([ip, false]);
  });
});
