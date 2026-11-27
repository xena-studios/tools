// JSON text components, as used by /tellraw, /title, signs, books and item names.
//
// 1.21.5 renamed the event fields: `hoverEvent`/`clickEvent` became
// `hover_event`/`click_event`, with `contents`/`value` replaced by `value`
// (hover) and `url`/`command`/`page`/`value` (click). Both are read; either
// can be written.

import { namedByHex, parseColor } from "./color.ts";
import {
  type Click,
  type ClickAction,
  DECORATIONS,
  normalize,
  type Span,
  type Style,
} from "./model.ts";

export type JsonDialect = "modern" | "legacy";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function asObject(value: Json | undefined): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function readStyle(obj: JsonObject, parent: Style): Style {
  const style: Style = { ...parent };
  if (typeof obj.color === "string") {
    const c = parseColor(obj.color);
    if (c) style.color = c;
  }
  for (const d of DECORATIONS) if (typeof obj[d] === "boolean") style[d] = obj[d] as boolean;
  if (typeof obj.font === "string") style.font = obj.font;

  const hover = asObject(obj.hover_event) ?? asObject(obj.hoverEvent);
  if (hover && hover.action === "show_text") {
    const content = hover.value ?? hover.contents;
    if (content !== undefined) style.hover = walk(content, {});
  }

  const click = asObject(obj.click_event) ?? asObject(obj.clickEvent);
  if (click && typeof click.action === "string") {
    const value = click.value ?? click.url ?? click.command ?? click.page;
    if (value !== undefined && value !== null)
      style.click = { action: click.action as ClickAction, value: String(value) };
  }
  return style;
}

function textOf(obj: JsonObject): string {
  if (typeof obj.text === "string" || typeof obj.text === "number") return String(obj.text);
  // Parts the server fills in: shown as a readable placeholder.
  if (typeof obj.translate === "string") return obj.translate;
  if (typeof obj.keybind === "string") return `[${obj.keybind}]`;
  if (typeof obj.selector === "string") return obj.selector;
  const score = asObject(obj.score);
  if (score) return `[${String(score.objective ?? "score")}]`;
  return "";
}

function walk(node: Json, parent: Style): Span[] {
  if (node === null || node === undefined) return [];
  if (typeof node !== "object") return [{ text: String(node), style: { ...parent } }];
  if (Array.isArray(node)) {
    // In an array, the first element is the parent of the rest.
    const [first, ...rest] = node;
    if (first === undefined) return [];
    const firstObj = asObject(first);
    const style = firstObj ? readStyle(firstObj, parent) : parent;
    return [...walk(first, parent), ...rest.flatMap((child) => walk(child, style))];
  }
  const style = readStyle(node, parent);
  const spans: Span[] = [{ text: textOf(node), style }];
  if (Array.isArray(node.extra)) for (const child of node.extra) spans.push(...walk(child, style));
  return spans;
}

export function parseJson(input: string): Span[] {
  return normalize(walk(JSON.parse(input) as Json, {}));
}

function writeClick(click: Click, dialect: JsonDialect): JsonObject {
  if (dialect === "legacy") return { action: click.action, value: click.value };
  switch (click.action) {
    case "open_url":
      return { action: click.action, url: click.value };
    case "run_command":
    case "suggest_command":
      return { action: click.action, command: click.value };
    case "change_page":
      return { action: click.action, page: Number(click.value) || 1 };
    default:
      return { action: click.action, value: click.value };
  }
}

function writeSpan(span: Span, dialect: JsonDialect): JsonObject {
  const s = span.style;
  const out: JsonObject = { text: span.text };
  if (s.color) out.color = namedByHex(s.color)?.name ?? s.color;
  for (const d of DECORATIONS) if (s[d]) out[d] = true;
  if (s.font) out.font = s.font;
  if (s.hover) {
    const contents = toJsonValue(s.hover, dialect);
    if (dialect === "modern") out.hover_event = { action: "show_text", value: contents };
    else out.hoverEvent = { action: "show_text", contents };
  }
  if (s.click) {
    if (dialect === "modern") out.click_event = writeClick(s.click, dialect);
    else out.clickEvent = writeClick(s.click, dialect);
  }
  return out;
}

function toJsonValue(spans: Span[], dialect: JsonDialect): Json {
  const parts = normalize(spans).map((s) => writeSpan(s, dialect));
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0] as JsonObject;
  // A leading "" keeps the first part's style from spreading to the rest.
  return ["", ...parts];
}

export interface JsonWriteOptions {
  dialect?: JsonDialect;
  pretty?: boolean;
}

export function toJson(spans: Span[], options: JsonWriteOptions = {}): string {
  const value = toJsonValue(spans, options.dialect ?? "modern");
  return JSON.stringify(value, null, options.pretty ? 2 : undefined);
}
