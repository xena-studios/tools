import { useEffect, useRef, useState } from "react";

export function CopyButton({
  value,
  label = "Copy",
  quiet = false,
}: {
  value: string;
  label?: string;
  /** A hairline pill instead of solid Ion Blue, where one view has several. */
  quiet?: boolean;
}) {
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
    <button
      type="button"
      className={`button compact shrink-0 ${quiet ? "" : "primary"}`}
      onClick={copy}
      aria-live="polite"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

interface OutputProps {
  label: string;
  value: string;
  hint?: string;
  warning?: string;
  /** On a phone, keep this output's copy button in a bar while it's off screen. One per page. */
  phoneBar?: boolean;
  /** A hairline Copy pill, for a second output in the same view. */
  quiet?: boolean;
}

/** True while the element is off screen. */
export function useOffscreen(ref: React.RefObject<HTMLElement | null>) {
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOffscreen(!entry?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return offscreen;
}

/**
 * On a phone the output sits below the controls, so while it's off screen this
 * bar at the bottom keeps its action (Copy, Download) in reach.
 */
export function PhoneBar({
  show,
  label,
  children,
}: {
  show: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-rule bg-bg/90 backdrop-blur-md lg:hidden">
      <div className="wrap flex min-h-16 items-center justify-between gap-4">
        <span className="min-w-0 truncate text-sm">
          <span className="text-muted">Output: </span>
          {label}
        </span>
        {children}
      </div>
    </div>
  );
}

/** A read-only result with its copy button. */
export function Output({
  label,
  value,
  hint,
  warning,
  phoneBar = true,
  quiet = false,
}: OutputProps) {
  const panel = useRef<HTMLDivElement>(null);
  const offscreen = useOffscreen(panel);

  return (
    <div ref={panel} className="panel p-4">
      <PhoneBar show={phoneBar && offscreen} label={label}>
        <CopyButton value={value} />
      </PhoneBar>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-normal">{label}</h3>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        <CopyButton value={value} quiet={quiet} />
      </div>
      <pre className="max-h-48 overflow-auto rounded-lg bg-bg p-3 text-sm break-all whitespace-pre-wrap select-all">
        {value || " "}
      </pre>
      {warning && <p className="mt-2 text-xs text-muted">{warning}</p>}
    </div>
  );
}
