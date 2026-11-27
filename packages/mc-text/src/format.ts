// One entry point for every format: detect, read and write.

import { parseJson, toJson } from "./json.ts";
import { type LegacyHexFormat, parseLegacy, toLegacy } from "./legacy.ts";
import { parseMiniMessage, toMiniMessage } from "./minimessage.ts";
import type { Span } from "./model.ts";

export type InputFormat = "legacy" | "minimessage" | "json";

const MINIMESSAGE_TAG =
  /<\/?!?(#[0-9a-f]{6}|black|dark_blue|dark_green|dark_aqua|dark_red|dark_purple|gold|gr[ae]y|dark_gr[ae]y|blue|green|aqua|red|light_purple|yellow|white|colou?r|c|bold|b|italic|i|em|underlined|u|strikethrough|st|obfuscated|obf|reset|gradient|rainbow|hover|click|font|newline|br)\b[^>]*>/i;

/** Guesses the format of pasted text. */
export function detectFormat(input: string): InputFormat {
  const s = input.trim();
  if (/^[[{"]/.test(s)) {
    try {
      JSON.parse(s);
      return "json";
    } catch {
      // Not JSON after all.
    }
  }
  // `<#RRGGBB>` alone is also a legacy plugin format; MiniMessage reads it the same way.
  if (MINIMESSAGE_TAG.test(s)) return "minimessage";
  return "legacy";
}

export function parse(input: string, format: InputFormat = detectFormat(input)): Span[] {
  switch (format) {
    case "json":
      return parseJson(input);
    case "minimessage":
      return parseMiniMessage(input);
    case "legacy":
      return parseLegacy(input);
  }
}

/** Every output the text tools offer, by id. */
export type OutputFormat =
  | "minimessage"
  | "legacy-hash"
  | "legacy-bungee"
  | "legacy-brace"
  | "legacy-angle"
  | "legacy-section"
  | "legacy-16"
  | "json"
  | "json-legacy";

export interface OutputFormatInfo {
  id: OutputFormat;
  label: string;
  example: string;
  /** Where this format is used, in a few words. */
  usedBy: string;
  /** Can show hover and click. */
  interactive: boolean;
}

export const OUTPUT_FORMATS: readonly OutputFormatInfo[] = [
  {
    id: "minimessage",
    label: "MiniMessage",
    example: "<#5CB4FF>",
    usedBy: "Paper, Velocity, most modern plugins",
    interactive: true,
  },
  {
    id: "legacy-hash",
    label: "&#RRGGBB",
    example: "&#5CB4FF",
    usedBy: "Essentials, CMI, LuckPerms prefixes",
    interactive: false,
  },
  {
    id: "legacy-bungee",
    label: "&x&R&R&G&G&B&B",
    example: "&x&5&C&B&4&F&F",
    usedBy: "Spigot, BungeeCord",
    interactive: false,
  },
  {
    id: "legacy-section",
    label: "§x§R§R§G§G§B§B",
    example: "§x§5§C§B§4§F§F",
    usedBy: "server.properties MOTD, raw config",
    interactive: false,
  },
  {
    id: "legacy-brace",
    label: "{#RRGGBB}",
    example: "{#5CB4FF}",
    usedBy: "TAB and others",
    interactive: false,
  },
  {
    id: "legacy-angle",
    label: "<#RRGGBB>",
    example: "<#5CB4FF>",
    usedBy: "Several plugins",
    interactive: false,
  },
  {
    id: "legacy-16",
    label: "& codes (16 colours)",
    example: "&b",
    usedBy: "Anything, including old versions",
    interactive: false,
  },
  {
    id: "json",
    label: "JSON (1.21.5+)",
    example: '{"text":…}',
    usedBy: "/tellraw, /title, signs, books",
    interactive: true,
  },
  {
    id: "json-legacy",
    label: "JSON (before 1.21.5)",
    example: '{"text":…}',
    usedBy: "/tellraw on older servers",
    interactive: true,
  },
];

export function serialize(spans: Span[], format: OutputFormat): string {
  const legacy = (hex: LegacyHexFormat, char: "&" | "§" = "&") => toLegacy(spans, { hex, char });
  switch (format) {
    case "minimessage":
      return toMiniMessage(spans);
    case "legacy-hash":
      return legacy("hash");
    case "legacy-bungee":
      return legacy("bungee");
    case "legacy-section":
      return legacy("bungee", "§");
    case "legacy-brace":
      return legacy("brace");
    case "legacy-angle":
      return legacy("angle");
    case "legacy-16":
      return legacy("none");
    case "json":
      return toJson(spans, { dialect: "modern" });
    case "json-legacy":
      return toJson(spans, { dialect: "legacy" });
  }
}
