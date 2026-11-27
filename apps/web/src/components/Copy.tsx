import { useEffect, useRef, useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (an iframe or an old browser): the text is selectable instead.
    }
  };

  return (
    <button type="button" className="btn shrink-0" onClick={copy} aria-live="polite">
      {copied ? "Copied" : label}
    </button>
  );
}

interface OutputProps {
  label: string;
  value: string;
  hint?: string;
  warning?: string;
}

/** A read-only result with its copy button. */
export function Output({ label, value, hint, warning }: OutputProps) {
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-normal">{label}</h3>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        <CopyButton value={value} />
      </div>
      <pre className="max-h-48 overflow-auto rounded-lg bg-bg p-3 text-sm break-all whitespace-pre-wrap select-all">
        {value || " "}
      </pre>
      {warning && <p className="mt-2 text-xs text-muted">{warning}</p>}
    </div>
  );
}
