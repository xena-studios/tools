// The server list message (MOTD): two lines, written for each file that holds one.
//
// What each target reads, checked against the projects' own docs and source:
// - server.properties is a java.util.Properties file. `\n` is a newline, `\uXXXX`
//   a character, and the value's leading spaces are dropped unless escaped.
//   Vanilla sends the MOTD as a § string and the client only knows the 16
//   colours and k–o, r: `§x` hex is ignored (each `§R` digit then reads as a
//   colour). Paper reads the MOTD with Adventure's legacy serializer, which
//   understands `§x§R§R§G§G§B§B`, so hex works there and on its forks.
// - Velocity's velocity.toml `motd` is MiniMessage only (config version 2.6+),
//   in a TOML basic string.
// - BungeeCord's config.yml `motd` runs through translateAlternateColorCodes('&'),
//   which knows 0–9, a–f, k–o, r and x, so `&x&R&R&G&G&B&B` is hex and `&#RRGGBB`
//   isn't. Waterfall is a fork and reads it the same way.
// - MiniMOTD's main.conf is HOCON, with `line1` and `line2` in MiniMessage.

import { toLegacy } from "./legacy.ts";
import { toMiniMessage } from "./minimessage.ts";
import type { Span } from "./model.ts";

export type MotdTarget =
  | "server-properties"
  | "velocity"
  | "bungeecord"
  | "minimotd"
  | "minimessage";

export interface MotdTargetInfo {
  id: MotdTarget;
  label: string;
  /** The file it goes in, and where in it. */
  file: string;
}

export const MOTD_TARGETS: readonly MotdTargetInfo[] = [
  {
    id: "server-properties",
    label: "server.properties",
    file: "Vanilla, Paper and forks: the motd= line",
  },
  { id: "velocity", label: "Velocity", file: "velocity.toml: the motd line" },
  {
    id: "bungeecord",
    label: "BungeeCord",
    file: "config.yml: the motd under listeners (Waterfall too)",
  },
  { id: "minimotd", label: "MiniMOTD", file: "main.conf: the motds list" },
  { id: "minimessage", label: "MiniMessage", file: "Any plugin that takes MiniMessage" },
];

export const isMotdTarget = (v: string | null): v is MotdTarget =>
  MOTD_TARGETS.some((t) => t.id === v);

/** The two lines as one run of text, joined by a newline. An empty second line is left off. */
export function motdSpans(line1: Span[], line2: Span[] = []): Span[] {
  if (line2.every((s) => s.text === "")) return line1;
  return [...line1, { text: "\n", style: {} }, ...line2];
}

const hex4 = (code: number) => code.toString(16).toUpperCase().padStart(4, "0");

/**
 * Escapes a value for a Java .properties file: backslashes, line breaks and
 * anything outside printable ASCII (so `§` is `§`, which reads the same
 * whether the server loads the file as UTF-8 or as ISO-8859-1).
 */
export function escapeProperties(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const c = value[i] as string;
    const code = value.charCodeAt(i);
    if (c === "\\") out += "\\\\";
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (c === " " && out === "") out += "\\ ";
    else if (code < 0x20 || code > 0x7e) out += `\\u${hex4(code)}`;
    else out += c;
  }
  return out;
}

/** A TOML basic string: quotes, backslashes and control characters escaped. */
export function tomlString(value: string): string {
  const named: Record<string, string> = {
    "\b": "\\b",
    "\t": "\\t",
    "\n": "\\n",
    "\f": "\\f",
    "\r": "\\r",
    '"': '\\"',
    "\\": "\\\\",
  };
  let out = "";
  for (const c of value) {
    const code = c.codePointAt(0) ?? 0;
    out += named[c] ?? (code < 0x20 || code === 0x7f ? `\\u${hex4(code)}` : c);
  }
  return `"${out}"`;
}

/**
 * A YAML scalar: single-quoted when it can be (no escapes, `'` doubled), and
 * double-quoted when it holds a line break or control character, which only
 * double quotes can escape.
 */
export function yamlString(value: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: looking for them on purpose
  if (!/[\u0000-\u001f\u007f]/.test(value)) return `'${value.replace(/'/g, "''")}'`;
  let out = "";
  for (const c of value) {
    const code = c.codePointAt(0) ?? 0;
    if (c === "\\") out += "\\\\";
    else if (c === '"') out += '\\"';
    else if (c === "\n") out += "\\n";
    else if (c === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) out += `\\u${hex4(code)}`;
    else out += c;
  }
  return `"${out}"`;
}

/** A HOCON quoted string, which is a JSON string. */
export const hoconString = (value: string) => JSON.stringify(value);

export interface MotdOptions {
  /**
   * Write hex colours for server.properties as `§x§R§R…` (Paper and its forks).
   * Off, each colour becomes the nearest of the 16, which vanilla can show.
   */
  hex?: boolean;
}

/** Writes the MOTD as the line (or block) that goes in the target's file. */
export function writeMotd(
  line1: Span[],
  line2: Span[],
  target: MotdTarget,
  options: MotdOptions = {},
): string {
  const spans = motdSpans(line1, line2);
  switch (target) {
    case "server-properties": {
      const legacy = toLegacy(spans, { char: "§", hex: options.hex === false ? "none" : "bungee" });
      return `motd=${escapeProperties(legacy)}`;
    }
    case "velocity":
      return `motd = ${tomlString(toMiniMessage(spans))}`;
    case "bungeecord":
      return `motd: ${yamlString(toLegacy(spans, { char: "&", hex: "bungee" }))}`;
    case "minimotd":
      return [
        "motds=[",
        "    {",
        `        line1=${hoconString(toMiniMessage(line1))}`,
        `        line2=${hoconString(toMiniMessage(line2))}`,
        "    }",
        "]",
      ].join("\n");
    case "minimessage":
      return toMiniMessage(spans);
  }
}

/** The width the server list gives the MOTD, in game pixels (305 row, less the icon and margins). */
export const MOTD_WIDTH = 267;

// Advances in the game's default font, in game pixels including the 1px gap,
// for the printable ASCII it draws most. Anything else counts as 6: an estimate.
const NARROW: Record<string, number> = {
  " ": 4,
  "!": 2,
  "'": 2,
  ",": 2,
  ".": 2,
  ":": 2,
  ";": 2,
  i: 2,
  "|": 2,
  "`": 3,
  l: 3,
  '"': 4,
  "(": 5,
  ")": 5,
  "*": 5,
  "<": 5,
  ">": 5,
  I: 4,
  "[": 4,
  "]": 4,
  f: 5,
  k: 5,
  t: 5,
  "{": 5,
  "}": 5,
  "@": 7,
};

/** About how wide a run of text is in the game's font, in game pixels. Bold adds one per character. */
export function textWidth(spans: Span[]): number {
  let width = 0;
  for (const span of spans) {
    for (const c of span.text) {
      if (c === "\n") continue;
      width += (NARROW[c] ?? 6) + (span.style.bold ? 1 : 0);
    }
  }
  return width;
}
