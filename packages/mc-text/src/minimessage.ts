// MiniMessage (Adventure's tag format, used by Paper, Velocity and most modern plugins).
// Covers colours, decorations, gradient, rainbow, hover, click, font, newline and
// reset. Other tags (placeholders, translatable, keybind...) are kept as literal text,
// which is how a server shows a tag it doesn't know.

import { hsvToHex, namedByHex, namedByName, parseColor, sampleStops } from "./color.ts";
import {
  type ClickAction,
  compact,
  DECORATIONS,
  type Decoration,
  normalize,
  type Span,
  type Style,
} from "./model.ts";

const DECORATION_TAGS: Record<string, Decoration> = {
  bold: "bold",
  b: "bold",
  italic: "italic",
  i: "italic",
  em: "italic",
  underlined: "underlined",
  u: "underlined",
  strikethrough: "strikethrough",
  st: "strikethrough",
  obfuscated: "obfuscated",
  obf: "obfuscated",
};

const CLICK_ACTIONS = new Set<ClickAction>([
  "open_url",
  "run_command",
  "suggest_command",
  "copy_to_clipboard",
  "change_page",
]);

type Token =
  | { kind: "text"; value: string }
  | { kind: "open"; name: string; args: string[]; negated: boolean; raw: string }
  | { kind: "close"; name: string; raw: string };

/** Splits `name:arg:'quoted:arg'` on colons outside quotes. */
function splitArgs(body: string): string[] | undefined {
  const parts: string[] = [];
  let cur = "";
  let quote: string | null = null;
  for (let i = 0; i < body.length; i++) {
    const c = body[i] as string;
    if (quote) {
      if (c === "\\" && (body[i + 1] === quote || body[i + 1] === "\\")) {
        cur += body[i + 1];
        i++;
      } else if (c === quote) quote = null;
      else cur += c;
    } else if (c === "'" || c === '"') quote = c;
    else if (c === ":") {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  if (quote) return undefined;
  parts.push(cur);
  return parts;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let text = "";
  let i = 0;
  const pushText = () => {
    if (text) tokens.push({ kind: "text", value: text });
    text = "";
  };

  while (i < input.length) {
    const c = input[i] as string;
    if (c === "\\" && (input[i + 1] === "<" || input[i + 1] === "\\")) {
      text += input[i + 1];
      i += 2;
      continue;
    }
    if (c === "<") {
      // Find the closing '>' outside quotes.
      let j = i + 1;
      let quote: string | null = null;
      while (j < input.length) {
        const d = input[j] as string;
        if (quote) {
          if (d === "\\") j++;
          else if (d === quote) quote = null;
        } else if (d === "'" || d === '"') quote = d;
        else if (d === ">" || d === "<") break;
        j++;
      }
      if (input[j] === ">") {
        const raw = input.slice(i, j + 1);
        const body = input.slice(i + 1, j);
        const closing = body.startsWith("/");
        const negated = body.startsWith("!");
        const parts = splitArgs(closing || negated ? body.slice(1) : body);
        const name = parts?.[0]?.toLowerCase();
        if (parts && name && /^[#a-z0-9_-]+$/i.test(name)) {
          pushText();
          if (closing) tokens.push({ kind: "close", name, raw });
          else tokens.push({ kind: "open", name, args: parts.slice(1), negated, raw });
          i = j + 1;
          continue;
        }
      }
    }
    text += c;
    i++;
  }
  pushText();
  return tokens;
}

// Internal span, remembering which gradient frame (if any) owns its colour.
interface Draft extends Span {
  owner?: number;
}

interface Frame {
  name: string;
  style: Style;
  owner?: number;
  /** For gradient and rainbow: index of the first draft span inside it. */
  start?: number;
  colorize?: (count: number) => (i: number) => string;
}

function colorFromTag(name: string, args: string[]): string | undefined {
  if (name.startsWith("#")) return parseColor(name);
  if (name === "color" || name === "colour" || name === "c") return parseColor(args[0] ?? "");
  return namedByName(name)?.hex;
}

function gradientColorizer(args: string[]): Frame["colorize"] {
  const colors: string[] = [];
  let phase = 0;
  for (const a of args) {
    const color = parseColor(a);
    if (color) colors.push(color);
    else if (!Number.isNaN(Number(a))) phase = Number(a);
  }
  if (colors.length === 0) colors.push("#FFFFFF", "#000000");
  if (colors.length === 1) colors.push(colors[0] as string);
  return (count) => (i) => {
    let t = count <= 1 ? 0 : i / (count - 1);
    // Phase shifts the gradient along the text and wraps, as in MiniMessage.
    if (phase) t = (((t + phase) % 1) + 1) % 1;
    return sampleStops(colors, t);
  };
}

function rainbowColorizer(args: string[]): Frame["colorize"] {
  let arg = args[0] ?? "";
  const reversed = arg.startsWith("!");
  if (reversed) arg = arg.slice(1);
  const phase = Number(arg) || 0;
  return (count) => (i) => {
    const step = count === 0 ? 0 : i / count;
    const hue = ((((reversed ? -step : step) + phase / 10) % 1) + 1) % 1;
    return hsvToHex(hue, 1, 1);
  };
}

export function parseMiniMessage(input: string): Span[] {
  const drafts: Draft[] = [];
  const stack: Frame[] = [{ name: "", style: {} }];
  let nextOwner = 1;

  const top = () => stack.at(-1) as Frame;

  const finishGradient = (frame: Frame) => {
    if (frame.start === undefined || !frame.colorize || frame.owner === undefined) return;
    // Split the owned spans into single characters and colour them.
    const tail = drafts.splice(frame.start);
    const pieces: Draft[] = [];
    for (const d of tail) {
      if (d.owner === frame.owner) {
        for (const ch of Array.from(d.text))
          pieces.push({ text: ch, style: d.style, owner: d.owner });
      } else pieces.push(d);
    }
    const owned = pieces.filter((p) => p.owner === frame.owner);
    const colorAt = frame.colorize(owned.length);
    let n = 0;
    for (const p of pieces) {
      if (p.owner === frame.owner) {
        p.style = { ...p.style, color: colorAt(n++) };
        // Coloured now, so an outer gradient leaves these alone.
        p.owner = undefined;
      }
    }
    drafts.push(...pieces);
  };

  const pop = (index: number) => {
    while (stack.length > index) {
      const frame = stack.pop() as Frame;
      finishGradient(frame);
    }
  };

  for (const token of tokenize(input)) {
    if (token.kind === "text") {
      drafts.push({ text: token.value, style: { ...top().style }, owner: top().owner });
      continue;
    }
    if (token.kind === "close") {
      const name = normalizeName(token.name);
      let idx = -1;
      for (let k = stack.length - 1; k > 0; k--) {
        if ((stack[k] as Frame).name === name) {
          idx = k;
          break;
        }
      }
      if (idx > 0) pop(idx);
      // An unmatched close tag is ignored, as MiniMessage does.
      continue;
    }

    const { name, args, negated } = token;
    const parent = top();
    const decoration = DECORATION_TAGS[name];

    if (decoration) {
      const value = negated ? false : args[0] !== "false";
      stack.push({
        name: decoration,
        style: { ...parent.style, [decoration]: value },
        owner: parent.owner,
      });
      continue;
    }
    if (negated) {
      drafts.push({ text: token.raw, style: { ...parent.style }, owner: parent.owner });
      continue;
    }
    const color = colorFromTag(name, args);
    if (color) {
      stack.push({ name: "color", style: { ...parent.style, color }, owner: undefined });
      continue;
    }
    switch (name) {
      case "reset":
        pop(1);
        continue;
      case "newline":
      case "br":
        drafts.push({ text: "\n", style: { ...parent.style }, owner: parent.owner });
        continue;
      case "gradient":
      case "rainbow": {
        const owner = nextOwner++;
        stack.push({
          name,
          style: { ...parent.style, color: parent.style.color ?? "#FFFFFF" },
          owner,
          start: drafts.length,
          colorize: name === "gradient" ? gradientColorizer(args) : rainbowColorizer(args),
        });
        continue;
      }
      case "hover": {
        if (args[0] === "show_text" && args[1] !== undefined) {
          stack.push({
            name,
            style: { ...parent.style, hover: parseMiniMessage(args[1]) },
            owner: parent.owner,
          });
          continue;
        }
        break;
      }
      case "click": {
        const action = args[0] as ClickAction;
        if (CLICK_ACTIONS.has(action) && args[1] !== undefined) {
          stack.push({
            name,
            style: { ...parent.style, click: { action, value: args.slice(1).join(":") } },
            owner: parent.owner,
          });
          continue;
        }
        break;
      }
      case "font": {
        if (args[0]) {
          stack.push({
            name,
            style: { ...parent.style, font: args.join(":") },
            owner: parent.owner,
          });
          continue;
        }
        break;
      }
    }
    // Unknown tag: shown as written.
    drafts.push({ text: token.raw, style: { ...parent.style }, owner: parent.owner });
  }
  pop(1);
  return normalize(drafts.map(({ text, style }) => ({ text, style })));
}

function normalizeName(name: string): string {
  const decoration = DECORATION_TAGS[name];
  if (decoration) return decoration;
  if (name.startsWith("#") || namedByName(name) || name === "colour" || name === "c")
    return "color";
  return name;
}

// Writing -------------------------------------------------------------------

function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/</g, "\\<");
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function colorTag(hex: string): string {
  return `<${namedByHex(hex)?.name ?? hex}>`;
}

/**
 * Writes MiniMessage. Colours are opened without closing (a later colour wins),
 * a decoration that ends is turned off with `<!bold>`, and hover and click wrap
 * their own text.
 */
export function toMiniMessage(spans: Span[]): string {
  let out = "";
  let color: string | undefined;
  const on: Partial<Record<Decoration, boolean>> = {};
  let font: string | undefined;

  for (const span of compact(spans)) {
    const s = span.style;
    if (s.color !== color || s.font !== font) {
      if ((!s.color && color) || (!s.font && font)) {
        out += "<reset>";
        for (const d of DECORATIONS) on[d] = false;
        color = undefined;
        font = undefined;
      }
      if (s.color && s.color !== color) out += colorTag(s.color);
      if (s.font && s.font !== font) out += `<font:${s.font}>`;
      color = s.color;
      font = s.font;
    }
    for (const d of DECORATIONS) {
      if (!!s[d] !== !!on[d]) {
        out += s[d] ? `<${d}>` : `<!${d}>`;
        on[d] = !!s[d];
      }
    }
    let text = escapeText(span.text).replace(/\n/g, "<newline>");
    if (s.click) text = `<click:${s.click.action}:${quote(s.click.value)}>${text}</click>`;
    if (s.hover) text = `<hover:show_text:${quote(toMiniMessage(s.hover))}>${text}</hover>`;
    out += text;
  }
  return out;
}
