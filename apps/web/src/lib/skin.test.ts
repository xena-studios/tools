import { describe, expect, it } from "vitest";
import { skinParts, VIEW_H, VIEW_W } from "./skin";

describe("skin layout", () => {
  it("draws a modern skin's six parts and six outer parts", () => {
    const parts = skinParts("front", "classic", false);
    expect(parts.filter((p) => !p.overlay)).toHaveLength(6);
    expect(parts.filter((p) => p.overlay)).toHaveLength(6);
    for (const p of parts) {
      expect(p.dx + p.w).toBeLessThanOrEqual(VIEW_W);
      expect(p.dy + p.h).toBeLessThanOrEqual(VIEW_H);
      expect(p.sx + p.w).toBeLessThanOrEqual(64);
      expect(p.sy + p.h).toBeLessThanOrEqual(64);
    }
  });
  it("puts the right arm on the viewer's left from the front, and right from the back", () => {
    const front = skinParts("front", "classic", false).find((p) => p.sx === 44 && p.sy === 20);
    const back = skinParts("back", "classic", false).find((p) => p.sx === 52 && p.sy === 20);
    expect(front?.dx).toBe(0);
    expect(back?.dx).toBe(12);
  });
  it("draws slim arms three wide, against the body", () => {
    const parts = skinParts("back", "slim", false);
    const rightBack = parts.find((p) => p.sx === 51 && p.sy === 20);
    const leftBack = parts.find((p) => p.sx === 43 && p.sy === 52);
    expect(rightBack).toMatchObject({ w: 3, dx: 12 });
    expect(leftBack).toMatchObject({ w: 3, dx: 1 });
  });
  it("mirrors a 64×32 skin's right limbs for its left, with only the hat on top", () => {
    const parts = skinParts("front", "classic", true);
    expect(parts.filter((p) => p.mirror)).toHaveLength(2);
    expect(parts.filter((p) => p.overlay)).toEqual([expect.objectContaining({ sx: 40, sy: 8 })]);
    for (const p of parts) expect(p.sy + p.h).toBeLessThanOrEqual(32);
  });
});
