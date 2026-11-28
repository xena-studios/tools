// Reads a Minecraft server log or crash report into lines and entries.
//
// A line is one line of the file. An entry is one logged message: the line that
// starts with a timestamp, plus every line after it that doesn't (a stack trace,
// a multi-line message, a thread dump). Rules read lines; "errors by plugin" and
// the log viewer's filters read entries.

export type Level = "error" | "warn" | "info" | "debug";

export interface LogLine {
  /** 1-based, as an editor shows it. */
  n: number;
  /** The line as written, without ANSI colour codes. */
  text: string;
  /** The index of the entry this line belongs to. */
  entry: number;
}

export interface Entry {
  index: number;
  /** Line numbers (1-based) of the first and last line. */
  start: number;
  end: number;
  time?: string;
  level?: Level;
  /** The level as written: INFO, WARN, SEVERE… */
  rawLevel?: string;
  thread?: string;
  /** The logger, when the format names it (Fabric, Forge, Velocity's file log). */
  logger?: string;
  /** The first line's message, after the timestamp and level. */
  message: string;
  /** The lines after the first: a stack trace or the rest of the message. */
  rest: string[];
  /** The first exception named in the entry, like java.lang.NullPointerException. */
  exception?: string;
  /** Stack frames ("at a.b.C.d(C.java:1)"), as class.method. */
  frames: string[];
}

export interface CrashReport {
  /** The line the report starts on. */
  start: number;
  time?: string;
  description?: string;
  /** The first line of the stack trace under the description. */
  exception?: string;
  /** "-- System Details --" keys and values, like "Minecraft Version". */
  details: Record<string, string>;
  /** Fabric's or Forge's mod list, when the report has one. */
  mods: { id: string; name?: string; version?: string }[];
}

export interface ParsedLog {
  kind: "log" | "crash-report";
  lines: LogLine[];
  entries: Entry[];
  crash?: CrashReport;
}

// ANSI colour codes, which consoles and panels (Pterodactyl, Multicraft) leave in.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching the escape character is the point
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

const LEVELS: Record<string, Level> = {
  FATAL: "error",
  SEVERE: "error",
  ERROR: "error",
  WARN: "warn",
  WARNING: "warn",
  INFO: "info",
  CONFIG: "info",
  DEBUG: "debug",
  TRACE: "debug",
  FINE: "debug",
  FINER: "debug",
  FINEST: "debug",
};

const LEVEL = "FATAL|SEVERE|ERROR|WARN|WARNING|INFO|CONFIG|DEBUG|TRACE|FINE|FINER|FINEST";

/**
 * The header of a log line, in every format servers write:
 *   [12:00:00 INFO]: msg                                    Paper, Spigot, Velocity consoles
 *   [12:00:00] [Server thread/INFO]: msg                    vanilla, Paper's latest.log
 *   [12:00:00] [main/INFO] [minecraft/DedicatedServer]: msg Fabric, Velocity's file log
 *   [27Nov2026 12:00:00.123] [main/INFO] [net.minecraftforge…/]: msg   Forge, NeoForge
 *   [2026-11-27 12:00:00] [Server thread/INFO]: msg         panels that add the date
 *   [12:00:00] [main/INFO] (FabricLoader) msg               Fabric's own console format
 */
const HEADER = new RegExp(
  String.raw`^\[(?:[^\]\d]*\d[^\]]*?[ T])?(\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)(?: (${LEVEL}))?\]` +
    String.raw`(?: ?\[([^\]]*)\/(${LEVEL})\])?` +
    String.raw`(?: ?\[([^\]]+)\](?=:)| \(([^)]+)\)(?= ))?` +
    ":? ?(.*)$",
);

/** A line Java prints when a stack trace starts: "java.lang.Foo: msg", "Caused by: …". */
const EXCEPTION =
  /^(?:Exception in thread "[^"]*" |Caused by: |Suppressed: |\t*)?((?:[a-zA-Z_$][\w$]*\.)+[A-Z][\w$]*(?:Exception|Error|Throwable|Failure))(?::|$| )/;
const FRAME = /^\s+at (?:[\w.$-]*(?:@[^/]*)?\/)*([\w$.<>]+)\(/;
/** Lines in a watchdog thread dump: "\t\tcom.example.Foo.bar(Foo.java:10)". */
const DUMP_FRAME = /^\s+(?:[\w.$-]*(?:@[^/]*)?\/)*((?:[a-zA-Z_$][\w$]*\.)+[\w$<>]+)\([^)]*\)\s*$/;

/** The first line of a watchdog report, whose thread dump follows a line at a time. */
const DUMP_START =
  /^(?:-{20,}|The server has (?:stopped responding|not responded for)|--- DO NOT REPORT THIS TO PAPER)/;

export function exceptionOf(line: string): string | undefined {
  return EXCEPTION.exec(line)?.[1];
}

export function frameOf(line: string): string | undefined {
  return FRAME.exec(line)?.[1] ?? DUMP_FRAME.exec(line)?.[1];
}

export function parseLog(input: string): ParsedLog {
  // One trailing newline is the file's end, not an empty line.
  const raw = input.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const lines: LogLine[] = [];
  const entries: Entry[] = [];
  let current: Entry | undefined;
  let dump = false;

  const open = (n: number, fields: Partial<Entry> & { message: string }): Entry => {
    const entry: Entry = {
      index: entries.length,
      start: n,
      end: n,
      rest: [],
      frames: [],
      ...fields,
    };
    entry.exception = exceptionOf(entry.message);
    entries.push(entry);
    return entry;
  };

  for (let i = 0; i < raw.length; i++) {
    const n = i + 1;
    const text = (raw[i] ?? "").replace(ANSI, "").replace(/^> ?(?=\[)/, "");
    const m = HEADER.exec(text);
    const rawLevel = m ? (m[2] ?? m[4]) : undefined;
    const message = m?.[7] ?? "";
    if (m && current && dump && current.rawLevel === rawLevel && current.thread === m[3]) {
      // A watchdog's thread dump is logged a line at a time; it's one message.
      current.rest.push(message);
      current.end = n;
      const frame = frameOf(message);
      if (frame) current.frames.push(frame);
    } else if (m) {
      dump = DUMP_START.test(message);
      current = open(n, {
        time: m[1],
        rawLevel,
        level: rawLevel ? LEVELS[rawLevel] : undefined,
        thread: m[3],
        logger: m[5] ?? m[6],
        message,
      });
    } else if (
      !current ||
      // Text before the first timestamp (the JVM's own errors) starts its own entry
      // at each exception, so "Error: …" and the trace after it stay apart.
      (current.time === undefined && /^(?:Exception in thread|Error: )/.test(text))
    ) {
      current = open(n, { message: text });
    } else {
      current.rest.push(text);
      current.end = n;
      current.exception ??= exceptionOf(text);
      const frame = frameOf(text);
      if (frame) current.frames.push(frame);
    }
    lines.push({ n, text, entry: current.index });
  }

  const crashAt = lines.findIndex((l) => l.text.includes("---- Minecraft Crash Report ----"));
  const crash = crashAt === -1 ? undefined : parseCrash(lines.slice(crashAt));
  if (crash) {
    // A crash report has no timestamps, so it's one entry; say it's an error, which it is.
    const entry = entries[lines[crashAt]?.entry ?? -1];
    if (entry && entry.level === undefined) {
      entry.level = "error";
      entry.rawLevel = "FATAL";
    }
  }
  const first = raw.find((l) => l.trim() !== "") ?? "";
  return {
    kind: first.includes("---- Minecraft Crash Report ----") ? "crash-report" : "log",
    lines,
    entries,
    crash,
  };
}

function parseCrash(lines: LogLine[]): CrashReport {
  const report: CrashReport = { start: lines[0]?.n ?? 1, details: {}, mods: [] };
  let inDetails = false;
  let key: string | undefined;
  let afterDescription = false;

  for (const { text } of lines) {
    if (!inDetails) {
      const time = /^Time: (.+)$/.exec(text);
      if (time) report.time = time[1];
      const desc = /^Description: (.+)$/.exec(text);
      if (desc) {
        report.description = desc[1]?.trim();
        afterDescription = true;
        continue;
      }
      if (afterDescription && text.trim()) {
        report.exception ??= exceptionOf(text) ?? text.trim();
        afterDescription = false;
      }
      if (/^-- System Details --/.test(text)) inDetails = true;
      continue;
    }
    // "\tKey: value" is a detail; deeper indents belong to the key above (mod lists).
    const kv = /^\t([^\t:][^:]*): ?(.*)$/.exec(text);
    if (kv?.[1]) {
      key = kv[1].trim();
      report.details[key] = (kv[2] ?? "").trim();
      continue;
    }
    if (!key || !/^\t\t/.test(text)) continue;
    if (key === "Fabric Mods") {
      // "\t\tfabric-api: Fabric API 0.92.2+1.20.1"; nested mods (three tabs) are parts of one.
      const mod = /^\t\t([\w.-]+): (.+?)(?: (\S+))?$/.exec(text);
      if (mod?.[1] && !/^\t\t\t/.test(text))
        report.mods.push({ id: mod[1], name: mod[2], version: mod[3] });
    } else if (key === "Mod List" || key === "Mods") {
      // Forge: "\t\tfile.jar |Name |modid |1.0 |DONE |Manifest: …"
      const cells = text.split("|").map((c) => c.trim());
      if (cells.length >= 4 && cells[2])
        report.mods.push({ id: cells[2], name: cells[1], version: cells[3] });
    }
  }
  return report;
}

export function levelOf(word: string | undefined): Level | undefined {
  return word ? LEVELS[word.toUpperCase()] : undefined;
}
