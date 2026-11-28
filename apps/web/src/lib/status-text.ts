// Turns what a server sends into spans for McText: a description that's a
// string with § codes or a JSON component (whose text can hold § codes too, which
// the game still draws), and names in the player sample.

import { normalize, parseJson, parseLegacy, type Span } from "@xena-tools/mc-text";

/** § codes only: the game doesn't read & in a status. */
export const legacySpans = (text: string): Span[] => parseLegacy(text, { chars: "§" });

/** A span whose text holds § codes, split with its own style as the base. */
function expandLegacy(span: Span): Span[] {
  if (!span.text.includes("§")) return [span];
  return legacySpans(span.text).map((inner) => {
    // A colour code resets decorations, as the game does, but keeps hover and
    // click; text with no code keeps the component's own style.
    const style = inner.style.color
      ? { ...inner.style, hover: span.style.hover, click: span.style.click }
      : { ...span.style, ...inner.style };
    return { text: inner.text, style };
  });
}

export function descriptionSpans(description: unknown): Span[] {
  if (typeof description === "string") return legacySpans(description);
  if (description === null || typeof description !== "object") return [];
  try {
    return normalize(parseJson(JSON.stringify(description)).flatMap(expandLegacy));
  } catch {
    return [];
  }
}

/** The description as plain text, for a screen reader or a title. */
export const plain = (spans: Span[]): string => spans.map((s) => s.text).join("");
