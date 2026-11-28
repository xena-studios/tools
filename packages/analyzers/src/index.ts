import { type Context, type Finding, runRules } from "./engine.ts";
import { type ParsedLog, parseLog } from "./parse.ts";
import { Attributor, errorsByPlugin, type PluginErrors } from "./plugins.ts";
import { RULES } from "./rules.ts";
import { type Summary, summarise } from "./summary.ts";

export * from "./engine.ts";
export * from "./parse.ts";
export * from "./plugins.ts";
export * from "./rules.ts";
export * from "./summary.ts";

export interface Analysis {
  log: ParsedLog;
  summary: Summary;
  findings: Finding[];
  errors: PluginErrors[];
  /** Each entry's plugin (or mod), when it has one: what the log viewer filters on. */
  entryPlugins: (string | undefined)[];
  /** False when nothing in the text looks like a Minecraft log or crash report. */
  recognised: boolean;
}

/** Reads a log or crash report and finds what's wrong with it. */
export function analyse(text: string): Analysis {
  const log = parseLog(text);
  const summary = summarise(log);
  const attributor = new Attributor([
    ...summary.plugins.map((p) => p.name),
    ...(log.crash?.mods.map((m) => m.id) ?? []),
  ]);
  const byLine = log.lines;
  const ctx: Context = {
    log,
    summary,
    attributor,
    line: (n) => byLine[n - 1],
    entryAt: (n) => {
      const line = byLine[n - 1];
      return line ? log.entries[line.entry] : undefined;
    },
  };
  const findings = runRules(RULES, ctx);
  const errors = errorsByPlugin(log, attributor);
  const entryPlugins = log.entries.map((e) => attributor.entry(e));
  const timed = log.entries.filter((e) => e.time !== undefined).length;
  const recognised =
    log.crash !== undefined ||
    timed >= Math.min(3, log.entries.length) ||
    findings.length > 0 ||
    log.entries.some((e) => e.frames.length > 0);
  return { log, summary, findings, errors, entryPlugins, recognised };
}

/**
 * True when bytes look like text: no NUL bytes and few control characters.
 * A zip, an image or a .jar fails this.
 */
export function looksLikeText(sample: string): boolean {
  if (sample.includes("\u0000")) return false;
  let control = 0;
  const n = Math.min(sample.length, 64_000);
  for (let i = 0; i < n; i++) {
    const c = sample.charCodeAt(i);
    if ((c < 32 && c !== 9 && c !== 10 && c !== 13 && c !== 27) || c === 0xfffd) control++;
  }
  return n === 0 || control / n < 0.02;
}
