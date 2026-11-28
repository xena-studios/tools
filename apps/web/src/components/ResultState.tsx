// A lookup's outcome as a word beside a drawn shape, never colour alone:
// a ringed tick for online or found, the octagon for offline or missing, and
// the triangle for an answer we couldn't get (blocked, rate limited).

import { useEffect, useState } from "react";
import { SeverityIcon } from "./Severity";

export type ResultKind = "good" | "bad" | "warn";

const CLASS: Record<ResultKind, string> = {
  good: "text-text",
  bad: "text-[var(--danger)]",
  warn: "text-[var(--warning)]",
};

function Tick() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="inline-block size-[1em] shrink-0 text-accent"
    >
      <circle cx="8" cy="8" r="6.4" />
      <path d="M5.2 8.2l1.9 1.9 3.8-4" />
    </svg>
  );
}

export function ResultState({ kind, children }: { kind: ResultKind; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-2 text-sm font-semibold tracking-[0.08em] uppercase ${CLASS[kind]}`}
    >
      {kind === "good" ? (
        <Tick />
      ) : (
        <SeverityIcon severity={kind === "bad" ? "error" : "warning"} />
      )}
      {children}
    </span>
  );
}

/** Now, ticking every few seconds, for "checked 20 s ago". */
export function useNow(every = 5000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(id);
  }, [every]);
  return now;
}

export function ago(then: number, now: number): string {
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ago`;
}
