import { describe, expect, it } from "vitest";
import {
  detectFormat,
  gradient,
  mix,
  nearestNamed,
  parseColor,
  parseJson,
  parseLegacy,
  parseMiniMessage,
  plainText,
  serialize,
  shadowOf,
  toJson,
  toLegacy,
  toMiniMessage,
} from "./index.ts";

describe("colours", () => {
  it("parses names, short and long hex", () => {
    expect(parseColor("red")).toBe("#FF5555");
    expect(parseColor("grey")).toBe("#AAAAAA");
    expect(parseColor("#abc")).toBe("#AABBCC");
    expect(parseColor("5cb4ff")).toBe("#5CB4FF");
    expect(parseColor("nope")).toBeUndefined();
  });
  it("mixes and finds the nearest chat colour", () => {
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mix("#FF0000", "#0000FF", 0)).toBe("#FF0000");
    expect(nearestNamed("#FF4444").code).toBe("c");
    expect(nearestNamed("#50F0F0").code).toBe("b");
    expect(nearestNamed("#0A0A0A").code).toBe("0");
  });
  it("draws the game's text shadow", () => {
    expect(shadowOf("#FFFFFF")).toBe("#3F3F3F");
  });
});

describe("legacy", () => {
  it("reads colour and format codes, with colours clearing formats", () => {
    expect(parseLegacy("&c&lHi &athere")).toEqual([
      { text: "Hi ", style: { color: "#FF5555", bold: true } },
      { text: "there", style: { color: "#55FF55" } },
    ]);
  });
  it("reads every hex form", () => {
    const want = [{ text: "x", style: { color: "#5CB4FF" } }];
    expect(parseLegacy("&#5CB4FFx")).toEqual(want);
    expect(parseLegacy("&x&5&c&b&4&f&fx")).toEqual(want);
    expect(parseLegacy("§x§5§C§B§4§F§Fx")).toEqual(want);
    expect(parseLegacy("{#5CB4FF}x")).toEqual(want);
    expect(parseLegacy("<#5CB4FF>x")).toEqual(want);
  });
  it("keeps unknown codes as text and handles reset", () => {
    expect(parseLegacy("&zA&r")).toEqual([{ text: "&zA", style: {} }]);
    expect(parseLegacy("&lA&rB")).toEqual([
      { text: "A", style: { bold: true } },
      { text: "B", style: {} },
    ]);
  });
  it("writes each hex form, using short codes for named colours", () => {
    const spans = parseLegacy("&#5CB4FFIon &cRed");
    expect(toLegacy(spans)).toBe("&#5CB4FFIon &cRed");
    expect(toLegacy(spans, { hex: "bungee" })).toBe("&x&5&C&B&4&F&FIon &cRed");
    expect(toLegacy(spans, { hex: "brace" })).toBe("{#5CB4FF}Ion &cRed");
    expect(toLegacy(spans, { hex: "none" })).toBe(`&${nearestNamed("#5CB4FF").code}Ion &cRed`);
    expect(toLegacy(spans, { char: "§", hex: "bungee" })).toBe("§x§5§C§B§4§F§FIon §cRed");
  });
  it("resets when a decoration ends", () => {
    expect(toLegacy(parseLegacy("&c&lA&cB"))).toBe("&c&lA&cB");
    expect(
      toLegacy([
        { text: "A", style: { bold: true } },
        { text: "B", style: {} },
      ]),
    ).toBe("&lA&rB");
  });
  it("round-trips, dropping a reset a colour code already does", () => {
    expect(toLegacy(parseLegacy("&6&lGOLD &r&7gray &#123456hex&o!"))).toBe(
      "&6&lGOLD &7gray &#123456hex&o!",
    );
  });
});

describe("MiniMessage", () => {
  it("reads colours and decorations, nested and closed", () => {
    expect(parseMiniMessage("<red>A<bold>B</bold>C</red>D")).toEqual([
      { text: "A", style: { color: "#FF5555" } },
      { text: "B", style: { color: "#FF5555", bold: true } },
      { text: "C", style: { color: "#FF5555" } },
      { text: "D", style: {} },
    ]);
  });
  it("reads aliases, hex, negation and reset", () => {
    expect(parseMiniMessage("<b><#5cb4ff>A<!b>B<reset>C")).toEqual([
      { text: "A", style: { color: "#5CB4FF", bold: true } },
      { text: "B", style: { color: "#5CB4FF" } },
      { text: "C", style: {} },
    ]);
    expect(parseMiniMessage("<color:gold>A")).toEqual([{ text: "A", style: { color: "#FFAA00" } }]);
  });
  it("draws gradients like MiniMessage, ends exact", () => {
    const spans = parseMiniMessage("<gradient:#FF0000:#0000FF>abc</gradient>");
    expect(spans.map((s) => s.style.color)).toEqual(["#FF0000", "#800080", "#0000FF"]);
    expect(plainText(spans)).toBe("abc");
  });
  it("lets a colour inside a gradient win", () => {
    const spans = parseMiniMessage("<gradient:red:blue>a<green>b</green>c</gradient>");
    expect(spans.find((s) => s.text === "b")?.style.color).toBe("#55FF55");
  });
  it("reads rainbow", () => {
    const spans = parseMiniMessage("<rainbow>abc</rainbow>");
    expect(spans).toHaveLength(3);
    expect(spans[0]?.style.color).toBe("#FF0000");
  });
  it("reads hover and click with quoted args", () => {
    const [span] = parseMiniMessage(
      "<hover:show_text:'<red>Hi: there'><click:open_url:'https://xenastudios.co'>Go</click></hover>",
    );
    expect(span?.style.hover).toEqual([{ text: "Hi: there", style: { color: "#FF5555" } }]);
    expect(span?.style.click).toEqual({ action: "open_url", value: "https://xenastudios.co" });
  });
  it("keeps unknown tags and escapes as text", () => {
    expect(plainText(parseMiniMessage("<player> \\<red> 1 < 2"))).toBe("<player> <red> 1 < 2");
  });
  it("writes and reads back the same thing", () => {
    const input = "<gold><bold>Xena</bold> <gray>Tools <hover:show_text:'<red>hi'>hover</hover>";
    const spans = parseMiniMessage(input);
    expect(parseMiniMessage(toMiniMessage(spans))).toEqual(spans);
  });
  it("writes short output", () => {
    expect(toMiniMessage(parseLegacy("&cA&lB&cC"))).toBe("<red>A<bold>B<!bold>C");
    expect(toMiniMessage([{ text: "a<b", style: {} }])).toBe("a\\<b");
  });
});

describe("JSON", () => {
  it("reads objects, arrays, extra and both event dialects", () => {
    const spans = parseJson(
      '["",{"text":"A","color":"red","bold":true},{"text":"B","hoverEvent":{"action":"show_text","contents":"hi"}},{"text":"C","click_event":{"action":"open_url","url":"https://x.y"}}]',
    );
    expect(spans).toEqual([
      { text: "A", style: { color: "#FF5555", bold: true } },
      { text: "B", style: { hover: [{ text: "hi", style: {} }] } },
      { text: "C", style: { click: { action: "open_url", value: "https://x.y" } } },
    ]);
  });
  it("inherits style through extra", () => {
    expect(parseJson('{"text":"A","color":"gold","extra":[{"text":"B","bold":true}]}')).toEqual([
      { text: "A", style: { color: "#FFAA00" } },
      { text: "B", style: { color: "#FFAA00", bold: true } },
    ]);
  });
  it("writes the modern and older dialects", () => {
    const spans = parseMiniMessage("<click:run_command:'/spawn'><red>Spawn");
    expect(toJson(spans)).toBe(
      '{"text":"Spawn","color":"red","click_event":{"action":"run_command","command":"/spawn"}}',
    );
    expect(toJson(spans, { dialect: "legacy" })).toBe(
      '{"text":"Spawn","color":"red","clickEvent":{"action":"run_command","value":"/spawn"}}',
    );
  });
  it("round-trips", () => {
    const spans = parseMiniMessage("<#123456>a<bold>b<hover:show_text:'x'>c");
    expect(parseJson(toJson(spans))).toEqual(spans);
    expect(parseJson(toJson(spans, { dialect: "legacy" }))).toEqual(spans);
  });
});

describe("gradient", () => {
  it("hits both ends exactly", () => {
    const spans = gradient("Hello", ["#FF0000", "#0000FF"]);
    expect(spans[0]?.style.color).toBe("#FF0000");
    expect(spans[4]?.style.color).toBe("#0000FF");
  });
  it("can skip spaces", () => {
    const spans = gradient("a b", ["#000000", "#FFFFFF"], { skipSpaces: true });
    expect(spans.map((s) => s.style.color)).toEqual(["#000000", "#000000", "#FFFFFF"]);
  });
  it("doesn't spend codes on spaces", () => {
    const out = serialize(gradient("a b", ["#FF0000", "#0000FF"]), "legacy-hash");
    expect(out).toBe("&#FF0000a &#0000FFb");
  });
});

describe("detectFormat", () => {
  it("tells the formats apart", () => {
    expect(detectFormat('{"text":"hi"}')).toBe("json");
    expect(detectFormat("<gradient:red:blue>hi")).toBe("minimessage");
    expect(detectFormat("&chi")).toBe("legacy");
    expect(detectFormat("[not json")).toBe("legacy");
    expect(detectFormat("1 < 2 > 0")).toBe("legacy");
  });
});
