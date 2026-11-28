// Severity as a word and a drawn shape, never colour alone: an octagon for an
// error, a triangle for a warning, a circle for a note. Same 1.4 stroke as the
// External arrow, in currentColor.

import type { Severity } from "@xena-tools/analyzers";

export const SEVERITY_WORD: Record<Severity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Note",
};

export const SEVERITY_PLURAL: Record<Severity, [string, string]> = {
  error: ["error", "errors"],
  warning: ["warning", "warnings"],
  info: ["note", "notes"],
};

export const SEVERITY_CLASS: Record<Severity, string> = {
  error: "text-[var(--danger)]",
  warning: "text-[var(--warning)]",
  info: "text-muted",
};

export function SeverityIcon({
  severity,
  className = "",
}: {
  severity: Severity;
  className?: string;
}) {
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
      className={`inline-block size-[1em] shrink-0 ${className}`}
    >
      {severity === "error" && (
        <>
          <path d="M5.3 1.7h5.4l3.6 3.6v5.4l-3.6 3.6H5.3l-3.6-3.6V5.3z" />
          <path d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2" />
        </>
      )}
      {severity === "warning" && (
        <>
          <path d="M8 1.9l6.6 11.6H1.4z" />
          <path d="M8 6.4v3.4" />
          <path d="M8 11.7v.1" strokeWidth="1.8" />
        </>
      )}
      {severity === "info" && (
        <>
          <circle cx="8" cy="8" r="6.4" />
          <path d="M8 7.3v4" />
          <path d="M8 4.8v.1" strokeWidth="1.8" />
        </>
      )}
    </svg>
  );
}

/** The severity's word beside its shape, in its colour. */
export function SeverityLabel({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] uppercase ${SEVERITY_CLASS[severity]}`}
    >
      <SeverityIcon severity={severity} />
      {SEVERITY_WORD[severity]}
    </span>
  );
}
