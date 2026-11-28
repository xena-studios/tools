// The log, filtered by level and plugin. Only the rows in view (and a few either
// side) are in the DOM, so 50,000 lines scroll as smoothly as 50.

import type { Analysis, Level } from "@xena-tools/analyzers";
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { type FormatOption, FormatPicker } from "./FormatPicker";
import { SeverityIcon } from "./Severity";

export type LevelFilter = "all" | "warn" | "error";

const LEVEL_OPTIONS: FormatOption<LevelFilter>[] = [
  { id: "all", label: "All lines", usedBy: "Every line of the log" },
  { id: "warn", label: "Warnings and errors", usedBy: "WARN, ERROR and their stack traces" },
  { id: "error", label: "Errors", usedBy: "ERROR and FATAL, with their stack traces" },
];

const ROW = 24; // px: one line at text-xs with 1.5rem leading
const OVERSCAN = 30;
const ALL = "";

export interface LogViewerHandle {
  /** Shows a line: clears the filters that hide it, scrolls to it and marks it. */
  show(n: number): void;
  /** Filters to one plugin's errors. */
  showPlugin(name: string): void;
}

const passes = (level: Level | undefined, filter: LevelFilter) =>
  filter === "all" || level === "error" || (filter === "warn" && level === "warn");

export function LogViewer({
  analysis,
  ref,
}: {
  analysis: Analysis;
  ref?: React.Ref<LogViewerHandle>;
}) {
  const { log, entryPlugins } = analysis;
  const [level, setLevel] = useState<LevelFilter>("all");
  const [plugin, setPlugin] = useState<string>(ALL);
  const [marked, setMarked] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(480);
  const box = useRef<HTMLElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const ids = useId();

  const plugins = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of log.entries) {
      const p = entryPlugins[e.index];
      if (p) counts.set(p, (counts.get(p) ?? 0) + e.end - e.start + 1);
    }
    return [...counts.keys()].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  }, [log, entryPlugins]);

  /** Indexes into log.lines that pass the filters. */
  const rows = useMemo(() => {
    if (level === "all" && plugin === ALL) return null; // every line: no array needed
    const out: number[] = [];
    for (let i = 0; i < log.lines.length; i++) {
      const line = log.lines[i];
      if (!line) continue;
      const entry = log.entries[line.entry];
      if (!passes(entry?.level, level)) continue;
      if (plugin !== ALL && entryPlugins[line.entry] !== plugin) continue;
      out.push(i);
    }
    return out;
  }, [log, entryPlugins, level, plugin]);

  const count = rows ? rows.length : log.lines.length;
  const at = (i: number) => (rows ? rows[i] : i);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    setHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // After a filter change from show(), scroll once the new rows are in place.
  useEffect(() => {
    const target = pendingScroll.current;
    const el = box.current;
    if (target === null || !el) return;
    pendingScroll.current = null;
    const index = rows ? rows.indexOf(target - 1) : target - 1;
    if (index < 0) return;
    el.scrollTop = Math.max(0, index * ROW - el.clientHeight / 3);
    setScrollTop(el.scrollTop);
  }, [rows]);

  const scrollToLine = useCallback(
    (n: number) => {
      setMarked(n);
      const entry = log.entries[log.lines[n - 1]?.entry ?? -1];
      const hidden =
        !passes(entry?.level, level) ||
        (plugin !== ALL && entryPlugins[log.lines[n - 1]?.entry ?? -1] !== plugin);
      pendingScroll.current = n;
      if (hidden) {
        setLevel("all");
        setPlugin(ALL);
      } else {
        // Same rows: scroll now.
        const el = box.current;
        const index = rows ? rows.indexOf(n - 1) : n - 1;
        if (el && index >= 0) {
          el.scrollTop = Math.max(0, index * ROW - el.clientHeight / 3);
          setScrollTop(el.scrollTop);
        }
        pendingScroll.current = null;
      }
      box.current?.scrollIntoView({ block: "start" });
      box.current?.focus({ preventScroll: true });
    },
    [log, entryPlugins, level, plugin, rows],
  );

  useImperativeHandle(
    ref,
    () => ({
      show: scrollToLine,
      showPlugin(name: string) {
        setLevel("warn");
        setPlugin(name);
        setMarked(null);
        if (box.current) box.current.scrollTop = 0;
        setScrollTop(0);
        box.current?.scrollIntoView({ block: "start" });
      },
    }),
    [scrollToLine],
  );

  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const last = Math.min(count, Math.ceil((scrollTop + height) / ROW) + OVERSCAN);
  const digits = String(log.lines.length).length;

  const visible: React.ReactNode[] = [];
  for (let i = first; i < last; i++) {
    const index = at(i);
    if (index === undefined) continue;
    const line = log.lines[index];
    if (!line) continue;
    const entry = log.entries[line.entry];
    const head = entry?.start === line.n;
    const lvl = entry?.level;
    visible.push(
      <div
        key={line.n}
        className={`log-row ${line.n === marked ? "log-row-marked" : ""}`}
        style={{ top: i * ROW }}
      >
        <span className="log-gutter" style={{ width: `${digits + 3}ch` }}>
          <span className="log-icon">
            {head && lvl === "error" && (
              <SeverityIcon severity="error" className="text-[var(--danger)]" />
            )}
            {head && lvl === "warn" && (
              <SeverityIcon severity="warning" className="text-[var(--warning)]" />
            )}
          </span>
          {line.n}
        </span>
        <span className="log-text">{line.text || " "}</span>
      </div>,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <FormatPicker label="Show" options={LEVEL_OPTIONS} value={level} onChange={setLevel} />
        {plugins.length > 0 && (
          <label className="block">
            <span className="label mb-2 block">From</span>
            <select
              id={`${ids}-plugin`}
              className="field select min-w-48"
              value={plugin}
              onChange={(e) => setPlugin(e.target.value)}
            >
              <option value={ALL}>Every plugin and the server</option>
              {plugins.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="pb-2 text-sm text-muted tabular-nums" aria-live="polite">
          {count === log.lines.length
            ? `${log.lines.length.toLocaleString("en-GB")} lines`
            : `${count.toLocaleString("en-GB")} of ${log.lines.length.toLocaleString("en-GB")} lines`}
        </p>
      </div>
      <section
        ref={box}
        className="log-view"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must take focus so the keyboard can scroll it
        tabIndex={0}
        aria-label="Log lines"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      >
        {count === 0 ? (
          <p className="p-4 text-sm text-muted">No lines match these filters.</p>
        ) : (
          <div className="relative" style={{ height: count * ROW }}>
            {visible}
          </div>
        )}
      </section>
    </div>
  );
}
