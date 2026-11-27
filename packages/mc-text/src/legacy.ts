// Legacy formatting codes: `&c`, `§l`, and the hex forms plugins added on top.

import { namedByCode, namedByHex, nearestNamed } from "./color.ts";
import { compact, type Decoration, normalize, type Span, type Style } from "./model.ts";

const FORMAT_CODES: Record<string, Decoration> = {
  k: "obfuscated",
  l: "bold",
  m: "strikethrough",
  n: "underlined",
  o: "italic",
};
const CODE_FOR: Record<Decoration, string> = {
  obfuscated: "k",
  bold: "l",
  strikethrough: "m",
  underlined: "n",
  italic: "o",
};
const DECORATION_ORDER: Decoration[] = [
  "bold",
  "italic",
  "underlined",
  "strikethrough",
  "obfuscated",
];

const HEX = /^[0-9a-f]{6}$/i;

export interface LegacyParseOptions {
  /** Characters that start a code. Both `&` and `§` by default. */
  chars?: string;
}

/**
 * Reads legacy codes and the common hex forms:
 * `&#RRGGBB` (Essentials, CMI), `&x&R&R&G&G&B&B` (Spigot/BungeeCord),
 * `{#RRGGBB}` (TAB and others) and `<#RRGGBB>` (several plugins).
 * Like the game, a colour code clears bold, italic and the rest.
 */
export function parseLegacy(input: string, options: LegacyParseOptions = {}): Span[] {
  const chars = options.chars ?? "&§";
  const spans: Span[] = [];
  let style: Style = {};
  let text = "";

  const flush = () => {
    if (text) spans.push({ text, style: { ...style } });
    text = "";
  };
  const setColor = (hex: string) => {
    flush();
    style = { color: hex };
  };

  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;

    if (chars.includes(ch) && i + 1 < input.length) {
      const code = (input[i + 1] as string).toLowerCase();

      // &#RRGGBB
      if (code === "#" && HEX.test(input.slice(i + 2, i + 8))) {
        setColor(`#${input.slice(i + 2, i + 8).toUpperCase()}`);
        i += 8;
        continue;
      }
      // &x&R&R&G&G&B&B
      if (code === "x") {
        let hex = "";
        let j = i + 2;
        while (
          hex.length < 6 &&
          chars.includes(input[j] ?? "") &&
          /[0-9a-f]/i.test(input[j + 1] ?? "")
        ) {
          hex += input[j + 1];
          j += 2;
        }
        if (hex.length === 6) {
          setColor(`#${hex.toUpperCase()}`);
          i = j;
          continue;
        }
      }
      const named = namedByCode(code);
      if (named) {
        setColor(named.hex);
        i += 2;
        continue;
      }
      const decoration = FORMAT_CODES[code];
      if (decoration) {
        flush();
        style = { ...style, [decoration]: true };
        i += 2;
        continue;
      }
      if (code === "r") {
        flush();
        style = {};
        i += 2;
        continue;
      }
    }

    // {#RRGGBB} and <#RRGGBB>
    if ((ch === "{" || ch === "<") && input[i + 1] === "#") {
      const close = ch === "{" ? "}" : ">";
      const hex = input.slice(i + 2, i + 8);
      if (HEX.test(hex) && input[i + 8] === close) {
        setColor(`#${hex.toUpperCase()}`);
        i += 9;
        continue;
      }
    }

    text += ch;
    i += 1;
  }
  flush();
  return normalize(spans);
}

export type LegacyHexFormat =
  /** `&#RRGGBB`: Essentials, CMI, most modern plugins */
  | "hash"
  /** `&x&R&R&G&G&B&B`: Spigot and BungeeCord, what the server itself understands */
  | "bungee"
  /** `{#RRGGBB}`: TAB and others */
  | "brace"
  /** `<#RRGGBB>`: several plugins */
  | "angle"
  /** No hex: each colour becomes the nearest of the 16 chat colours */
  | "none";

export interface LegacyWriteOptions {
  char?: "&" | "§";
  hex?: LegacyHexFormat;
}

function colorCode(hex: string, char: string, format: LegacyHexFormat): string {
  const named = namedByHex(hex);
  if (named) return char + named.code;
  const digits = hex.slice(1);
  switch (format) {
    case "hash":
      return `${char}#${digits}`;
    case "bungee":
      return `${char}x${[...digits].map((d) => char + d).join("")}`;
    case "brace":
      return `{#${digits}}`;
    case "angle":
      return `<#${digits}>`;
    case "none":
      return char + nearestNamed(hex).code;
  }
}

/**
 * Writes legacy codes. Hover and click can't be written this way and are dropped;
 * use `isLossyForLegacy` to warn about it.
 */
export function toLegacy(spans: Span[], options: LegacyWriteOptions = {}): string {
  const char = options.char ?? "&";
  const format = options.hex ?? "hash";
  let out = "";
  let current: Style = {};
  let colorCurrent: string | undefined;

  for (const span of compact(spans)) {
    const next = span.style;
    // With no hex, two colours can collapse to the same code: compare what gets written.
    const nextColor = next.color
      ? format === "none"
        ? nearestNamed(next.color).hex
        : next.color
      : undefined;
    const lost = DECORATION_ORDER.some((d) => current[d] && !next[d]);

    if (nextColor !== colorCurrent || lost) {
      out += nextColor ? colorCode(nextColor, char, format) : `${char}r`;
      for (const d of DECORATION_ORDER) if (next[d]) out += char + CODE_FOR[d];
    } else {
      for (const d of DECORATION_ORDER) if (next[d] && !current[d]) out += char + CODE_FOR[d];
    }
    out += span.text;
    current = next;
    colorCurrent = nextColor;
  }
  return out;
}

export function isLossyForLegacy(spans: Span[]): boolean {
  return spans.some((s) => s.style.hover || s.style.click || s.style.font);
}
