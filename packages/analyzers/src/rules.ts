// The problems the analyser knows, as data. Each message is matched in the
// words the server software writes it, from its source; the source is noted
// above each rule so the wording can be checked when it changes.

import type { Context, Hit, Link, Rule } from "./engine.ts";
import type { Entry } from "./parse.ts";
import { isServerClass, nameFromJar, suspectInDump } from "./plugins.ts";

/** Java's class file versions: 52 is Java 8, 61 is 17, 65 is 21, 69 is 25. */
export const javaForClassVersion = (v: number) => Math.round(v) - 44;

const L = {
  java: {
    label: "Installing or updating Java (PaperMC)",
    url: "https://docs.papermc.io/misc/java-install",
  },
  adoptium: { label: "Eclipse Temurin downloads", url: "https://adoptium.net/temurin/releases/" },
  paperDownloads: { label: "Paper downloads", url: "https://papermc.io/downloads/paper" },
  troubleshooting: {
    label: "Basic troubleshooting (PaperMC)",
    url: "https://docs.papermc.io/paper/basic-troubleshooting",
  },
  aikar: { label: "Aikar's flags (PaperMC)", url: "https://docs.papermc.io/paper/aikars-flags" },
  flags: { label: "Startup Flags", url: "/flags" },
  spark: { label: "spark profiler", url: "https://spark.lucko.me/docs/Command-Usage" },
  eula: { label: "Minecraft EULA", url: "https://www.minecraft.net/eula" },
  forwarding: {
    label: "Configuring player information forwarding (Velocity)",
    url: "https://docs.papermc.io/velocity/player-information-forwarding",
  },
  firewall: {
    label: "Firewall guide (SpigotMC)",
    url: "https://www.spigotmc.org/wiki/firewall-guide/",
  },
  hangar: { label: "Hangar", url: "https://hangar.papermc.io/" },
  modrinth: { label: "Modrinth", url: "https://modrinth.com/" },
  pluginYml: {
    label: "plugin.yml reference (PaperMC)",
    url: "https://docs.papermc.io/paper/dev/plugin-yml",
  },
  apiVersion: {
    label: "api-version in plugin.yml (PaperMC)",
    url: "https://docs.papermc.io/paper/dev/plugin-yml#api-version",
  },
  mixin: {
    label: "Mixin introduction (Fabric wiki)",
    url: "https://wiki.fabricmc.net/tutorial:mixin_introduction",
  },
  fabricServer: { label: "Fabric server setup", url: "https://fabricmc.net/use/server/" },
} satisfies Record<string, Link>;

/** The first exception in an entry, short and with its message: "NullPointerException: …". */
function causeOf(e: Entry | undefined): string | undefined {
  if (!e) return undefined;
  const all = [e.message, ...e.rest];
  // The deepest "Caused by" is usually the real one.
  const caused = all.filter((l) => /^Caused by: /.test(l)).at(-1);
  const line =
    caused ??
    all.find((l) => /^(?:\t*)(?:[a-z_$][\w$]*\.)+[A-Z][\w$]*(?:Exception|Error)\b/.test(l));
  if (!line) return undefined;
  const text = line
    .replace(/^Caused by: /, "")
    .replace(/^\s+/, "")
    .replace(/^(?:[a-z_$][\w$]*\.)+(?=[A-Z])/, "");
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

/** Lines whose text matches, as hits, one per line. */
function linesMatching(ctx: Context, re: RegExp, hint?: string): number[] {
  const out: number[] = [];
  for (const l of ctx.log.lines) {
    if (hint && !l.text.includes(hint)) continue;
    if (re.test(l.text)) out.push(l.n);
  }
  return out;
}

/**
 * Bukkit: "Could not load 'plugins/X.jar'"; Paper's legacy loader adds " in folder 'plugins'";
 * Paper's modern loader: "Could not load plugin 'X.jar' in folder 'plugins'", or for a
 * missing dependency "Could not load 'plugins/X.jar' in 'plugins'".
 */
const JAR_IN = /Could not load (?:plugin )?'(?:[^']*[/\\])?([^'/\\]+?\.jar)'/;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;

export const RULES: readonly Rule[] = [
  // The JVM's own message, from java.lang.ClassLoader.
  {
    id: "java-class-version",
    title: "{what} needs Java {need}, but the server runs Java {have}",
    severity: "error",
    hint: "UnsupportedClassVersionError",
    match:
      /UnsupportedClassVersionError: (?<cls>\S+) has been compiled by a more recent version of the Java Runtime \(class file version (?<classVersion>[\d.]+)\), this version of the Java Runtime only recognizes class file versions up to (?<maxVersion>[\d.]+)/,
    key: "{what}",
    vars: (g, ctx, line) => {
      const cls = String(g.cls).replace(/\//g, ".");
      const need = javaForClassVersion(Number.parseFloat(String(g.classVersion)));
      const have = javaForClassVersion(Number.parseFloat(String(g.maxVersion)));
      const plugin =
        isServerClass(cls) || /paperclip|bundler|Main$/i.test(cls)
          ? undefined
          : ctx.attributor.fromClass(cls);
      const entry = ctx.entryAt(line.n);
      const jar = JAR_IN.exec(entry?.message ?? "")?.[1];
      const what = jar ? nameFromJar(jar) : (g.plugin ?? plugin ?? "The server jar");
      return { ...g, cls, need, have, what };
    },
    explain:
      "{cls} was built for Java {need} (class file version {classVersion}), and the Java running the server only reads up to Java {have}. Java can run code built for older versions, never newer ones.",
    fix: [
      "Install Java {need} or newer: Eclipse Temurin is free and the one PaperMC recommends.",
      "Point your start script, or the panel's Java image (Pterodactyl's Startup tab, or your host's Java version setting), at the new Java.",
      "Run java -version with the same command the script uses, and check it says {need} or higher.",
    ],
    links: [L.java, L.adoptium],
  },

  // Bukkit's SimplePluginManager ("Unknown dependency X. Please download and install X
  // to run this plugin.") and Paper's ModernPluginLoadingStrategy ("Unknown/missing
  // dependency plugins: [X]. Please download and install these plugins to run 'Y'.").
  {
    id: "plugin-missing-dependency",
    title: "{plugin} needs {deps}, which {isnt} installed",
    severity: "error",
    match: (ctx) => {
      const hits: Hit[] = [];
      for (const l of ctx.log.lines) {
        if (!l.text.includes("UnknownDependencyException") && !l.text.includes("nknown dependency"))
          continue;
        const modern =
          /Unknown\/missing dependency plugins: \[([^\]]*)\]\. Please download and install these plugins to run '([^']+)'/.exec(
            l.text,
          );
        const legacy =
          /Unknown dependency (\S+?)\. Please download and install \S+? to run this plugin/.exec(
            l.text,
          );
        if (!modern && !legacy) continue;
        const entry = ctx.entryAt(l.n);
        const deps = modern ? (modern[1] ?? "").split(/,\s*/).filter(Boolean) : [legacy?.[1] ?? ""];
        const plugin =
          modern?.[2] ?? (entry ? ctx.attributor.entry(entry) : undefined) ?? "A plugin";
        hits.push({
          lines: [entry?.start ?? l.n, l.n].filter((n, i, a) => a.indexOf(n) === i),
          key: plugin,
          vars: {
            plugin,
            deps: list(deps),
            isnt: deps.length === 1 ? "isn't" : "aren't",
            missing: deps.length === 1 ? "isn't" : "aren't",
          },
        });
      }
      return hits;
    },
    explain:
      "{plugin} lists {deps} as dependencies in its plugin.yml, so the server won't load it while {deps} {missing} there.",
    fix: [
      "Download {deps} for your server's version and put the jar in plugins/.",
      "Restart the server (not /reload) and check {plugin} now enables.",
      "If you don't need {plugin}, remove its jar instead.",
    ],
    links: [L.hangar, L.troubleshooting],
  },

  // Vanilla's DedicatedServer: "**** FAILED TO BIND TO PORT!", then "The exception was: {}"
  // and "Perhaps a server is already running on that port?"; Velocity's ConnectionManager:
  // "Can't bind to {}" with the exception after it.
  {
    id: "port-bind-failed",
    title: "The server couldn't open {where}",
    severity: "error",
    match: (ctx) => {
      const lines = linesMatching(
        ctx,
        /\*\*\*\* FAILED TO BIND TO PORT!|^\[[^\]]+\].*?: Can't bind to \S+/,
      );
      if (!lines.length) return [];
      const near = ctx.log.lines.slice((lines[0] ?? 1) - 1, (lines[0] ?? 1) + 4);
      const exception = near
        .map((l) => ({
          n: l.n,
          m: /The exception was: (.+)$|^(\S*(?:Exception|Error)\S*: .+)$/.exec(l.text),
        }))
        .find((x) => x.m);
      const cause = exception?.m?.[1] ?? exception?.m?.[2] ?? "";
      const extra = exception?.n;
      const bindTo = /Can't bind to \S*:(\d+)/.exec(ctx.line(lines[0] ?? 0)?.text ?? "")?.[1];
      const port = bindTo ?? ctx.summary.port;
      return [
        {
          lines: [...lines, ...(extra ? [extra] : [])],
          vars: {
            where: port ? `port ${port.replace(/^\*:/, "")}` : "its port",
            cause: cause || "a network error",
            why: /already in use/i.test(cause)
              ? "Something else already holds the port: usually another copy of this server that's still running."
              : /Cannot assign requested address/i.test(cause)
                ? "server-ip in server.properties is set to an address this machine doesn't have."
                : "The port is taken, or server-ip names an address this machine doesn't have.",
          },
        },
      ];
    },
    explain: "Java answered {cause}. {why}",
    fix: [
      "Stop every other copy of the server: check for an old java process (ps aux | grep java on Linux, Task Manager on Windows) and end it.",
      "Leave server-ip in server.properties empty unless your host tells you to set it.",
      "On a hosted panel, use the port the panel gave you for server-port; you can't pick your own.",
    ],
    links: [L.troubleshooting],
  },

  // java.net.BindException, and Netty's native transport ("bind(..) failed: Address
  // already in use"), which Velocity and Paper use on Linux.
  {
    id: "address-in-use",
    title: "Another program is already using {where}",
    severity: "error",
    hint: "ddress already in use",
    match: /(?:BindException|NativeIoException|bind\(\.\.\) failed)[^\n]*Address already in use/,
    key: "bind",
    vars: (g, ctx) => {
      const port = ctx.summary.port?.replace(/^.*:/, "");
      return { ...g, where: port ? `port ${port}` : "the server's port" };
    },
    unless: ["port-bind-failed"],
    explain:
      "The operating system refused to give the port to this server because another process holds it. Most often it's an earlier copy of the same server that never stopped.",
    fix: [
      "Find what's using the port: ss -ltnp | grep {where} on Linux, or netstat -ano | findstr :PORT on Windows.",
      "Stop that process, or give this server a free port (server-port in server.properties, bind in velocity.toml).",
      "Start the server again.",
    ],
    links: [L.troubleshooting],
  },

  // Vanilla's MinecraftServer: "Can't keep up! Is the server overloaded? Running {}ms or
  // {} ticks behind"; before 1.20.3 also "Running {}ms behind, skipping {} tick(s)".
  {
    id: "cant-keep-up",
    title: "The server fell behind {times}, by up to {worst}",
    severity: (v) => (Number(v.worstMs) >= 10_000 || Number(v.count) >= 20 ? "error" : "warning"),
    match: (ctx) => {
      let worstMs = 0;
      let worstTicks = 0;
      const lines: number[] = [];
      for (const l of ctx.log.lines) {
        if (!l.text.includes("Can't keep up!")) continue;
        const m = /Running (\d+)ms (?:or (\d+) ticks behind|behind, skipping (\d+) tick)/.exec(
          l.text,
        );
        lines.push(l.n);
        const ms = Number(m?.[1] ?? 0);
        if (ms > worstMs) {
          worstMs = ms;
          worstTicks = Number(m?.[2] ?? m?.[3] ?? Math.round(ms / 50));
        }
      }
      if (!lines.length) return [];
      return [
        {
          lines,
          vars: {
            count: lines.length,
            worstMs,
            worst: `${(worstMs / 1000).toFixed(worstMs < 10_000 ? 1 : 0)}s (${plural(worstTicks, "tick")})`,
          },
        },
      ];
    },
    explain:
      "A tick should take 50ms. When ticks run long, the server skips ahead to catch up, and players feel it as lag, rubber-banding and slow mobs. Once or twice at startup is normal; again and again is not.",
    fix: [
      "Run /spark profiler start, play for a few minutes, then /spark profiler stop: the report shows which plugin, entity or chunk takes the time.",
      "Lower view-distance and simulation-distance in server.properties, and pre-generate the world.",
      "Use Aikar's flags and give the server enough memory, but not more than it needs.",
    ],
    links: [L.spark, L.aikar, L.flags],
  },

  // Spigot's CraftBukkit Main: "*** Error, this build is outdated ***". Paper's
  // PaperVersionFetcher at startup: "*** Currently you are 12 builds behind ***" and "***
  // You are running an outdated version of Minecraft, which is 1 release and 30 builds
  // behind!"; and /version: "You are 12 version(s) behind".
  {
    id: "outdated-build",
    title: "{software} is out of date{behind}",
    severity: "warning",
    match: (ctx) => {
      const lines = linesMatching(
        ctx,
        /\*\*\* Error, this build is outdated \*\*\*|\*\*\* Currently you are \d+ builds? behind \*\*\*|\*\*\* You are running an outdated version of Minecraft|You are \d+ version\(s\) behind/,
      );
      if (!lines.length) return [];
      const behind = lines
        .map(
          (n) =>
            /(?:you are|which is) (?:\d+ releases? and )?(\d+) (?:builds?|version\(s\)) behind/i.exec(
              ctx.line(n)?.text ?? "",
            )?.[1],
        )
        .find(Boolean);
      const mc = lines.some((n) => ctx.line(n)?.text.includes("outdated version of Minecraft"));
      return [
        {
          lines,
          vars: {
            software: ctx.summary.software ?? "The server",
            behind: behind ? `: ${plural(Number(behind), "build")} behind` : "",
            mc: mc
              ? " The Minecraft version itself is old too, and only the newest gets fixes."
              : "",
          },
        },
      ];
    },
    explain:
      "The server checked its build date or asked for the newest build, and this one is old. Builds fix crashes, exploits and dupes, so an old one is a risk even when it seems to work.{mc}",
    fix: [
      "Back up the server folder.",
      "Download the newest build for the same Minecraft version and replace the server jar.",
      "Start the server and read the log for new warnings.",
    ],
    links: [L.paperDownloads],
  },

  // The JVM's own error: "java.lang.OutOfMemoryError: Java heap space" and its kinds.
  {
    id: "out-of-memory",
    title: "Java ran out of memory ({kind})",
    severity: "error",
    hint: "OutOfMemoryError",
    match: /java\.lang\.OutOfMemoryError(?:: (?<kind>[^\n]+))?/,
    key: "oom",
    vars: (g) => {
      const kind = String(g.kind ?? "heap").trim();
      const why = /native thread/i.test(kind)
        ? "The system wouldn't give Java another thread. Something is starting threads without end (often a plugin), or the host limits how many a process may have."
        : /Metaspace/i.test(kind)
          ? "Java's space for loaded classes filled up, usually from /reload or plugin reloads loading the same classes again."
          : /Direct buffer/i.test(kind)
            ? "The memory Netty and chunk saving use outside the heap ran out."
            : "The heap (-Xmx) filled up and the garbage collector couldn't free enough. Either the server needs more, or something keeps hold of memory it never lets go: a leak.";
      return { ...g, kind, why };
    },
    explain: "{why} When this happens the server can't recover and has to be restarted.",
    fix: [
      "Check the heap: -Xmx in your start script should be 1 to 1.5GB less than the machine or container has.",
      "If it was fine before, look for what changed: a new plugin, a bigger render distance, a farm of entities. spark's heap summary (/spark heapsummary) shows what's using the memory.",
      "Stop using /reload and plugin managers' reload commands; restart instead.",
    ],
    links: [L.flags, L.spark],
  },

  // Bukkit's JavaPluginLoader: InvalidDescriptionException ("Invalid plugin.yml",
  // "Jar does not contain plugin.yml", or what's wrong with a field); Paper's "X.jar does
  // not contain a plugin.yml or paper-plugin.yml! …" and "X.jar appears to be a server jar!".
  {
    id: "invalid-plugin-yml",
    title: "{plugin} has a plugin.yml the server can't read",
    severity: "error",
    hint: [
      "InvalidDescriptionException",
      "does not contain a plugin.yml",
      "appears to be a server jar",
    ],
    match:
      /InvalidDescriptionException(?:: (?<why>[^\n]+))?|(?<file>\S+\.jar) (?<paperWhy>does not contain a plugin\.yml or paper-plugin\.yml!|appears to be a server jar!)/,
    key: "{plugin}",
    vars: (g, ctx, line) => {
      const entry = ctx.entryAt(line.n);
      const jar = JAR_IN.exec(entry?.message ?? "")?.[1];
      const file = g.file ? String(g.file).split(/[/\\]/).at(-1) : undefined;
      const why = String(g.why ?? g.paperWhy ?? "Invalid plugin.yml").replace(
        /^java\.io\.\w+: /,
        "",
      );
      const name = jar ?? file;
      return {
        ...g,
        plugin: name ? nameFromJar(name) : (g.plugin ?? "A plugin"),
        jar: name ?? "the jar",
        why,
        noYml: /does not contain plugin\.yml/i.test(why) ? "yes" : undefined,
      };
    },
    explain:
      "The server read {jar} and stopped at its plugin.yml: \"{why}\". A jar with no plugin.yml at all usually isn't a Bukkit plugin: it's a mod, a Velocity or BungeeCord plugin, a library, or a server jar.",
    fix: [
      "Check you downloaded the build for your server software (Paper or Spigot, not Fabric, Forge, Velocity or BungeeCord).",
      "Download it again from its official page; a broken download looks the same.",
      "If you build the plugin yourself, check name, version and main are set in plugin.yml.",
    ],
    links: [L.pluginYml],
  },

  // Bukkit's SimplePluginManager ("Ambiguous plugin name `X' for files `a' and `b'"),
  // Paper's legacy loader (the same, plus " in `plugins'") and its modern loader, which
  // quotes with ' on both sides.
  {
    id: "ambiguous-plugin-name",
    title: "Two jars are both called {plugin}",
    severity: "warning",
    hint: "Ambiguous plugin name",
    match:
      /Ambiguous plugin name [`'](?<plugin>[^'`]+)' for files [`'](?<a>[^'`]+)' and [`'](?<b>[^'`]+)'/,
    key: "{plugin}",
    explain:
      "Both {a} and {b} say they are {plugin}, so the server loads only one of them, and it may not be the version you meant.",
    fix: ["Delete the older of {a} and {b} from plugins/.", "Restart the server."],
    links: [L.troubleshooting],
  },

  // Bukkit's SimplePluginManager: "Could not load 'plugins/X.jar'"; Paper's loaders:
  // "Could not load plugin 'X.jar' in folder 'plugins'", "Error initializing plugin 'X.jar'
  // in folder 'plugins' (Is it up to date?)", "Failed to run bootstrapper for X. This
  // plugin will not be loaded.".
  {
    id: "plugin-load-failed",
    title: "{plugin} didn't load",
    severity: "error",
    match: (ctx) => {
      const hits: Hit[] = [];
      for (const e of ctx.log.entries) {
        const m =
          JAR_IN.exec(e.message) ??
          /Error initializing plugin '([^']+)' in folder '[^']*' \(Is it up to date\?\)/.exec(
            e.message,
          ) ??
          /Failed to run bootstrapper for (\S+)\. This plugin will not be loaded\./.exec(e.message);
        if (!m) continue;
        const body = [e.message, ...e.rest].join("\n");
        // These have their own, more exact, explanations.
        if (
          /UnknownDependencyException|InvalidDescriptionException|UnsupportedClassVersionError/.test(
            body,
          )
        )
          continue;
        const plugin = nameFromJar(m[1] ?? "");
        const suffix =
          /': (Restricted Name|uses the space-character \(0x20\) in its name|circular dependency detected)/.exec(
            e.message,
          )?.[1];
        hits.push({
          lines: [e.start],
          key: plugin,
          vars: {
            plugin,
            jar: /\.jar$/.test(m[1] ?? "") ? m[1] : `${m[1]}'s jar`,
            cause: suffix ?? causeOf(e) ?? "no reason given",
          },
        });
      }
      return hits;
    },
    explain:
      "The server found {jar} but couldn't load it: {cause}. That usually means the plugin is for another Minecraft version or server software, or the download is broken.",
    fix: [
      "Check the plugin's page for a version that supports your Minecraft version and server software.",
      "Download it again and replace {jar}.",
      "If it still fails, send the plugin's author these lines.",
    ],
    links: [L.hangar, L.troubleshooting],
  },

  // Bukkit's SimplePluginManager: "Error occurred while enabling X v1.0 (Is it up to date?)".
  {
    id: "plugin-enable-error",
    title: "{plugin} failed to enable",
    severity: "error",
    hint: "Error occurred while enabling",
    match:
      /Error occurred while enabling (?<plugin>\S+) (?:v(?<version>\S+) )?\(Is it up to date\?\)/,
    key: "{plugin}",
    vars: (g, ctx, line) => ({
      ...g,
      cause: causeOf(ctx.entryAt(line.n)) ?? "see the lines below",
    }),
    explain:
      "{plugin} threw an error while starting up ({cause}), so the server turned it off. Its commands and features won't work.",
    fix: [
      "Update {plugin} to the newest version for your Minecraft version.",
      "Check that everything {plugin} needs (other plugins, a database, its config) is there and correct.",
      "If it still fails, send the plugin's author these lines and your server version.",
    ],
    links: [L.troubleshooting],
  },

  // CraftBukkit's CraftAsyncTask: "Plugin X v1.0 generated an exception while executing
  // task 42"; CraftScheduler, for tasks on the main thread: "Task #42 for X v1.0 generated
  // an exception".
  {
    id: "plugin-task-exception",
    title: "{plugin}'s scheduled task failed {times}",
    severity: "error",
    hint: "generated an exception",
    match:
      /(?:Plugin (?<plugin>\S+)(?: v(?<version>\S+))? generated an exception while executing task (?<task>\d+)|Task #(?<syncTask>\d+) for (?<syncPlugin>\S+)(?: v\S+)? generated an exception)/,
    key: "{plugin}",
    vars: (g, ctx, line) => ({
      ...g,
      plugin: g.syncPlugin ? ctx.attributor.canonical(String(g.syncPlugin)) : g.plugin,
      cause: causeOf(ctx.entryAt(line.n)) ?? "an exception",
    }),
    explain:
      "Code {plugin} scheduled to run later threw {cause}. It's a bug in {plugin}, or its config points at something that isn't there.",
    fix: [
      "Update {plugin}.",
      "Check its config for missing worlds, players or database details.",
      "Report it to the author with these lines.",
    ],
    links: [L.troubleshooting],
  },

  // Bukkit's SimplePluginManager: "Could not pass event PlayerJoinEvent to X v1.0".
  {
    id: "plugin-event-exception",
    title: "{plugin} failed handling {event}",
    severity: "error",
    hint: "Could not pass event",
    match: /Could not pass event (?<event>\S+) to (?<plugin>\S+)(?: v(?<version>\S+))?/,
    key: "{plugin}",
    vars: (g, ctx, line) => ({ ...g, cause: causeOf(ctx.entryAt(line.n)) ?? "an exception" }),
    explain:
      "{plugin} threw {cause} while reacting to {event}. Whatever it does on that event (join messages, protection, rewards) didn't happen that time.",
    fix: ["Update {plugin}.", "Report it to the author with these lines if it keeps happening."],
    links: [L.troubleshooting],
  },

  // Spigot's and Paper's WatchdogThread: "The server has stopped responding! This is
  // (probably) not a Paper bug." (or "Spigot bug."), then "Server thread dump (Look for
  // plugins here before reporting to Paper!):" and "Current Thread: Server thread".
  {
    id: "watchdog",
    title: "The server froze{blame}",
    severity: "error",
    match: (ctx) => {
      const start = ctx.log.lines.filter((l) =>
        l.text.includes("The server has stopped responding!"),
      );
      if (!start.length) return [];
      const at = (start[0]?.n ?? 1) - 1;
      const dump = ctx.log.lines.slice(at, at + 400).map((l) => l.text);
      const suspect = suspectInDump(dump, ctx.attributor);
      const frameLine = suspect
        ? ctx.log.lines.slice(at, at + 400).find((l) => l.text.includes(suspect.frame))?.n
        : undefined;
      return [
        {
          lines: [...start.map((l) => l.n), ...(frameLine ? [frameLine] : [])],
          vars: {
            blame: suspect?.plugin ? `, most likely in ${suspect.plugin}` : "",
            suspect: suspect?.plugin,
            frame: suspect?.frame,
            where: suspect
              ? `The main thread was running ${suspect.frame}, which belongs to ${suspect.plugin}, so that's where to look first.`
              : "The main thread's stack shows only the server's own code, so it was most likely saving or loading too much at once.",
          },
        },
      ];
    },
    explain:
      "The main thread didn't finish a tick for the watchdog's whole timeout (timeout-time in spigot.yml, 60 seconds by default), so the server dumped every thread and stopped. {where}",
    fix: [
      'Read the "Server thread" stack in the matching lines: the first line that isn\'t net.minecraft, org.bukkit or io.papermc is what was running.',
      "Update or remove that plugin; database or web requests on the main thread are the usual cause.",
      "If it's only the server's code, pre-generate the world and lower view-distance.",
    ],
    links: [L.spark, L.troubleshooting],
  },

  // Vanilla's DedicatedServer: "**** SERVER IS RUNNING IN OFFLINE/INSECURE MODE!";
  // Spigot and Paper add "Whilst this makes it possible to use BungeeCord…" behind a proxy.
  {
    id: "offline-mode",
    title: "{title}",
    severity: (v) => (v.proxy ? "info" : "warning"),
    match: (ctx) => {
      const lines = linesMatching(
        ctx,
        /SERVER IS RUNNING IN OFFLINE\/INSECURE MODE!/,
        "OFFLINE/INSECURE",
      );
      if (!lines.length) return [];
      const proxy = ctx.summary.mode === "proxy";
      return [
        {
          lines,
          vars: {
            proxy: proxy ? "yes" : undefined,
            title: proxy ? "Offline mode, behind a proxy" : "The server is in offline mode",
            what: proxy
              ? "That's expected behind BungeeCord or Velocity, which log players in for it, as long as nobody can reach this server except through the proxy."
              : "The server doesn't check players with Mojang, so anyone can join with any name, including yours, and act as them: an operator account can be taken in seconds.",
          },
        },
      ];
    },
    explain: "online-mode is false in server.properties. {what}",
    fix: [
      "Not behind a proxy: set online-mode=true in server.properties and restart.",
      "Behind Velocity: turn on modern forwarding (Paper's config/paper-global.yml, proxies.velocity) and firewall the server's port so only the proxy can reach it.",
      "Behind BungeeCord: set bungeecord: true in spigot.yml and firewall the port the same way.",
    ],
    links: [L.forwarding, L.firewall],
  },

  // CraftBukkit's CraftMagicNumbers: "Legacy plugin X v1.0 does not specify an api-version.",
  // then "Initializing Legacy Material Support. Unless you have legacy plugins and/or data
  // this is a bug!".
  {
    id: "legacy-material",
    title: "{title}",
    severity: "warning",
    match: (ctx) => {
      const plugins: string[] = [];
      const lines: number[] = [];
      for (const l of ctx.log.lines) {
        const m = /Legacy plugin (\S+)(?: v\S+)? does not specify an api-version/.exec(l.text);
        if (m?.[1]) {
          plugins.push(m[1]);
          lines.push(l.n);
        } else if (l.text.includes("Initializing Legacy Material Support")) lines.push(l.n);
      }
      if (!lines.length) return [];
      return [
        {
          lines,
          vars: {
            title: plugins.length
              ? `${list(plugins)} ${plugins.length === 1 ? "is a legacy plugin" : "are legacy plugins"}`
              : "Legacy material support was loaded",
            who: plugins.length ? list(plugins) : "A plugin",
          },
        },
      ];
    },
    explain:
      "{who} doesn't set api-version in its plugin.yml, so the server treats it as written for 1.12 or older and loads a translation layer for the old block and item names. It slows startup, and the plugin may get blocks and items wrong.",
    fix: [
      "Update {who}: a version for 1.13 or later sets api-version.",
      "If there's no update, look for a maintained replacement on Hangar or Modrinth.",
    ],
    links: [L.apiVersion, L.hangar],
  },

  // SpongePowered Mixin's MixinProcessor: "Mixin apply failed x.mixins.json:Y -> z: …";
  // Fabric's fork: "Mixin apply for mod x failed x.mixins.json:Y from mod x -> z: …";
  // and the error a crash report carries: "Mixin [x.mixins.json:Y from mod x] from phase
  // [DEFAULT] in config [x.mixins.json] FAILED during APPLY".
  {
    id: "mixin-apply-failed",
    title: "A mixin from {mod} couldn't be applied",
    severity: "error",
    hint: ["Mixin apply", "FAILED during APPLY"],
    match:
      /Mixin apply (?:for mod (?<mod>[\w-]+) )?failed (?<config>[\w.-]+\.json):(?<mixin>[\w.$]+)(?: from mod [\w-]+)? -> (?<target>[\w.$]+)(?:: (?<why>[^\n]+))?|Mixin \[(?<config2>[\w.-]+\.json):(?<mixin2>[\w.$]+)(?: from mod (?<mod2>[\w-]+))?\] from phase \[\w+\] in config \[[^\]]+\] FAILED during APPLY/,
    key: "{mod}",
    vars: (g) => {
      const config = String(g.config ?? g.config2);
      const mod = g.mod ?? g.mod2 ?? config.replace(/[.-]mixins?.*$/, "").split(".")[0];
      return {
        ...g,
        mod,
        plugin: mod,
        mixin: g.mixin ?? g.mixin2,
        target: g.target ?? "the game's classes",
        why: String(g.why ?? "").replace(/^(?:[\w$]+\.)+(?=[A-Z])/, ""),
      };
    },
    explain:
      "{mod} changes the game's code with a mixin ({mixin}, into {target}), and that code wasn't what it expected. {mod} is almost always built for another Minecraft version, or another mod changes the same code.",
    fix: [
      "Check {mod} is the build for your exact Minecraft version and loader.",
      "Update {mod}, and the mods it's known to clash with.",
      "If it still fails, remove mods in halves until the crash stops, to find the one that clashes.",
    ],
    links: [L.modrinth, L.mixin],
  },

  // Fabric Loader: "Incompatible mods found!" (0.15 and later; 0.14 and older said "Mod
  // resolution encountered an incompatible mod set!"), then "\t - Mod 'Iris' (iris) 1.8.0
  // requires version 0.5 or later of fabric-api, which is missing!".
  {
    id: "fabric-missing-dependency",
    title: "{title}",
    severity: "error",
    match: (ctx) => {
      const lines = linesMatching(
        ctx,
        /Mod resolution encountered an incompatible mod set!|Incompatible mods found!|Some of your mods are incompatible with the game or each other!/,
      );
      if (!lines.length) return [];
      const at = (lines[0] ?? 1) - 1;
      const needs: string[] = [];
      const who = new Set<string>();
      const shown: number[] = [...lines];
      for (const l of ctx.log.lines.slice(at, at + 80)) {
        // "Mod 'Iris' (iris) 1.7.0 requires any version of fabric-api, which is missing!"
        const m =
          /Mod '([^']+)' \(([\w-]+)\) \S+ requires (.+?) of (?:mod )?(.+?), which is missing!/.exec(
            l.text,
          );
        if (m) {
          const range = m[3] === "any version" ? "" : ` (${m[3]?.replace(/^version /, "")})`;
          const dep = `${m[4]}${range}`;
          if (!needs.includes(dep)) needs.push(dep);
          who.add(m[1] ?? "");
          shown.push(l.n);
        }
        const install = /^\s*- Install ([\w-]+),? (.+)\.$/.exec(l.text);
        if (install) shown.push(l.n);
      }
      return [
        {
          lines: shown,
          vars: {
            title: needs.length
              ? `${list([...who])} ${who.size === 1 ? "needs" : "need"} ${list(needs)}, which ${needs.length === 1 ? "isn't" : "aren't"} installed`
              : "Fabric found mods that can't run together",
            needs: needs.length
              ? `${list(needs)} ${needs.length === 1 ? "is" : "are"} missing.`
              : "The lines below say which.",
          },
        },
      ];
    },
    explain:
      "Fabric checks every mod's dependencies before it starts the game, and some are missing or the wrong version: {needs}",
    fix: [
      'Follow Fabric\'s own "A potential solution has been determined" lines: install or replace exactly the mods it names.',
      "Download the missing mods for your Minecraft version into mods/ (most need Fabric API).",
      "Start the server again.",
    ],
    links: [L.modrinth, L.fabricServer],
  },

  // Forge and NeoForge: "Missing or unsupported mandatory dependencies:" then
  // "Mod ID: 'x', Requested by: 'y', Expected range: '[1,)', Actual version: '[MISSING]'".
  {
    id: "forge-missing-dependency",
    title: "{by} needs {dep}{state}",
    severity: "error",
    hint: "Requested by:",
    match:
      /Mod ID: '(?<dep>[^']+)', Requested by: '(?<by>[^']+)', Expected range: '(?<range>[^']*)', Actual version: '(?<actual>[^']*)'/,
    key: "{by}:{dep}",
    vars: (g) => ({
      ...g,
      plugin: g.by,
      state: g.actual === "[MISSING]" ? ", which isn't installed" : ` ${g.range}, not ${g.actual}`,
    }),
    explain:
      "Forge checked every mod's dependencies before starting: {by} needs {dep} in the range {range}, and the server has {actual}.",
    fix: [
      "Download {dep} in a version inside {range}, for your Minecraft and Forge version, into mods/.",
      "Remove any other copy of {dep} from mods/.",
      "Start the server again.",
    ],
    links: [L.modrinth],
  },

  // Vanilla's Main: "You need to agree to the EULA in order to run the server. Go to
  // eula.txt for more info."
  {
    id: "eula",
    title: "The EULA hasn't been accepted",
    severity: "error",
    hint: "agree to the EULA",
    match: /You need to agree to the EULA in order to run the server/,
    explain:
      "The server stops on its first start until you accept Minecraft's End User Licence Agreement, which it asks for in eula.txt.",
    fix: [
      "Read the EULA at minecraft.net/eula.",
      "Open eula.txt in the server folder and change eula=false to eula=true.",
      "Start the server again.",
    ],
    links: [L.eula],
  },

  // Vanilla's ServerLoginPacketListenerImpl: "Username '{}' tried to join with an invalid
  // session", the kick ("Disconnecting {}: Failed to verify username!"), and "Couldn't
  // verify username because servers are unavailable".
  {
    id: "failed-to-verify-username",
    title: "{title}",
    severity: "warning",
    match: (ctx) => {
      const lines: number[] = [];
      const names = new Set<string>();
      let down = false;
      for (const l of ctx.log.lines) {
        const t = l.text;
        if (t.includes("Couldn't verify username because servers are unavailable")) {
          down = true;
          lines.push(l.n);
          continue;
        }
        const session = /Username '([^']+)' tried to join with an invalid session/.exec(t);
        if (session?.[1]) names.add(session[1]);
        else if (!t.includes("Failed to verify username")) continue;
        if (t.includes("but will let them in anyway")) continue;
        const n =
          /name=([^,\]]+)/.exec(t)?.[1] ??
          /Disconnecting (\w{3,16})(?= \()/.exec(t)?.[1] ??
          /\((\w{3,16})\)/.exec(t)?.[1];
        if (n && !/^\d/.test(n)) names.add(n);
        lines.push(l.n);
      }
      if (!lines.length) return [];
      const who = [...names];
      return [
        {
          lines,
          vars: {
            title: down
              ? "Mojang's login servers didn't answer"
              : `${who.length ? plural(who.length, "player") : "Players"} couldn't be verified`,
            who: who.length
              ? list(who.slice(0, 8)) + (who.length > 8 ? " and others" : "")
              : "Players",
            why: down
              ? "Mojang's session servers were down or unreachable from the server, so nobody could be checked."
              : "Mojang's session servers said these players hadn't logged in properly. It's usually the player's launcher (a cracked or out-of-date one, or a session that expired), or the server can't reach sessionserver.mojang.com. Behind a proxy, it means the proxy isn't forwarding players and this server is checking them itself.",
          },
        },
      ];
    },
    explain: '{who} were turned away with "Failed to verify username!". {why}',
    fix: [
      "Ask the player to restart the official launcher and log in again.",
      "Check the server can reach sessionserver.mojang.com (a firewall or DNS problem blocks everyone).",
      "Behind Velocity or BungeeCord, set up forwarding so the proxy does the checking.",
    ],
    links: [L.forwarding],
  },

  // Vanilla's chunk storage: "Chunk file at {} is in the wrong location; relocating.
  // (Expected {}, got {})", "Chunk file at {} is missing level data, skipping", "Failed to
  // read chunk {}"; RegionFile's "Region file {} has truncated header: {}", "… has an
  // invalid sector …", "Chunk {} stream is truncated: …"; Paper's "Failed to read external
  // chunk data in file {}, data will be lost"; and the level.dat messages ("Failed to load
  // world data from {}", "Exception reading {}").
  {
    id: "world-corruption",
    title: "{title}",
    severity: (v) => (v.level ? "error" : "warning"),
    match: (ctx) => {
      const lines: number[] = [];
      const chunks = new Set<string>();
      let level = false;
      for (const l of ctx.log.lines) {
        const t = l.text;
        const chunk =
          /Chunk file at (\[-?\d+, ?-?\d+\]) is (?:in the wrong location|missing level data)/.exec(
            t,
          ) ??
          /Failed to read chunk (\[-?\d+, ?-?\d+\])/.exec(t) ??
          /Chunk (\[-?\d+, ?-?\d+\]) (?:header is truncated|stream is truncated|is allocated, but stream is missing|has invalid chunk stream version)/.exec(
            t,
          );
        if (chunk?.[1]) {
          chunks.add(chunk[1]);
          lines.push(l.n);
        } else if (
          /Region file \S+ has (?:truncated header|an? invalid sector)|Failed to read external chunk data/.test(
            t,
          )
        ) {
          lines.push(l.n);
        } else if (
          /Exception reading \S*level\.dat|Failed to load world data|The world upgrade failed while reading level\.dat/.test(
            t,
          )
        ) {
          level = true;
          lines.push(l.n);
        }
      }
      if (!lines.length) return [];
      return [
        {
          lines,
          vars: {
            level: level ? "yes" : undefined,
            title: level
              ? "The world's level.dat couldn't be read"
              : `${chunks.size ? plural(chunks.size, "chunk") : "Region files"} couldn't be read`,
            what: level
              ? "level.dat holds the world's seed, time and settings, and it's damaged."
              : `The server couldn't read ${chunks.size ? `chunks ${[...chunks].slice(0, 6).join(", ")}${chunks.size > 6 ? "…" : ""}` : "part of the world"}, so it either moved them or will make them again from scratch, losing what was built there.`,
          },
        },
      ];
    },
    explain:
      "{what} It's usually the server being killed while it saved (a crash, a power cut, a host stopping it), or a full disk.",
    fix: [
      "Stop the server and back up the whole world folder before changing anything.",
      "Restore the damaged region files (region/r.X.Z.mca) or level.dat from a backup; level.dat_old is the one before the last save.",
      "Check the disk has free space, and always stop the server with /stop.",
    ],
    links: [L.troubleshooting],
  },

  // Vanilla's ServerGamePacketListenerImpl: "{} moved too quickly! {},{},{}" and
  // "{} (vehicle of {}) moved too quickly! {},{},{}".
  {
    id: "moved-too-quickly",
    title: '"Moved too quickly" {times}',
    severity: "info",
    match: (ctx) => {
      const lines: number[] = [];
      const players = new Set<string>();
      for (const l of ctx.log.lines) {
        if (!l.text.includes("moved too quickly!")) continue;
        const m = /: (?:(\S+) \(vehicle of (\S+)\)|(\S+)) moved too quickly!/.exec(l.text);
        const p = m?.[2] ?? m?.[3];
        if (p) players.add(p);
        lines.push(l.n);
      }
      if (!lines.length) return [];
      const who = [...players];
      return [
        {
          lines,
          vars: {
            count: lines.length,
            who: who.length
              ? list(who.slice(0, 6)) + (who.length > 6 ? " and others" : "")
              : "players",
          },
        },
      ];
    },
    explain:
      "The server pulled {who} back because they moved further in one tick than it allows. A few are normal with elytra, lag or high ping; a lot in a short time means the server is lagging, or a client is cheating.",
    fix: [
      'If it comes with "Can\'t keep up!", fix the lag first and these stop.',
      "If one player causes most of them while the server runs fine, check them for a movement cheat.",
    ],
    links: [L.spark],
  },

  // Vanilla's MinecraftServer: "Encountered an unexpected exception"; the crash report's
  // description is "Exception in server tick loop".
  {
    id: "tick-loop-exception",
    title: "The server crashed in its tick loop{blame}",
    severity: "error",
    match: (ctx) => {
      const lines = linesMatching(
        ctx,
        /Encountered an unexpected exception|^Description: Exception in server tick loop/,
      );
      if (!lines.length) return [];
      const entry = ctx.entryAt(lines[0] ?? 0);
      const plugin = entry ? ctx.attributor.fromFrames(entry.frames) : undefined;
      return [
        {
          lines,
          vars: {
            plugin,
            blame: plugin ? `, in ${plugin}` : "",
            cause: causeOf(entry) ?? ctx.log.crash?.exception ?? "an exception",
          },
        },
      ];
    },
    explain:
      "An error escaped the main loop ({cause}) and the server stopped. The first lines of the stack trace that aren't net.minecraft show what caused it.",
    fix: [
      "Look at the matching lines for a plugin or mod's package name, and update or remove it.",
      "If the crash report names a block or entity, that's where it happened; with a backup, remove it with an editor such as MCASelector.",
      "Update the server to the newest build.",
    ],
    links: [L.troubleshooting],
  },

  // The crash report's description for ticking crashes: "Ticking entity", "Ticking block
  // entity", "Exception ticking world".
  {
    id: "crash-ticking",
    title: "The game crashed while ticking {what}",
    severity: "error",
    match: (ctx) => {
      const c = ctx.log.crash;
      const m =
        /^(Ticking entity|Ticking block entity|Exception ticking world|Ticking player)/.exec(
          c?.description ?? "",
        );
      if (!c || !m) return [];
      const lines = linesMatching(
        ctx,
        /^Description: |Entity Type: |Block type: |Entity's Exact location: |Block location: /,
      );
      const value = (re: RegExp) => ctx.log.lines.map((l) => re.exec(l.text)?.[1]).find(Boolean);
      const type =
        value(/^\tEntity Type: (\S+)/) ??
        value(/^\tBlock type: ID #?(\S+)/) ??
        value(/^\tName: (\S+)/);
      const where = value(/^\tEntity's Exact location: (.+)$/) ?? value(/^\tBlock location: (.+)$/);
      return [
        {
          lines: lines.slice(0, 6),
          vars: {
            what: type
              ? `${m[1] === "Ticking block entity" ? "the block" : "the entity"} ${type}`
              : m[1]?.toLowerCase().replace(/^ticking /, "an "),
            where: where ? ` at ${where}` : "",
            cause: c.exception ?? "an exception",
          },
        },
      ];
    },
    explain:
      "One thing in the world{where} threw {cause} every time it was updated, so the game stopped. It will crash again when that chunk loads.",
    fix: [
      "Back up the world.",
      "Paper and Forge can remove crashing entities for you; otherwise delete it with an editor such as MCASelector, or with /kill once you can get in.",
      "Update the mod or plugin that adds it, if it isn't from the base game.",
    ],
    links: [L.troubleshooting],
    unless: ["tick-loop-exception"],
  },

  // Any other crash report: "---- Minecraft Crash Report ----" with its Description.
  {
    id: "crash-report",
    title: "Crash: {description}",
    severity: "error",
    match: (ctx) => {
      const c = ctx.log.crash;
      if (!c) return [];
      const lines = linesMatching(ctx, /^Description: /);
      const entry = ctx.entryAt(c.start);
      const blame = entry ? ctx.attributor.fromFrames(entry.frames) : undefined;
      return [
        {
          lines: [c.start, ...lines],
          vars: {
            description: c.description ?? "no description",
            cause: c.exception ?? "an exception",
            blame: blame ? ` The first frame that isn't the game's is in ${blame}.` : "",
          },
        },
      ];
    },
    explain: 'The game wrote a crash report: "{description}", caused by {cause}.{blame}',
    fix: [
      "Read the stack trace under the description for a mod or plugin's package.",
      "Update or remove that mod or plugin, and update the server.",
      "If nothing points anywhere, share the full report with the server software's support.",
    ],
    links: [L.troubleshooting],
    unless: [
      "tick-loop-exception",
      "crash-ticking",
      "mixin-apply-failed",
      "out-of-memory",
      "fabric-missing-dependency",
    ],
  },

  // Paper's backend login: "This server requires you to connect with Velocity.", "Unable
  // to verify player details", "Unsupported forwarding version N, wanted upto M"; Spigot's
  // handshake: "If you wish to use IP forwarding, please enable it in your BungeeCord
  // config as well!" and "Unknown data in login hostname, did you forget to enable
  // BungeeCord in spigot.yml?"; Velocity's "Your server did not send a forwarding request
  // to the proxy. Make sure the server is configured for Velocity forwarding.".
  {
    id: "proxy-forwarding-mismatch",
    title: "{title}",
    severity: "error",
    match: (ctx) => {
      const lines: number[] = [];
      let kind: "required" | "secret" | "version" | "bungee" | "bungeeOff" | "velocity" | undefined;
      for (const l of ctx.log.lines) {
        const t = l.text;
        if (t.includes("This server requires you to connect with Velocity")) kind ??= "required";
        else if (t.includes("Unable to verify player details")) kind ??= "secret";
        else if (/Unsupported forwarding version \d+, wanted upto \d+/.test(t)) kind ??= "version";
        else if (
          t.includes(
            "If you wish to use IP forwarding, please enable it in your BungeeCord config as well",
          )
        )
          kind ??= "bungee";
        else if (t.includes("did you forget to enable BungeeCord in spigot.yml?"))
          kind ??= "bungeeOff";
        else if (t.includes("did not send a forwarding request to the proxy")) kind ??= "velocity";
        else continue;
        lines.push(l.n);
      }
      if (!kind) return [];
      const words = {
        required: [
          "Players reached the server without going through Velocity",
          "Velocity forwarding is on in Paper's config, so the server only lets in players the proxy sends, and these didn't come through it: either they joined the server's own port directly, or the proxy is set to legacy or no forwarding.",
        ],
        secret: [
          "Velocity's forwarding secret doesn't match",
          "The proxy forwarded the player, but the secret it signed with isn't the one in Paper's config, so the server refused them.",
        ],
        version: [
          "Velocity and Paper disagree on the forwarding version",
          "The proxy sent player data in a newer forwarding format than this server understands. One end is much older than the other.",
        ],
        bungee: [
          "BungeeCord forwarding is only on at one end",
          "bungeecord: true is set in this server's spigot.yml, but the proxy isn't sending player data: ip_forward in BungeeCord's config.yml is off, or the proxy is Velocity using modern forwarding.",
        ],
        bungeeOff: [
          "The proxy is forwarding, but this server isn't expecting it",
          "BungeeCord's ip_forward is on, but bungeecord is false in this server's spigot.yml, so it can't read the player data in the handshake.",
        ],
        velocity: [
          "The server didn't answer Velocity's forwarding",
          "Velocity is set to modern forwarding and the backend server doesn't have Velocity support turned on, so it never asked for the player's details.",
        ],
      }[kind];
      return [{ lines, vars: { title: words[0], what: words[1] } }];
    },
    explain: "{what}",
    fix: [
      "Pick one forwarding mode and set it at both ends: modern in velocity.toml (player-info-forwarding-mode) with proxies.velocity.enabled: true in config/paper-global.yml is the safest.",
      "Copy forwarding.secret from the proxy folder into proxies.velocity.secret, exactly.",
      "Set online-mode=false on the backend and firewall its port so only the proxy can connect.",
    ],
    links: [L.forwarding, L.firewall],
  },

  // Velocity's LoginSessionHandler: "Backend server is online-mode!".
  {
    id: "velocity-backend-online-mode",
    title: "A backend server is in online mode",
    severity: "error",
    hint: "Backend server is online-mode",
    match: /Backend server is online-mode!/,
    key: "online",
    explain:
      "The server behind Velocity asked the player to log in with Mojang again, which a proxy can't do, so Velocity dropped the connection. Behind a proxy, the backend's online-mode must be off and forwarding on.",
    fix: [
      "On each backend, set online-mode=false in server.properties.",
      "Turn on Velocity forwarding there (proxies.velocity in config/paper-global.yml, with the secret from forwarding.secret).",
      "Keep online-mode = true in velocity.toml: the proxy does the checking.",
    ],
    links: [L.forwarding],
  },

  // Velocity's VelocityConfiguration: "The proxy is running in offline mode! This is a
  // security risk and you will NOT receive any support!", "Player info forwarding is
  // disabled! All players will appear to be connecting from the proxy and will have
  // offline-mode UUIDs.", "You don't have a forwarding secret set. This is required for
  // security.".
  {
    id: "velocity-insecure",
    title: "{title}",
    severity: "warning",
    match: (ctx) => {
      const offline = linesMatching(ctx, /The proxy is running in offline mode!/);
      const noForward = linesMatching(ctx, /Player info forwarding is disabled!/);
      const noSecret = linesMatching(
        ctx,
        /You don't have a forwarding secret set\. This is required for security\./,
      );
      const hits: Hit[] = [];
      if (offline.length)
        hits.push({
          lines: offline,
          key: "offline",
          vars: {
            title: "Velocity is in offline mode",
            what: "online-mode is false in velocity.toml, so the proxy doesn't check players with Mojang and anyone can join as anyone.",
          },
        });
      if (noForward.length)
        hits.push({
          lines: noForward,
          key: "forwarding",
          vars: {
            title: "Velocity isn't forwarding players",
            what: "player-info-forwarding-mode is none, so backend servers see every player coming from the proxy's address, with offline-mode UUIDs: skins, bans and per-player data won't match.",
          },
        });
      if (noSecret.length)
        hits.push({
          lines: noSecret,
          key: "secret",
          vars: {
            title: "Velocity has no forwarding secret",
            what: "Modern forwarding is signed with the secret in forwarding.secret, and that file is empty or missing, so backends can't tell the proxy's players from anyone else's.",
          },
        });
      return hits;
    },
    explain: "{what}",
    fix: [
      'In velocity.toml, set online-mode = true and player-info-forwarding-mode = "modern".',
      "On each Paper backend, turn on proxies.velocity with the same secret, and set online-mode=false.",
    ],
    links: [L.forwarding],
  },

  // A plugin compiled against CraftBukkit's versioned packages (v1_20_R3) or old NMS,
  // which 1.20.5+ Paper no longer has.
  {
    id: "plugin-wrong-version",
    title: "{plugin} was built for another Minecraft version",
    severity: "error",
    hint: [
      "NoClassDefFoundError",
      "ClassNotFoundException",
      "NoSuchMethodError",
      "NoSuchFieldError",
    ],
    match:
      /(?:NoClassDefFoundError|ClassNotFoundException|NoSuchMethodError|NoSuchFieldError): '?(?<missing>[^\s']*?(?:org[./]bukkit[./]craftbukkit[./]v1_\d+_R\d+|net[./]minecraft[./]server[./]v1_\d+_R\d+)[^\s']*)/,
    key: "{plugin}",
    vars: (g) =>
      g.plugin
        ? { ...g, missing: String(g.missing).replace(/\//g, ".") }
        : { ...g, plugin: "A plugin", missing: String(g.missing).replace(/\//g, ".") },
    explain:
      "It reaches into the server's internals ({missing}), which change with every Minecraft version, and the version it was built for isn't the one running.",
    fix: [
      "Download {plugin}'s build for your exact Minecraft version.",
      "If there isn't one yet, wait for an update or run the Minecraft version it supports.",
    ],
    links: [L.hangar],
  },

  // Paper's "Nag author(s): '[X]' of 'Y v1' about their usage of System.out/err.print.
  // Please use your plugin's logger instead (JavaPlugin#getLogger)."
  {
    id: "nag-system-out",
    title: "{plugin} writes to the console directly",
    severity: "info",
    hint: "Nag author",
    match:
      /Nag author\(s\): '[^']*' of '(?<plugin>\S+)(?: v\S+)?' about their usage of System\.out\/err\.print/,
    key: "{plugin}",
    explain:
      "{plugin} prints with System.out instead of its logger. It's harmless, but its lines show up without the plugin's name, which makes errors harder to trace.",
    fix: ["Nothing to fix on your side; the author can switch to getLogger()."],
    links: [],
  },
];

export const ruleById = (id: string) => RULES.find((r) => r.id === id);
