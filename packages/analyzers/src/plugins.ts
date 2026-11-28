// biome-ignore-all lint/suspicious/noAssignInExpressions: each line is tried against a chain of patterns, and the match is kept
// Which plugin (or mod) an error belongs to, from what the log line says, the
// thread it ran on, or the first frame of its stack trace that isn't the server's.

import { type Entry, frameOf, type ParsedLog } from "./parse.ts";

/** Packages that belong to the server, Java or the loaders, never to a plugin. */
const SERVER_PACKAGES = [
  "java.",
  "javax.",
  "jdk.",
  "sun.",
  "com.sun.",
  "net.minecraft.",
  "com.mojang.",
  "org.bukkit.",
  "org.spigotmc.",
  "io.papermc.",
  "com.destroystokyo.",
  "co.aikar.timings.",
  "ca.spottedleaf.",
  "org.purpurmc.",
  "gg.pufferfish.",
  "net.md_5.",
  "com.velocitypowered.",
  "io.netty.",
  "com.google.",
  "org.apache.",
  "org.slf4j.",
  "net.kyori.",
  "it.unimi.",
  "org.yaml.",
  "org.jline.",
  "net.minecrell.",
  "net.fabricmc.",
  "org.spongepowered.",
  "org.objectweb.",
  "com.llamalad7.mixinextras.",
  "cpw.mods.",
  "net.minecraftforge.",
  "net.neoforged.",
  "org.quiltmc.",
  "kotlin.",
  "kotlinx.",
  "org.jetbrains.",
];

/** Bracketed names at the start of a message that are the server talking, not a plugin. */
const SERVER_TAGS = new Set(
  [
    "stdout",
    "stderr",
    "bootstrap",
    "modernpluginloadingstrategy",
    "legacypluginloadingstrategy",
    "pluginremapper",
    "pluginInitializerManager",
    "spigotlibraryloader",
    "paperpluginloader",
    "minecraft",
    "server",
    "craftbukkit",
    "paper",
    "spigot",
    "velocity",
    "watchdog",
    "authlib",
    "chunktaskscheduler",
    "moonrise",
    "connected player",
    "server connection",
    "initial connection",
    "spark",
  ].map((s) => s.toLowerCase()),
);

/** Libraries plugins bundle: a frame in one is called by the plugin further down. */
const LIBRARY_PACKAGES = [
  "com.mysql.",
  "org.mariadb.",
  "org.postgresql.",
  "org.sqlite.",
  "org.h2.",
  "com.zaxxer.hikari.",
  "okhttp3.",
  "okio.",
  "redis.clients.",
  "io.lettuce.",
  "com.mongodb.",
  "org.bson.",
  "com.fasterxml.",
  "org.json.",
];

export const isServerClass = (cls: string) => SERVER_PACKAGES.some((p) => cls.startsWith(p));
const isLibraryClass = (cls: string) => LIBRARY_PACKAGES.some((p) => cls.startsWith(p));

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A plugin's name from a jar file name: "EssentialsX-2.20.1.jar" -> "EssentialsX". */
export function nameFromJar(jar: string): string {
  return jar.replace(/\.jar$/i, "").replace(/[-_ ]?v?\d[\w.+-]*$/i, "") || jar;
}

export class Attributor {
  private readonly known: { name: string; key: string }[];

  constructor(names: string[]) {
    this.known = [...new Set(names)]
      .map((name) => ({ name, key: norm(name) }))
      .filter((k) => k.key.length >= 3)
      // Longer names first, so "WorldEditSUI" wins over "WorldEdit".
      .sort((a, b) => b.key.length - a.key.length);
  }

  /** A known plugin's name as the log writes it, or the name given. */
  canonical(name: string): string {
    const key = norm(name);
    return this.known.find((k) => k.key === key)?.name ?? name;
  }

  /** A plugin in the log's plugin list that a class belongs to: me.lucko.luckperms -> LuckPerms. */
  knownFromClass(cls: string): string | undefined {
    if (isServerClass(cls)) return undefined;
    const parts = cls.split(".").slice(0, -2).map(norm);
    for (const k of this.known) {
      if (parts.some((p) => p === k.key || (p.length >= 6 && k.key.startsWith(p)))) return k.name;
    }
    return undefined;
  }

  /** The plugin a class belongs to, or its package when the plugin isn't in the log. */
  fromClass(cls: string): string | undefined {
    if (isServerClass(cls)) return undefined;
    const known = this.knownFromClass(cls);
    if (known) return known;
    const pkg = cls.split(".").slice(0, -2);
    return pkg.length ? pkg.slice(0, Math.min(3, pkg.length)).join(".") : undefined;
  }

  /**
   * The plugin a stack trace points at: the first frame that's a known plugin's, else
   * the first that isn't the server's or a shared library's (a database driver is
   * called by the plugin below it).
   */
  fromFrames(frames: string[]): string | undefined {
    let fallback: string | undefined;
    for (const f of frames) {
      // A mixin method is named after the mod that added it: "handler$zza000$sodium$onTick".
      const mixin = /\$[a-z]{3}\d{3}\$([a-z][\w-]*)\$/.exec(f.split(".").at(-1) ?? "");
      if (mixin?.[1]) return this.canonical(mixin[1]);
      if (isServerClass(f)) continue;
      const known = this.knownFromClass(f);
      if (known) return known;
      if (!fallback && !isLibraryClass(f)) fallback = this.fromClass(f);
    }
    return fallback;
  }

  /** The plugin an entry is about, or undefined when it's the server's own. */
  entry(e: Entry): string | undefined {
    const m = e.message;
    if (e.rest.some((l) => l.startsWith("Current Thread: Server thread")))
      return suspectInDump(e.rest, this)?.plugin;
    // A mixin failure names its config, and the config is named after its mod.
    const mixinConfig = e.rest
      .map((l) => /Mixin \[([\w-]+?)\.mixins?[\w.-]*\.json:/.exec(l)?.[1])
      .find(Boolean);
    if (mixinConfig) return this.canonical(mixinConfig);
    let r: RegExpExecArray | null;
    if ((r = /^Error occurred while (?:enabling|disabling|loading) (\S+)/.exec(m)))
      return this.canonical(r[1] ?? "");
    if ((r = /^Could not pass event \S+ to (\S+)/.exec(m))) return this.canonical(r[1] ?? "");
    if ((r = /^Plugin (\S+)(?: v\S+)? generated an exception/.exec(m)))
      return this.canonical(r[1] ?? "");
    if ((r = /^(?:\[[^\]]+\] )?Could not load (?:plugin )?'(?:plugins[/\\])?([^'/\\]+?)'/.exec(m)))
      return this.canonical(nameFromJar(r[1] ?? ""));
    if ((r = /^Ambiguous plugin name [`']([^'`]+)'/.exec(m))) return this.canonical(r[1] ?? "");
    if ((r = /^(?:Legacy plugin|Plugin) (\S+) v\S+ /.exec(m))) return this.canonical(r[1] ?? "");
    if ((r = /^Mixin apply (?:for mod ([\w-]+) )?failed ([\w-]+?)\.mixins?\b/.exec(m)))
      return this.canonical(r[1] ?? r[2] ?? "");
    const tag = /^\[([A-Za-z][\w .-]{1,40})\] /.exec(m)?.[1];
    if (tag && !SERVER_TAGS.has(tag.toLowerCase())) return this.canonical(tag);
    // Paper names async task threads after their plugin: "Craft Scheduler Thread - 3 - Essentials".
    const thread = /^Craft Scheduler Thread - \d+ - (.+)$/.exec(e.thread ?? "")?.[1];
    if (thread) return this.canonical(thread);
    // Fabric and Forge put the mod's logger name on the line: "[sodium/]" or "(Sodium)".
    const logger = e.logger?.replace(/\/$/, "").split("/")[0];
    if (logger && !/^(?:minecraft|net\.|com\.mojang|FabricLoader|mixin)/i.test(logger)) {
      const known = this.known.find((k) => k.key === norm(logger));
      if (known) return known.name;
    }
    return this.fromFrames(e.frames);
  }
}

export interface PluginErrors {
  /** The plugin's name, a package when it couldn't be named, or "Server". */
  name: string;
  /** Indexes into the log's entries. */
  entries: number[];
  /** The distinct exceptions, most common first. */
  exceptions: { name: string; count: number }[];
}

export const SERVER = "Server";

/** An entry is an error when it's logged as one or carries a stack trace. */
export function isError(e: Entry): boolean {
  return e.level === "error" || (e.exception !== undefined && e.frames.length > 0);
}

/** Every error and exception, grouped by the plugin it came from. */
export function errorsByPlugin(log: ParsedLog, attributor: Attributor): PluginErrors[] {
  const groups = new Map<string, PluginErrors>();
  for (const e of log.entries) {
    if (!isError(e)) continue;
    const name = attributor.entry(e) ?? SERVER;
    let g = groups.get(name);
    if (!g) {
      g = { name, entries: [], exceptions: [] };
      groups.set(name, g);
    }
    g.entries.push(e.index);
    if (e.exception) {
      const short = e.exception.split(".").at(-1) ?? e.exception;
      const x = g.exceptions.find((x) => x.name === short);
      if (x) x.count++;
      else g.exceptions.push({ name: short, count: 1 });
    }
  }
  for (const g of groups.values()) g.exceptions.sort((a, b) => b.count - a.count);
  // Plugins first, by how many errors; the server's own last.
  return [...groups.values()].sort(
    (a, b) =>
      Number(a.name === SERVER) - Number(b.name === SERVER) ||
      b.entries.length - a.entries.length ||
      a.name.localeCompare(b.name),
  );
}

/** For a watchdog dump: the Server thread's frames, and the plugin they point at. */
export function suspectInDump(lines: string[], attributor: Attributor) {
  let inServerThread = false;
  const frames: string[] = [];
  for (const line of lines) {
    if (/Current Thread: Server thread/.test(line)) inServerThread = true;
    else if (/Current Thread: /.test(line) && inServerThread) break;
    if (!inServerThread) continue;
    const frame = frameOf(line.replace(/^\[[^\]]*\](?: ?\[[^\]]*\])?:? ?/, ""));
    if (frame) frames.push(frame);
  }
  const plugin = attributor.fromFrames(frames);
  if (!plugin) return undefined;
  const frame =
    frames.find((f) => attributor.knownFromClass(f) === plugin) ??
    frames.find((f) => !isServerClass(f) && !isLibraryClass(f)) ??
    frames[0] ??
    "";
  return { frame, plugin };
}
