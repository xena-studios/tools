// The one model every format is read into and written from: a flat list of
// spans, each a run of text with one style. JSON components are trees, but
// every tool here works on what the player sees, which is a sequence of runs,
// so trees are flattened on the way in.

export type ClickAction =
  | "open_url"
  | "run_command"
  | "suggest_command"
  | "copy_to_clipboard"
  | "change_page";

export interface Click {
  action: ClickAction;
  value: string;
}

export interface Style {
  /** Always `#RRGGBB`, upper case. Undefined means the default (inherited) colour. */
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
  font?: string;
  hover?: Span[];
  click?: Click;
}

export interface Span {
  text: string;
  style: Style;
}

export const DECORATIONS = ["bold", "italic", "underlined", "strikethrough", "obfuscated"] as const;
export type Decoration = (typeof DECORATIONS)[number];

export function sameClick(a?: Click, b?: Click): boolean {
  if (!a || !b) return a === b;
  return a.action === b.action && a.value === b.value;
}

export function sameSpans(a?: Span[], b?: Span[]): boolean {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  return a.every((s, i) => {
    const other = b[i];
    return other !== undefined && s.text === other.text && sameStyle(s.style, other.style);
  });
}

export function sameStyle(a: Style, b: Style): boolean {
  return (
    a.color === b.color &&
    DECORATIONS.every((d) => !!a[d] === !!b[d]) &&
    a.font === b.font &&
    sameClick(a.click, b.click) &&
    sameSpans(a.hover, b.hover)
  );
}

/** Removes undefined and false keys, so styles compare and print cleanly. */
export function cleanStyle(style: Style): Style {
  const out: Style = {};
  if (style.color) out.color = style.color;
  for (const d of DECORATIONS) if (style[d]) out[d] = true;
  if (style.font) out.font = style.font;
  if (style.hover && style.hover.length > 0) out.hover = style.hover;
  if (style.click) out.click = style.click;
  return out;
}

/** Joins neighbouring spans with the same style and drops empty ones. */
export function normalize(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    if (span.text === "") continue;
    const style = cleanStyle(span.style);
    const last = out.at(-1);
    if (last && sameStyle(last.style, style)) last.text += span.text;
    else out.push({ text: span.text, style });
  }
  return out;
}

/**
 * Folds whitespace-only spans into the span before them when it can't change
 * what the player sees (no underline or strikethrough, which draw on spaces),
 * so gradients don't spend a colour code on every space.
 */
export function compact(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of normalize(spans)) {
    const last = out.at(-1);
    const invisible =
      /^\s+$/.test(span.text) &&
      last &&
      !span.style.underlined &&
      !span.style.strikethrough &&
      !last.style.underlined &&
      !last.style.strikethrough &&
      !!span.style.bold === !!last.style.bold && // bold changes a space's width
      span.style.font === last.style.font &&
      sameClick(span.style.click, last.style.click) &&
      sameSpans(span.style.hover, last.style.hover);
    if (last && invisible) last.text += span.text;
    else out.push({ text: span.text, style: { ...span.style } });
  }
  return normalize(out);
}

export function plainText(spans: Span[]): string {
  return spans.map((s) => s.text).join("");
}
