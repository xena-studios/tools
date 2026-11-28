import { describe, expect, it } from "vitest";
import { descriptionSpans, plain } from "./status-text";

describe("server descriptions", () => {
  it("reads a § string", () => {
    const spans = descriptionSpans("§aHello §lthere");
    expect(spans).toEqual([
      { text: "Hello ", style: { color: "#55FF55" } },
      { text: "there", style: { color: "#55FF55", bold: true } },
    ]);
  });
  it("reads a component, with § codes inside its text", () => {
    const spans = descriptionSpans({
      text: "",
      extra: [
        { text: "Sky ", color: "aqua", bold: true },
        { text: "§cRed §7grey", color: "gold" },
      ],
    });
    expect(plain(spans)).toBe("Sky Red grey");
    expect(spans[0]?.style).toMatchObject({ color: "#55FFFF", bold: true });
    expect(spans.find((s) => s.text === "Red ")?.style.color).toBe("#FF5555");
    expect(spans.find((s) => s.text === "grey")?.style.color).toBe("#AAAAAA");
  });
  it("keeps the component's colour before the first code", () => {
    const spans = descriptionSpans({ text: "A §lB", color: "gold" });
    expect(spans).toEqual([
      { text: "A ", style: { color: "#FFAA00" } },
      { text: "B", style: { color: "#FFAA00", bold: true } },
    ]);
  });
  it("survives junk", () => {
    expect(descriptionSpans(null)).toEqual([]);
    expect(descriptionSpans(42)).toEqual([]);
    expect(plain(descriptionSpans(["", { text: "x" }]))).toBe("x");
  });
});
