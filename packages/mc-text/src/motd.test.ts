import { describe, expect, it } from "vitest";
import {
  escapeProperties,
  hoconString,
  MOTD_TARGETS,
  motdSpans,
  parse,
  parseLegacy,
  textWidth,
  tomlString,
  writeMotd,
  yamlString,
} from "./index.ts";

const line1 = parse("&#5CB4FF&lXena &8| &7Survival");
const line2 = parse("<green>Join us</green> on 1.21");

describe("motd escaping", () => {
  it("escapes Java properties values", () => {
    expect(escapeProperties("§aHi\nthere")).toBe("\\u00A7aHi\\nthere");
    expect(escapeProperties("a\\b")).toBe("a\\\\b");
    expect(escapeProperties("  lead")).toBe("\\  lead");
    expect(escapeProperties("é ♥")).toBe("\\u00E9 \\u2665");
    expect(escapeProperties("a=b:c#d")).toBe("a=b:c#d");
  });
  it("escapes emoji as two UTF-16 units, as Java reads them", () => {
    expect(escapeProperties("😀")).toBe("\\uD83D\\uDE00");
  });
  it("writes TOML basic strings", () => {
    expect(tomlString('say "hi"\\')).toBe('"say \\"hi\\"\\\\"');
    expect(tomlString("a\nb\u0001")).toBe('"a\\nb\\u0001"');
    expect(tomlString("♥")).toBe('"♥"');
  });
  it("single-quotes YAML when it can, and double-quotes line breaks", () => {
    expect(yamlString("&aIt's")).toBe("'&aIt''s'");
    expect(yamlString('&aOne\n&b"Two"')).toBe('"&aOne\\n&b\\"Two\\""');
  });
  it("writes HOCON strings as JSON", () => {
    expect(hoconString('<red>"x"')).toBe('"<red>\\"x\\""');
  });
});

describe("writeMotd", () => {
  it("joins two lines and leaves an empty second line off", () => {
    expect(
      motdSpans(parseLegacy("a"), parseLegacy("b"))
        .map((s) => s.text)
        .join(""),
    ).toBe("a\nb");
    expect(motdSpans(parseLegacy("a"), [])).toHaveLength(1);
  });

  it("writes server.properties with § escaped and hex as §x", () => {
    expect(writeMotd(line1, line2, "server-properties")).toBe(
      "motd=\\u00A7x\\u00A75\\u00A7C\\u00A7B\\u00A74\\u00A7F\\u00A7F\\u00A7lXena \\u00A78| \\u00A77Survival\\n\\u00A7aJoin us\\u00A7r on 1.21",
    );
  });

  it("writes server.properties with the 16 colours only, for vanilla", () => {
    const out = writeMotd(parse("&#FF4444Hi"), [], "server-properties", { hex: false });
    expect(out).toBe("motd=\\u00A7cHi");
  });

  it("writes velocity.toml as MiniMessage in a TOML string", () => {
    expect(writeMotd(parse("<#09add3>A Velocity Server"), [], "velocity")).toBe(
      'motd = "<#09ADD3>A Velocity Server"',
    );
    expect(writeMotd(parse("&aOne"), parse("&btwo"), "velocity")).toBe(
      'motd = "<green>One<newline><aqua>two"',
    );
  });

  it("escapes MiniMessage's backslash again for TOML", () => {
    expect(writeMotd(parse("<red>a \\<b>"), [], "velocity")).toBe('motd = "<red>a \\\\<b>"');
  });

  it("writes BungeeCord's config.yml with & codes and &x hex", () => {
    expect(writeMotd(parse("&1Another Bungee server"), [], "bungeecord")).toBe(
      "motd: '&1Another Bungee server'",
    );
    expect(writeMotd(parse("&#5CB4FFHi"), parse("&7there"), "bungeecord")).toBe(
      'motd: "&x&5&C&B&4&F&FHi\\n&7there"',
    );
  });

  it("writes MiniMOTD's motds list", () => {
    expect(writeMotd(parse("<rainbow>MiniMOTD"), parse("&7Line two"), "minimotd")).toContain(
      'line2="<gray>Line two"',
    );
  });

  it("writes plain MiniMessage with <newline>", () => {
    expect(writeMotd(parse("&aA"), parse("&bB"), "minimessage")).toBe("<green>A<newline><aqua>B");
  });

  it("covers every target", () => {
    for (const t of MOTD_TARGETS) expect(writeMotd(line1, line2, t.id)).not.toBe("");
  });
});

describe("textWidth", () => {
  it("measures in game pixels, with bold one wider", () => {
    expect(textWidth(parseLegacy("Hi"))).toBe(8);
    expect(textWidth(parseLegacy("&lHi"))).toBe(10);
    expect(textWidth(parseLegacy("a b"))).toBe(16);
  });
});
