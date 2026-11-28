// biome-ignore-all lint/suspicious/noAssignInExpressions: each line is tried against a chain of patterns, and the match is kept
// What the log says about the server: its software, versions, plugins and mode.

import type { ParsedLog } from "./parse.ts";

export interface Plugin {
  name: string;
  version?: string;
}

export interface Summary {
  /** "Paper", "Purpur", "Spigot", "Vanilla", "Fabric", "Forge", "NeoForge", "Velocity"… */
  software?: string;
  /** The software's own version or build, like "1.21.4-232" or "3.4.0-SNAPSHOT". */
  softwareVersion?: string;
  minecraft?: string;
  /** "21.0.5", or "21" when that's all the log says. */
  java?: string;
  plugins: Plugin[];
  /** "plugins" on Bukkit-based servers and proxies, "mods" on Fabric and Forge. */
  pluginKind: "plugins" | "mods";
  /** Seconds from start to "Done", the last time the log shows it. */
  startup?: number;
  mode?: "online" | "offline" | "proxy";
  port?: string;
}

const SOFTWARE_LINE =
  /This server is running (\S+) version (\S+)(?: \(MC: ([\w.-]+)\))?.*?\(Implementing API version ([\w.-]+?)(?:-R\d.*)?\)/;

/** Bukkit forks report themselves by name; the CraftBukkit base name means Spigot. */
const SOFTWARE_NAMES: Record<string, string> = {
  craftbukkit: "Spigot",
  paper: "Paper",
  purpur: "Purpur",
  folia: "Folia",
  pufferfish: "Pufferfish",
  leaves: "Leaves",
  leaf: "Leaf",
  canvas: "Canvas",
};

export function summarise(log: ParsedLog): Summary {
  const s: Summary = { plugins: [], pluginKind: "plugins" };
  const plugins = new Map<string, Plugin>();
  const add = (name: string, version?: string) => {
    const key = name.toLowerCase();
    if (!plugins.has(key)) plugins.set(key, { name, version });
  };
  let offline = false;
  let proxyWarning = false;
  let modList = false;

  for (const e of log.entries) {
    const msg = e.message;
    let m: RegExpExecArray | null;

    if ((m = SOFTWARE_LINE.exec(msg))) {
      const name = m[1] ?? "";
      s.software = SOFTWARE_NAMES[name.toLowerCase()] ?? name;
      s.softwareVersion = m[2]?.replace(/^git-[A-Za-z]+-/, "");
      s.minecraft ??= m[3] ?? m[4];
    } else if ((m = /^\[bootstrap\] Loading (\w+) (\S+) \(.*?\) for Minecraft (\S+)/.exec(msg))) {
      // Paper's bootstrap: "Loading Paper 1.21.4-232-main@abc1234 (2025-…) for Minecraft 1.21.4"
      s.software = SOFTWARE_NAMES[(m[1] ?? "").toLowerCase()] ?? m[1];
      s.softwareVersion = m[2];
      s.minecraft = m[3];
    } else if ((m = /^Starting minecraft server version (\S+)/i.exec(msg))) {
      s.minecraft = m[1];
      s.software ??= "Vanilla";
    } else if ((m = /^Loading Minecraft (\S+) with Fabric Loader (\S+)/.exec(msg))) {
      s.minecraft = m[1];
      s.software = "Fabric";
      s.softwareVersion = m[2];
      s.pluginKind = "mods";
    } else if ((m = /^Loading Minecraft (\S+) with Quilt Loader (\S+)/.exec(msg))) {
      s.minecraft = m[1];
      s.software = "Quilt";
      s.softwareVersion = m[2];
      s.pluginKind = "mods";
    } else if ((m = /^(Neo)?Forge mod loading, version (\S+), for MC (\S+)/.exec(msg))) {
      s.software = m[1] ? "NeoForge" : "Forge";
      s.softwareVersion = m[2]?.replace(/,$/, "");
      s.minecraft = m[3];
      s.pluginKind = "mods";
    } else if ((m = /^Booting up Velocity (\S+?)(?:\.\.\.)?(?: |$)/.exec(msg))) {
      s.software = "Velocity";
      s.softwareVersion = m[1];
    } else if ((m = /^Enabled BungeeCord version (\S+)/.exec(msg))) {
      s.software = "BungeeCord";
      s.softwareVersion = m[1];
    } else if ((m = /^Enabled Waterfall version (\S+)/.exec(msg))) {
      s.software = "Waterfall";
      s.softwareVersion = m[1];
    }

    // Paper's bootstrap: "Running Java 21 (OpenJDK 64-Bit Server VM 21.0.5+11-LTS; …) on Linux …"
    if ((m = /Running Java (\d+) \((?:[^;)]*?VM )?(\d[\w.+-]*)/.exec(msg))) {
      s.java = m[2]?.replace(/\+.*$/, "") ?? m[1];
    } else if ((m = /starting: java version (\S+)/.exec(msg))) {
      // Forge's ModLauncher: "ModLauncher 10.0.9 starting: java version 17.0.8 by Eclipse Adoptium"
      s.java = m[1];
    } else if ((m = /^Java: (\d[\w.]*)/.exec(msg))) {
      s.java = m[1];
    }

    // Bukkit and Paper: "[Vault] Loading server plugin Vault v1.7.3-b131"
    if ((m = /^(?:\[[^\]]+\] )?Loading (?:server )?plugin (\S+) v(\S+)/.exec(msg))) {
      add(m[1] ?? "", m[2]);
    } else if ((m = /^(?:\[[^\]]+\] )?Enabling (\S+) v(\S+)/.exec(msg))) {
      add(m[1] ?? "", m[2]);
    } else if ((m = /^\[PluginInitializerManager\] (?:Bukkit|Paper) plugins \(\d+\):/.exec(msg))) {
      // Paper: "Bukkit plugins (9):" then " - LuckPerms (5.4.145), Vault (1.7.3-b131), …"
      for (const p of e.rest.join(" ").matchAll(/(?:^|,|-)\s*([\w.-]+) \(([^)]+)\)/g))
        add(p[1] ?? "", p[2]);
    } else if ((m = /^Loaded plugin (\S+) (\S+)(?: by |$)/.exec(msg))) {
      // Velocity: "Loaded plugin luckperms 5.4.141 by Luck"
      add(m[1] ?? "", m[2]);
    } else if ((m = /^Loading (\d+) mods:/.exec(msg))) {
      // Fabric: "Loading 52 mods:" then "\t- fabric-api 0.92.2+1.20.1", one a line.
      modList = true;
      s.pluginKind = "mods";
      for (const line of e.rest) {
        const mod = /^\s+- ([\w.-]+) (\S+)/.exec(line);
        if (mod?.[1] && !/^\s+\|/.test(line)) add(mod[1], mod[2]);
      }
    }

    if ((m = /^Done \((\d+(?:[.,]\d+)?)s\)!/.exec(msg)))
      s.startup = Number.parseFloat((m[1] ?? "").replace(",", "."));

    if ((m = /^Starting Minecraft server on (\S+)/.exec(msg))) s.port = m[1];
    else if ((m = /^Listening on \/?(\S+)/.exec(msg))) s.port = m[1];

    if (msg.includes("SERVER IS RUNNING IN OFFLINE/INSECURE MODE")) {
      offline = true;
      const next = e.rest.join(" ");
      if (/use (?:BungeeCord|Velocity|a proxy)/.test(next)) proxyWarning = true;
    }
    if (/^Whilst this makes it possible to use (?:BungeeCord|Velocity)/.test(msg))
      proxyWarning = true;
    if (msg.startsWith("The proxy is running in offline mode!")) offline = true;
  }

  // A crash report fills in what the log didn't say.
  const d = log.crash?.details;
  if (d) {
    s.minecraft ??= d["Minecraft Version"];
    const java = d["Java Version"] ?? d.Java;
    if (java) s.java ??= java.split(/[,\s]/)[0];
    const running = d["CraftBukkit Information"] ?? "";
    const m = /Running: (\S+) version (\S+) \(MC: ([\w.]+)\)/.exec(running);
    if (m) {
      s.software ??= SOFTWARE_NAMES[(m[1] ?? "").toLowerCase()] ?? m[1];
      s.softwareVersion ??= m[2];
    }
    if (!s.software && d["Fabric Mods"] !== undefined) s.software = "Fabric";
    if (!s.software && d.ModLauncher !== undefined) s.software = "Forge";
    if (!s.software && d["Server Running"]) s.software = "Vanilla";
    if (log.crash?.mods.length) {
      s.pluginKind = "mods";
      if (!modList) for (const mod of log.crash.mods) add(mod.id, mod.version);
    }
  }

  // Fabric lists itself, Minecraft and Java among its mods; they aren't add-ons.
  for (const builtin of ["minecraft", "java", "fabricloader", "forge", "neoforge", "mixinextras"])
    plugins.delete(builtin);

  s.plugins = [...plugins.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
  if (offline) s.mode = proxyWarning ? "proxy" : "offline";
  else if (s.port || s.startup !== undefined) s.mode = "online";
  return s;
}
