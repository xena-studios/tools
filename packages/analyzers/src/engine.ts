// The rule engine. A rule is data: what to look for, and what to tell the reader
// when it's there. Captured values ({plugin}, {port}…) fill in the words.

import type { Entry, LogLine, ParsedLog } from "./parse.ts";
import type { Attributor } from "./plugins.ts";
import type { Summary } from "./summary.ts";

export type Severity = "error" | "warning" | "info";

export const SEVERITIES: readonly Severity[] = ["error", "warning", "info"];

export interface Link {
  label: string;
  url: string;
}

export type Vars = Record<string, string | number | undefined>;

export interface Context {
  log: ParsedLog;
  summary: Summary;
  attributor: Attributor;
  /** The line with this 1-based number. */
  line(n: number): LogLine | undefined;
  /** The entry a 1-based line number belongs to. */
  entryAt(n: number): Entry | undefined;
}

/** One place a rule matched: the lines that show it and the values it found. */
export interface Hit {
  lines: number[];
  vars?: Vars;
  /** Hits with the same key become one finding. Defaults to the rule's key template. */
  key?: string;
}

export interface Rule {
  id: string;
  /** May use {vars}: "{plugin} couldn't be enabled". */
  title: string;
  severity: Severity | ((vars: Vars) => Severity);
  /**
   * A regex tested against every line (named groups become vars), or a function
   * over the whole log for rules that count, pair lines up or read a crash report.
   */
  match: RegExp | ((ctx: Context) => Hit[]);
  /** Words every matching line contains, checked before the regex, for speed. */
  hint?: string | string[];
  /** For regex rules: hits whose key (a template) is the same merge into one finding. */
  key?: string;
  /** Turns a regex hit's captures into the vars the words use. */
  vars?: (groups: Vars, ctx: Context, line: LogLine) => Vars | null;
  explain: string;
  /** The steps of the fix, in order. */
  fix: string[];
  links: Link[];
  /** Rules that, when found, already explain this one. */
  unless?: string[];
}

export interface Finding {
  /** Unique: the rule's id and its key. */
  id: string;
  rule: string;
  severity: Severity;
  title: string;
  explanation: string;
  fix: string[];
  links: Link[];
  /** How many times it happened. */
  count: number;
  /** The lines that matched. */
  lines: number[];
  /** The lines to show: the matches and the start of their stack traces. */
  context: number[];
  vars: Vars;
}

/** Fills {name} from vars; a missing value is left empty. */
export function fill(template: string, vars: Vars): string {
  return template
    .replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = vars[k];
      return v === undefined ? "" : String(v);
    })
    .replace(/ {2,}/g, " ")
    .replace(/ ([,.:;)])/g, "$1")
    .trim();
}

const CONTEXT_PER_HIT = 6;
const CONTEXT_MAX = 80;

function regexHits(rule: Rule, re: RegExp, ctx: Context): Hit[] {
  const hints = rule.hint === undefined ? [] : [rule.hint].flat();
  const hits: Hit[] = [];
  for (const line of ctx.log.lines) {
    if (hints.length && !hints.some((h) => line.text.includes(h))) continue;
    const m = re.exec(line.text);
    if (!m) continue;
    let vars: Vars | null = { ...m.groups };
    if (vars.plugin === undefined) {
      const entry = ctx.entryAt(line.n);
      if (entry) vars.plugin = ctx.attributor.entry(entry);
    } else {
      vars.plugin = ctx.attributor.canonical(String(vars.plugin));
    }
    if (rule.vars) vars = rule.vars(vars, ctx, line);
    if (!vars) continue;
    hits.push({ lines: [line.n], vars, key: rule.key ? fill(rule.key, vars) : undefined });
  }
  return hits;
}

function contextOf(lines: number[], ctx: Context): number[] {
  const out = new Set<number>();
  for (const n of lines) {
    const entry = ctx.entryAt(n);
    const end = Math.min(entry?.end ?? n, n + CONTEXT_PER_HIT - 1);
    for (let i = n; i <= end && out.size < CONTEXT_MAX; i++) out.add(i);
    if (out.size >= CONTEXT_MAX) break;
  }
  return [...out].sort((a, b) => a - b);
}

export function runRules(rules: readonly Rule[], ctx: Context): Finding[] {
  const found = new Map<string, Finding>();
  const byRule = new Set<string>();

  for (const rule of rules) {
    const hits = rule.match instanceof RegExp ? regexHits(rule, rule.match, ctx) : rule.match(ctx);
    for (const hit of hits) {
      const key = hit.key ?? "";
      const id = key ? `${rule.id}:${key}` : rule.id;
      const existing = found.get(id);
      if (existing) {
        existing.count++;
        existing.lines.push(...hit.lines);
        continue;
      }
      const vars = hit.vars ?? {};
      found.set(id, {
        id,
        rule: rule.id,
        severity: typeof rule.severity === "function" ? rule.severity(vars) : rule.severity,
        title: "",
        explanation: "",
        fix: [],
        links: rule.links,
        count: 1,
        lines: [...hit.lines],
        context: [],
        vars,
      });
      byRule.add(rule.id);
    }
  }

  const rulesById = new Map(rules.map((r) => [r.id, r]));
  const out: Finding[] = [];
  for (const f of found.values()) {
    const rule = rulesById.get(f.rule);
    if (!rule) continue;
    if (rule.unless?.some((id) => byRule.has(id))) continue;
    // A function rule that gathers many lines into one hit counts the lines.
    const count = f.count > 1 ? f.count : Math.max(1, Number(f.vars.count ?? f.count));
    f.count = count;
    const vars: Vars = { ...f.vars, count, times: count === 1 ? "once" : `${count} times` };
    f.vars = vars;
    f.title = fill(rule.title, vars);
    f.explanation = fill(rule.explain, vars);
    f.fix = rule.fix.map((s) => fill(s, vars)).filter(Boolean);
    f.lines = [...new Set(f.lines)].sort((a, b) => a - b);
    f.context = contextOf(f.lines, ctx);
    out.push(f);
  }

  const rank = (s: Severity) => SEVERITIES.indexOf(s);
  return out.sort(
    (a, b) => rank(a.severity) - rank(b.severity) || (a.lines[0] ?? 0) - (b.lines[0] ?? 0),
  );
}
