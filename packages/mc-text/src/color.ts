// Colours: the 16 named chat colours, parsing, and interpolation.

export interface NamedColor {
  name: string;
  code: string;
  hex: string;
}

/** The 16 chat colours, in code order. */
export const NAMED_COLORS: readonly NamedColor[] = [
  { name: "black", code: "0", hex: "#000000" },
  { name: "dark_blue", code: "1", hex: "#0000AA" },
  { name: "dark_green", code: "2", hex: "#00AA00" },
  { name: "dark_aqua", code: "3", hex: "#00AAAA" },
  { name: "dark_red", code: "4", hex: "#AA0000" },
  { name: "dark_purple", code: "5", hex: "#AA00AA" },
  { name: "gold", code: "6", hex: "#FFAA00" },
  { name: "gray", code: "7", hex: "#AAAAAA" },
  { name: "dark_gray", code: "8", hex: "#555555" },
  { name: "blue", code: "9", hex: "#5555FF" },
  { name: "green", code: "a", hex: "#55FF55" },
  { name: "aqua", code: "b", hex: "#55FFFF" },
  { name: "red", code: "c", hex: "#FF5555" },
  { name: "light_purple", code: "d", hex: "#FF55FF" },
  { name: "yellow", code: "e", hex: "#FFFF55" },
  { name: "white", code: "f", hex: "#FFFFFF" },
];

const BY_NAME = new Map(NAMED_COLORS.map((c) => [c.name, c]));
const BY_CODE = new Map(NAMED_COLORS.map((c) => [c.code, c]));
const BY_HEX = new Map(NAMED_COLORS.map((c) => [c.hex, c]));

// MiniMessage accepts these spellings too.
const ALIASES: Record<string, string> = { grey: "gray", dark_grey: "dark_gray" };

export function namedByName(name: string): NamedColor | undefined {
  const key = name.toLowerCase();
  return BY_NAME.get(ALIASES[key] ?? key);
}
export const namedByCode = (code: string) => BY_CODE.get(code.toLowerCase());
export const namedByHex = (hex: string) => BY_HEX.get(hex.toUpperCase());

/** Reads `#RGB`, `#RRGGBB` (with or without `#`) or a colour name. Returns `#RRGGBB`. */
export function parseColor(input: string): string | undefined {
  const s = input.trim();
  const named = namedByName(s);
  if (named) return named.hex;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m?.[1]) return undefined;
  let hex = m[1];
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
  return `#${hex.toUpperCase()}`;
}

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

// OKLab, for gradients that stay even in brightness and for "nearest colour".
const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) =>
  255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);

export function rgbToOklab([r, g, b]: Rgb): Rgb {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb([L, a, b]: Rgb): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export type Interpolation = "rgb" | "oklab";

export function mix(a: string, b: string, t: number, space: Interpolation = "rgb"): string {
  const lerp = (x: Rgb, y: Rgb): Rgb => [
    x[0] + (y[0] - x[0]) * t,
    x[1] + (y[1] - x[1]) * t,
    x[2] + (y[2] - x[2]) * t,
  ];
  if (space === "rgb") return rgbToHex(lerp(hexToRgb(a), hexToRgb(b)));
  return rgbToHex(oklabToRgb(lerp(rgbToOklab(hexToRgb(a)), rgbToOklab(hexToRgb(b)))));
}

/** The colour at `t` (0 to 1) along evenly spaced stops. */
export function sampleStops(stops: readonly string[], t: number, space: Interpolation = "rgb") {
  if (stops.length === 0) throw new Error("A gradient needs at least one colour");
  if (stops.length === 1) return stops[0] as string;
  const scaled = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  return mix(stops[i] as string, stops[i + 1] as string, scaled - i, space);
}

export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbToHex([f(5) * 255, f(3) * 255, f(1) * 255]);
}

/** The closest of the 16 chat colours, judged in OKLab so it matches what eyes see. */
export function nearestNamed(hex: string): NamedColor {
  const target = rgbToOklab(hexToRgb(hex));
  let best = NAMED_COLORS[0] as NamedColor;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const c of NAMED_COLORS) {
    const [l, a, b] = rgbToOklab(hexToRgb(c.hex));
    const d = (l - target[0]) ** 2 + (a - target[1]) ** 2 + (b - target[2]) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = c;
    }
  }
  return best;
}

/** The drop shadow Minecraft draws under text: the colour at a quarter brightness. */
export function shadowOf(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([Math.floor(r / 4), Math.floor(g / 4), Math.floor(b / 4)]);
}
