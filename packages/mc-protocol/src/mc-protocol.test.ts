import { describe, expect, it } from "vitest";
import {
  concat,
  dashUuid,
  decodeString,
  decodeVarInt,
  encodeString,
  encodeVarInt,
  FrameReader,
  formatAddress,
  framePacket,
  handshakePacket,
  isLookupName,
  isPublicIp,
  isValidUsername,
  md5Hex,
  offlineUuid,
  ProtocolError,
  parseAddress,
  parseIPv6,
  parseStatus,
  parseUuid,
  pingPacket,
  readPong,
  readStatusResponse,
  StatusParseError,
  statusRequestPacket,
  undashUuid,
  uuidIntArray,
  uuidVersion,
} from "./index.ts";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join(" ");
const bytes = (s: string) => Uint8Array.from(s.split(" ").map((x) => Number.parseInt(x, 16)));

describe("VarInt", () => {
  // The protocol's own examples.
  const cases: [number, string][] = [
    [0, "00"],
    [1, "01"],
    [2, "02"],
    [127, "7f"],
    [128, "80 01"],
    [255, "ff 01"],
    [25565, "dd c7 01"],
    [2097151, "ff ff 7f"],
    [2147483647, "ff ff ff ff 07"],
    [-1, "ff ff ff ff 0f"],
    [-2147483648, "80 80 80 80 08"],
  ];
  it.each(cases)("encodes %i", (n, h) => expect(hex(encodeVarInt(n))).toBe(h));
  it.each(cases)("decodes %i", (n, h) => {
    const b = bytes(h);
    expect(decodeVarInt(b)).toEqual({ value: n, size: b.length });
  });
  it("decodes at an offset and waits for more bytes", () => {
    expect(decodeVarInt(bytes("aa dd c7 01"), 1)).toEqual({ value: 25565, size: 3 });
    expect(decodeVarInt(bytes("dd c7"))).toBeNull();
    expect(decodeVarInt(new Uint8Array())).toBeNull();
  });
  it("rejects a VarInt over five bytes, and values that don't fit", () => {
    expect(() => decodeVarInt(bytes("ff ff ff ff ff 01"))).toThrow(RangeError);
    expect(() => encodeVarInt(2 ** 31)).toThrow(RangeError);
    expect(() => encodeVarInt(1.5)).toThrow(RangeError);
  });
});

describe("Server List Ping packets", () => {
  it("frames a handshake byte for byte", () => {
    // length 19, id 0, protocol -1, "localhost", port 25565 (big endian), next state 1
    const p = handshakePacket({ host: "localhost", port: 25565 });
    expect(hex(p)).toBe("13 00 ff ff ff ff 0f 09 6c 6f 63 61 6c 68 6f 73 74 63 dd 01");
    expect(p[0]).toBe(p.length - 1);
  });
  it("writes a handshake with a set protocol", () => {
    const p = handshakePacket({ host: "a.b", port: 19132, protocol: 767 });
    expect(hex(p)).toBe("0a 00 ff 05 03 61 2e 62 4a bc 01");
  });
  it("writes the status request and a ping", () => {
    expect(hex(statusRequestPacket())).toBe("01 00");
    expect(hex(pingPacket(0x0102030405060708n))).toBe("09 01 01 02 03 04 05 06 07 08");
  });
  it("writes UTF-8 strings with their byte length", () => {
    expect(hex(encodeString("é"))).toBe("02 c3 a9");
    expect(decodeString(bytes("02 c3 a9"))).toEqual({ value: "é", size: 3 });
    expect(() => decodeString(bytes("05 61"))).toThrow(ProtocolError);
  });
  it("rejects a port out of range", () => {
    expect(() => handshakePacket({ host: "a.b", port: 70000 })).toThrow(RangeError);
  });

  it("reads a status response split across chunks", () => {
    const json = JSON.stringify({ version: { name: "Paper 1.21.4", protocol: 769 } });
    const packet = framePacket(0x00, encodeString(json));
    const r = new FrameReader();
    r.push(packet.subarray(0, 1));
    expect(r.next()).toBeNull();
    r.push(packet.subarray(1, 10));
    expect(r.next()).toBeNull();
    r.push(concat([packet.subarray(10), pingPong(42n)]));
    const frame = r.next();
    expect(frame && readStatusResponse(frame)).toBe(json);
    const pong = r.next();
    expect(pong && readPong(pong)).toBe(42n);
    expect(r.next()).toBeNull();
  });
  it("reads a large response (a 2-byte length)", () => {
    const json = JSON.stringify({ description: "x".repeat(5000) });
    const r = new FrameReader();
    r.push(framePacket(0x00, encodeString(json)));
    const frame = r.next();
    expect(frame && readStatusResponse(frame).length).toBe(json.length);
  });
  it("caps the packet size", () => {
    const r = new FrameReader(1024);
    r.push(bytes("80 80 04")); // claims 65536 bytes
    expect(() => r.next()).toThrow(ProtocolError);
    expect(() => new FrameReader(16).push(new Uint8Array(64))).toThrow(ProtocolError);
  });
  it("rejects the wrong packet", () => {
    expect(() => readStatusResponse({ id: 1, body: new Uint8Array() })).toThrow(ProtocolError);
    expect(() => readPong({ id: 1, body: new Uint8Array(4) })).toThrow(ProtocolError);
    const r = new FrameReader();
    r.push(bytes("00"));
    expect(() => r.next()).toThrow(ProtocolError);
  });
});

function pingPong(n: bigint) {
  return pingPacket(n); // a pong is the same packet the other way
}

describe("status JSON", () => {
  it("reads a vanilla response", () => {
    const s = parseStatus(
      JSON.stringify({
        version: { name: "1.21.4", protocol: 769 },
        players: {
          max: 20,
          online: 2,
          sample: [
            { name: "Notch", id: "069a79f4-44e9-4726-a5be-fca90e38aaf5" },
            { name: 7 },
            "junk",
          ],
        },
        description: { text: "A Minecraft Server", color: "gray" },
        favicon: "data:image/png;base64,iVBORw0KGgo=",
        enforcesSecureChat: true,
      }),
    );
    expect(s.version).toEqual({ name: "1.21.4", protocol: 769 });
    expect(s.players.online).toBe(2);
    expect(s.players.max).toBe(20);
    expect(s.players.sample).toEqual([
      { name: "Notch", id: "069a79f4-44e9-4726-a5be-fca90e38aaf5" },
      { name: "7", id: "" },
    ]);
    expect(s.description).toEqual({ text: "A Minecraft Server", color: "gray" });
    expect(s.favicon).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(s.enforcesSecureChat).toBe(true);
    expect(s.previewsChat).toBeNull();
    expect(s.mods).toBeNull();
  });
  it("reads a string description, and survives missing fields", () => {
    const s = parseStatus('{"description":"§aHello"}');
    expect(s.description).toBe("§aHello");
    expect(s.version).toEqual({ name: "", protocol: null });
    expect(s.players).toEqual({ online: null, max: null, sample: [] });
    expect(s.favicon).toBeNull();
    expect(parseStatus('{"description":null}').description).toBe("");
    expect(parseStatus('{"players":{"online":"9"}}').players.online).toBeNull();
  });
  it("drops a favicon that isn't a PNG data URI, and strips line breaks from one that is", () => {
    expect(parseStatus('{"favicon":"https://example.com/x.png"}').favicon).toBeNull();
    expect(parseStatus('{"favicon":"data:image/svg+xml;base64,PHN2Zz4="}').favicon).toBeNull();
    expect(parseStatus('{"favicon":"data:image/png;base64,iVBO\\nRw0="}').favicon).toBe(
      "data:image/png;base64,iVBORw0=",
    );
  });
  it("reads old Forge's modinfo", () => {
    const s = parseStatus(
      JSON.stringify({
        modinfo: {
          type: "FML",
          modList: [
            { modid: "mcp", version: "9.42" },
            { modid: "jei", version: "4.16" },
          ],
        },
      }),
    );
    expect(s.mods).toEqual({
      loader: "forge",
      mods: [
        { id: "mcp", version: "9.42" },
        { id: "jei", version: "4.16" },
      ],
      truncated: false,
    });
  });
  it("reads forgeData", () => {
    const s = parseStatus(
      JSON.stringify({
        forgeData: {
          channels: [],
          mods: [{ modId: "forge", modmarker: "47.2.0" }, { modId: "create" }, {}],
          fmlNetworkVersion: 3,
          truncated: true,
        },
        isModded: true,
      }),
    );
    expect(s.mods).toEqual({
      loader: "forge",
      mods: [{ id: "forge", version: "47.2.0" }, { id: "create" }],
      truncated: true,
    });
    expect(s.modded).toBe(true);
  });
  it("rejects what isn't a status", () => {
    expect(() => parseStatus("not json")).toThrow(StatusParseError);
    expect(() => parseStatus("[1,2]")).toThrow(StatusParseError);
  });
});

describe("MD5", () => {
  // RFC 1321's test suite, and a couple more.
  it.each([
    ["", "d41d8cd98f00b204e9800998ecf8427e"],
    ["a", "0cc175b9c0f1b6a831c399e269772661"],
    ["abc", "900150983cd24fb0d6963f7d28e17f72"],
    ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
    ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
    [
      "12345678901234567890123456789012345678901234567890123456789012345678901234567890",
      "57edf4a22be3c955ac49da2e2107b67a",
    ],
    ["The quick brown fox jumps over the lazy dog", "9e107d9d372bb6826bd81d3542a419d6"],
    ["a".repeat(64), "014842d480b571495a4a0363793f7367"],
    ["é€", "d75285edbed0b771f00bbaefc623c709"],
  ])("md5(%j)", (input, expected) => expect(md5Hex(input)).toBe(expected));
});

describe("UUIDs", () => {
  it("computes offline-mode UUIDs as the server does", () => {
    expect(offlineUuid("Notch")).toBe("b50ad385-829d-3141-a216-7e7d7539ba7f");
    expect(offlineUuid("jeb_")).toBe("a762f560-4fce-3236-812a-b80efff0b62b");
    expect(offlineUuid("notch")).toBe("42653081-a90e-3475-b3d6-3550cdb43f8e");
    expect(offlineUuid("Steve")).toBe("5627dd98-e6be-3c21-b8a8-e92344183641");
    expect(uuidVersion(offlineUuid("Notch"))).toBe(3);
  });
  it("reads and writes both forms", () => {
    expect(parseUuid("069a79f444e94726a5befca90e38aaf5")).toBe("069a79f444e94726a5befca90e38aaf5");
    expect(parseUuid(" 069A79F4-44E9-4726-A5BE-FCA90E38AAF5 ")).toBe(
      "069a79f444e94726a5befca90e38aaf5",
    );
    expect(dashUuid("069a79f444e94726a5befca90e38aaf5")).toBe(
      "069a79f4-44e9-4726-a5be-fca90e38aaf5",
    );
    expect(undashUuid("069a79f4-44e9-4726-a5be-fca90e38aaf5")).toBe(
      "069a79f444e94726a5befca90e38aaf5",
    );
    expect(uuidVersion("069a79f444e94726a5befca90e38aaf5")).toBe(4);
  });
  it("rejects what isn't a UUID", () => {
    for (const bad of [
      "",
      "Notch",
      "069a79f444e94726a5befca90e38aaf",
      "069a79f4-44e94726-a5be-fca90e38aaf5",
      "g69a79f444e94726a5befca90e38aaf5",
    ])
      expect(parseUuid(bad)).toBeNull();
    expect(() => dashUuid("nope")).toThrow(TypeError);
  });
  it("writes the int-array form", () => {
    expect(uuidIntArray("069a79f4-44e9-4726-a5be-fca90e38aaf5")).toEqual([
      110787060, 1156138790, -1514210135, 238594805,
    ]);
  });
});

describe("usernames", () => {
  it("accepts real names and rejects the rest", () => {
    for (const ok of ["Notch", "jeb_", "abc", "A_B_C_1234567890"])
      expect(isValidUsername(ok)).toBe(true);
    for (const bad of ["", "ab", "has space", "seventeen_chars_x", "dash-name", "é"])
      expect(isValidUsername(bad)).toBe(false);
    expect(isLookupName("x")).toBe(true);
    expect(isLookupName("x y")).toBe(false);
  });
});

describe("addresses", () => {
  const ok = (input: string) => {
    const r = parseAddress(input);
    if (!r.ok) throw new Error(`${input}: ${r.error}`);
    return r.address;
  };
  const err = (input: string) => {
    const r = parseAddress(input);
    return r.ok ? "ok" : r.error;
  };

  it("reads hosts, ports and IPs", () => {
    expect(ok("mc.hypixel.net")).toEqual({ host: "mc.hypixel.net", kind: "hostname", port: null });
    expect(ok(" Play.Example.COM:25566 ")).toEqual({
      host: "play.example.com",
      kind: "hostname",
      port: 25566,
    });
    expect(ok("play.example.com.")).toMatchObject({ host: "play.example.com" });
    expect(ok("8.8.8.8:25565")).toEqual({ host: "8.8.8.8", kind: "ipv4", port: 25565 });
    expect(ok("[2606:4700::1111]:19132")).toEqual({
      host: "2606:4700::1111",
      kind: "ipv6",
      port: 19132,
    });
    expect(ok("2606:4700::1111")).toEqual({ host: "2606:4700::1111", kind: "ipv6", port: null });
  });
  it("rejects bad ports and hosts", () => {
    expect(err("")).toBe("empty");
    expect(err("a.com:0")).toBe("bad_port");
    expect(err("a.com:65536")).toBe("bad_port");
    expect(err("a.com:12ab")).toBe("bad_port");
    expect(err("a.com:")).toBe("bad_port");
    expect(err("-a.com")).toBe("bad_host");
    expect(err("a_b.com")).toBe("bad_host");
    expect(err("a..com")).toBe("bad_host");
    expect(err("http://a.com")).toBe("bad_host");
    expect(err("127.1")).toBe("bad_host");
    expect(err("[::1")).toBe("bad_host");
    expect(err(`${"a".repeat(64)}.com`)).toBe("bad_host");
  });
  it("blocks private names", () => {
    for (const s of [
      "localhost",
      "LOCALHOST:25565",
      "server.localhost",
      "nas.local",
      "mc.internal",
      "box",
      "router.home.arpa",
    ])
      expect(err(s)).toBe("private_name");
  });
  it("blocks private, loopback, link-local and reserved IPs", () => {
    for (const s of [
      "127.0.0.1",
      "127.8.9.10:25565",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.20",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "192.0.2.1",
      "[::1]:25565",
      "::",
      "fe80::1",
      "fc00::1",
      "fd12:3456::1",
      "ff02::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "64:ff9b::10.0.0.1",
      "2001:db8::1",
      "2002:c0a8:0101::1",
    ])
      expect([s, err(s)]).toEqual([s, "private_ip"]);
  });
  it("allows public IPs", () => {
    for (const ip of [
      "8.8.8.8",
      "1.1.1.1",
      "172.32.0.1",
      "100.128.0.1",
      "2606:4700::1111",
      "::ffff:8.8.8.8",
      "64:ff9b::8.8.8.8",
    ])
      expect([ip, isPublicIp(ip)]).toEqual([ip, true]);
    expect(isPublicIp("mc.hypixel.net")).toBe(false);
    expect(isPublicIp("010.0.0.1")).toBe(false);
  });
  it("parses IPv6 forms", () => {
    expect(parseIPv6("::")).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(parseIPv6("::1.2.3.4")).toEqual([0, 0, 0, 0, 0, 0, 0x0102, 0x0304]);
    expect(parseIPv6("1:2:3:4:5:6:7:8")).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(parseIPv6("1:2:3:4:5:6:7")).toBeNull();
    expect(parseIPv6("1::2::3")).toBeNull();
    expect(parseIPv6("fe80::1%eth0")).toBeNull();
  });
  it("formats an address", () => {
    expect(formatAddress("a.com", null)).toBe("a.com");
    expect(formatAddress("a.com", 25566)).toBe("a.com:25566");
    expect(formatAddress("2606:4700::1111", 19132)).toBe("[2606:4700::1111]:19132");
  });
});
