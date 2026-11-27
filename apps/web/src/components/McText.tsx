// Draws spans the way the game does: its colours, the quarter-brightness drop
// shadow, decorations, obfuscated text that churns, and hover text on hover.

import { type Span, shadowOf } from "@xena-tools/mc-text";
import { useEffect, useState } from "react";

const OBFUSCATE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*+=?@";

function scramble(text: string): string {
  return Array.from(text, (c) =>
    /\s/.test(c) ? c : (OBFUSCATE_CHARS[Math.floor(Math.random() * OBFUSCATE_CHARS.length)] ?? c),
  ).join("");
}

function Obfuscated({ text }: { text: string }) {
  // The first render matches the server's HTML; the churn starts after hydration.
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(scramble(text));
      return;
    }
    const id = window.setInterval(() => setShown(scramble(text)), 60);
    return () => window.clearInterval(id);
  }, [text]);
  return <>{shown}</>;
}

function SpanView({ span, fallback }: { span: Span; fallback: string }) {
  const s = span.style;
  const color = s.color ?? fallback;
  const classes = [
    "mc-span",
    s.bold && "mc-bold",
    s.italic && "mc-italic",
    s.underlined && "mc-underlined",
    s.strikethrough && "mc-strikethrough",
    (s.hover || s.click) && "mc-hover",
  ]
    .filter(Boolean)
    .join(" ");
  const title = s.click
    ? `Click: ${s.click.action.replace(/_/g, " ")} ${s.click.value}`
    : undefined;
  const content = s.obfuscated ? <Obfuscated text={span.text} /> : span.text;

  const style = { color, "--shadow": shadowOf(color) } as React.CSSProperties;

  if (!s.hover) {
    return (
      <span className={classes} style={style} title={title}>
        {content}
      </span>
    );
  }
  return (
    <span className="group relative">
      <span className={classes} style={style} title={title}>
        {content}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-max max-w-xs rounded-[3px] border-2 border-[#25015B] bg-[#100010]/95 px-2 py-1 group-hover:block"
      >
        <McLine spans={s.hover} />
      </span>
    </span>
  );
}

/** One run of Minecraft text, inline. */
export function McLine({ spans, fallback = "#FFFFFF" }: { spans: Span[]; fallback?: string }) {
  return (
    <>
      {spans.map((span, i) => (
        // Spans have no identity beyond their position.
        // biome-ignore lint/suspicious/noArrayIndexKey: order is the identity here
        <SpanView key={i} span={span} fallback={fallback} />
      ))}
    </>
  );
}

export type McBackground = "chat" | "dirt" | "none";

interface McTextProps {
  spans: Span[];
  /** Colour of text with no colour set: white in chat, gray in the server list. */
  fallback?: string;
  shadow?: boolean;
  background?: McBackground;
  className?: string;
  /** Shown when there's nothing to draw. */
  empty?: string;
}

const BACKGROUNDS: Record<McBackground, string> = {
  // Chat draws on a translucent black box.
  chat: "bg-black/50",
  // A plain dark stand-in for the menu backdrop, with no game textures.
  dirt: "bg-[#2B2118]",
  none: "",
};

export function McText({
  spans,
  fallback = "#FFFFFF",
  shadow = true,
  background = "chat",
  className = "",
  empty = "Nothing to show yet",
}: McTextProps) {
  const hasText = spans.some((s) => s.text.trim() !== "");
  return (
    <div
      className={`mc ${shadow ? "mc-shadow" : ""} ${BACKGROUNDS[background]} rounded-md px-3 py-2 text-lg ${className}`}
    >
      {hasText ? (
        <McLine spans={spans} fallback={fallback} />
      ) : (
        <span className="text-white/35">{empty}</span>
      )}
    </div>
  );
}
