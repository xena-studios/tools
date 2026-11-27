import { type Interpolation, sampleStops } from "./color.ts";
import type { Span, Style } from "./model.ts";

export interface GradientOptions {
  /** How colours blend between stops. `rgb` matches MiniMessage's own gradient tag. */
  interpolation?: Interpolation;
  /** Style applied to every character (bold and so on). Its colour is ignored. */
  style?: Omit<Style, "color">;
  /** Skip spaces when stepping through colours, so words stay evenly coloured. */
  skipSpaces?: boolean;
}

/** Colours each character of `text` along the gradient `stops` (hex colours). */
export function gradient(
  text: string,
  stops: readonly string[],
  options: GradientOptions = {},
): Span[] {
  const chars = Array.from(text);
  const counted = options.skipSpaces ? chars.filter((c) => !/\s/.test(c)).length : chars.length;
  let n = 0;
  return chars.map((ch) => {
    const isSpace = /\s/.test(ch);
    const index = options.skipSpaces && isSpace ? Math.max(0, n - 1) : n;
    if (!(options.skipSpaces && isSpace)) n++;
    const t = counted <= 1 ? 0 : index / (counted - 1);
    return {
      text: ch,
      style: { ...options.style, color: sampleStops(stops, t, options.interpolation) },
    };
  });
}
