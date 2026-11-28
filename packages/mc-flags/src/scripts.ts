// Start scripts, panel commands and compose files built from the flags.

import { aikarFlags, heapFlags, memoryValue, VELOCITY_FLAGS, zgcFlags } from "./flags.ts";
import { atLeast, formatMcVersion, parseMcVersion } from "./java.ts";
import { type JavaVersion, type Software, softwareInfo } from "./software.ts";

export type Collector = "g1" | "zgc";

export interface FlagOptions {
  /** The heap, Xms and Xmx, in GB. */
  ramGb: number;
  software: Software;
  java: JavaVersion;
  gc: Collector;
  /** "1.21.4", "26.1"… or empty. */
  mcVersion: string;
  /** The jar's file name; empty means the software's usual name. */
  jar: string;
  nogui: boolean;
  restart: boolean;
}

export type OutputFormat = "sh" | "bat" | "pterodactyl" | "docker" | "flags";

export const OUTPUT_FORMATS: readonly { id: OutputFormat; label: string; usedBy: string }[] = [
  { id: "sh", label: "start.sh", usedBy: "Linux and macOS: a VPS or a home server" },
  { id: "bat", label: "start.bat", usedBy: "Windows" },
  { id: "pterodactyl", label: "Pterodactyl", usedBy: "The startup command in a Pterodactyl panel" },
  { id: "docker", label: "Docker compose", usedBy: "compose.yaml for itzg/minecraft-server" },
  { id: "flags", label: "Flags only", usedBy: "Just the JVM flags, for a host's own field" },
];

export const isOutputFormat = (v: unknown): v is OutputFormat =>
  OUTPUT_FORMATS.some((f) => f.id === v);

/** Whole megabytes, at least 512. */
export const heapMbOf = (ramGb: number) => Math.max(512, Math.round(ramGb * 1024));

/**
 * The collector the flags really use: proxies always get Velocity's flags, and
 * Java 17 has no generational ZGC, so both fall back to G1.
 */
export function effectiveCollector(o: Pick<FlagOptions, "software" | "gc" | "java">) {
  if (softwareInfo(o.software).kind === "proxy") return "proxy" as const;
  if (o.gc === "zgc" && zgcFlags(o.java)) return "zgc" as const;
  return "g1" as const;
}

/** The GC flags alone, without the heap size. */
export function gcFlags(o: Pick<FlagOptions, "software" | "gc" | "java">, heapMb: number) {
  const c = effectiveCollector(o);
  if (c === "proxy") return [...VELOCITY_FLAGS];
  if (c === "zgc") return zgcFlags(o.java) ?? [];
  return aikarFlags(heapMb);
}

/** Every JVM flag: Xms, Xmx, then the collector's. */
export function jvmFlags(o: FlagOptions): string[] {
  const heap = heapMbOf(o.ramGb);
  return [...heapFlags(heap), ...gcFlags(o, heap)];
}

/**
 * Forge and NeoForge from 1.17 have no server jar to run: the installer writes
 * run.sh and run.bat, which start Java with `@user_jvm_args.txt` (where the JVM
 * flags go) and `@libraries/…/unix_args.txt`. Older Forge is a plain jar.
 */
export function forgeUsesArgsFile(o: Pick<FlagOptions, "software" | "mcVersion">) {
  if (o.software !== "forge") return false;
  const v = parseMcVersion(o.mcVersion);
  return !v || atLeast(v, [1, 17, 0]);
}

const jarName = (o: FlagOptions) => o.jar.trim() || softwareInfo(o.software).jar;

/** POSIX shell quoting, only when the name needs it. */
const shQuote = (s: string) => (/^[\w./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`);
/** cmd.exe quoting: double quotes, which a file name can't contain. */
const batQuote = (s: string) => (/^[\w./-]+$/.test(s) ? s : `"${s.replace(/"/g, "")}"`);

const noguiArg = (o: FlagOptions) => {
  const flag = softwareInfo(o.software).nogui;
  return o.nogui && flag ? ` ${flag}` : "";
};

/** `start.sh`, for Linux and macOS. */
export function startSh(o: FlagOptions): string {
  const flags = jvmFlags(o).join(" ");
  const lines = [
    "#!/usr/bin/env sh",
    "",
    "# Run from the folder this script is in.",
    'cd "$(dirname "$0")"',
    "",
  ];
  let run: string;
  if (forgeUsesArgsFile(o)) {
    lines.push(
      "# Forge and NeoForge start through the installer's run.sh, which reads the",
      "# JVM flags from user_jvm_args.txt. This writes them there on every start,",
      "# so change them here, not in that file.",
      "cat > user_jvm_args.txt <<'EOF'",
      flags,
      "EOF",
      "",
    );
    run = `./run.sh${noguiArg(o)}`;
  } else {
    run = `java ${flags} -jar ${shQuote(jarName(o))}${noguiArg(o)}`;
  }
  if (o.restart) {
    lines.push(
      "while true; do",
      `  ${run}`,
      '  echo "Stopped. Restarting in 5 seconds: press Ctrl+C to stop."',
      "  sleep 5",
      "done",
    );
  } else lines.push(run);
  return `${lines.join("\n")}\n`;
}

/** `start.bat`, for Windows. */
export function startBat(o: FlagOptions): string {
  const flags = jvmFlags(o).join(" ");
  const lines = ["@echo off", "rem Run from the folder this file is in.", 'cd /d "%~dp0"', ""];
  let run: string;
  if (forgeUsesArgsFile(o)) {
    lines.push(
      "rem Forge and NeoForge start through the installer's run.bat, which reads the",
      "rem JVM flags from user_jvm_args.txt. This writes them there on every start,",
      "rem so change them here, not in that file.",
      `>user_jvm_args.txt echo ${flags}`,
      "",
    );
    run = `call run.bat${noguiArg(o)}`;
  } else {
    run = `java ${flags} -jar ${batQuote(jarName(o))}${noguiArg(o)}`;
  }
  if (o.restart) {
    lines.push(
      ":start",
      run,
      "echo Stopped. Restarting in 5 seconds: press Ctrl+C to stop.",
      "timeout /t 5 /nobreak >nul",
      "goto start",
    );
  } else lines.push(run, "pause");
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * The share of the panel's memory given to the heap in the Pterodactyl command.
 * Wings already lets the container use 5 to 15% more than the panel's figure
 * (https://github.com/pterodactyl/wings/blob/develop/config/config_docker.go, Overhead),
 * which is less than the 1 to 1.5GB PaperMC asks to leave free, so the heap
 * takes 85%. Proxies take half, as Velocity's docs advise for containers.
 */
export const pterodactylShare = (software: Software) =>
  softwareInfo(software).kind === "proxy" ? 50 : 85;

/** The panel memory, in MB, that gives this heap with the Pterodactyl command. */
export const pterodactylPanelMb = (o: Pick<FlagOptions, "ramGb" | "software">) =>
  Math.ceil((heapMbOf(o.ramGb) * 100) / pterodactylShare(o.software));

/**
 * A Pterodactyl startup command. The panel's `{{VARIABLE}}`s become shell
 * variables and the line is expanded by the image's entrypoint
 * (https://github.com/pterodactyl/yolks/blob/master/java/entrypoint.sh), which is
 * why the stock Forge egg can use `$( … )` and this can use `$(( … ))` arithmetic.
 * SERVER_MEMORY is the panel's memory in MB (set by Wings); SERVER_JARFILE is the
 * egg's jar variable.
 */
export function pterodactylCommand(o: FlagOptions): string {
  const info = softwareInfo(o.software);
  const share = pterodactylShare(o.software);
  const mem = share === 50 ? "$(({{SERVER_MEMORY}}/2))M" : `$(({{SERVER_MEMORY}}*${share}/100))M`;
  const parts = ["java", `-Xms${mem}`, `-Xmx${mem}`, ...gcFlags(o, heapMbOf(o.ramGb))];
  if (info.pterodactylConsole) parts.push("-Dterminal.jline=false", "-Dterminal.ansi=true");
  parts.push(
    forgeUsesArgsFile(o)
      ? // As the stock Forge egg does: its installer leaves unix_args.txt in the server folder.
        '$( [[ ! -f unix_args.txt ]] && printf %s "-jar {{SERVER_JARFILE}}" || printf %s "@unix_args.txt" )'
      : "-jar {{SERVER_JARFILE}}",
  );
  return parts.join(" ") + noguiArg(o);
}

const yamlQuote = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/**
 * A compose.yaml service for itzg/minecraft-server, or itzg/mc-proxy for a
 * proxy (https://docker-minecraft-server.readthedocs.io/en/latest/configuration/jvm-options/,
 * https://github.com/itzg/docker-mc-proxy). For G1 it uses the image's own
 * USE_AIKAR_FLAGS, which also switches to the over-12GB variant from MEMORY.
 */
export function dockerCompose(o: FlagOptions, limitGb?: number): string {
  const info = softwareInfo(o.software);
  const proxy = info.kind === "proxy";
  const heap = heapMbOf(o.ramGb);
  const collector = effectiveCollector(o);
  const version = parseMcVersion(o.mcVersion);
  const out = [
    "services:",
    proxy ? "  proxy:" : "  mc:",
    `    image: itzg/${proxy ? "mc-proxy" : "minecraft-server"}:java${o.java}`,
  ];
  if (o.restart) out.push("    restart: unless-stopped");
  if (!proxy) out.push("    tty: true", "    stdin_open: true");
  if (limitGb) out.push(`    mem_limit: ${memoryValue(heapMbOf(limitGb))}`);
  out.push(
    "    ports:",
    o.software === "bungeecord" ? '      - "25565:25577"' : '      - "25565:25565"',
    "    environment:",
  );
  if (!proxy) out.push('      EULA: "TRUE"');
  out.push(
    `      TYPE: ${info.dockerType}${info.dockerTypeAlt ? ` # or ${info.dockerTypeAlt}` : ""}`,
  );
  if (version && !proxy) out.push(`      VERSION: ${yamlQuote(formatMcVersion(version))}`);
  out.push(`      MEMORY: ${memoryValue(heap)}`);
  if (collector === "g1") out.push('      USE_AIKAR_FLAGS: "true"');
  else out.push(`      JVM_XX_OPTS: ${yamlQuote(gcFlags(o, heap).join(" "))}`);
  out.push("    volumes:", proxy ? "      - ./proxy:/server" : "      - ./data:/data");
  return `${out.join("\n")}\n`;
}

/** Every output, by format. */
export function writeOutput(format: OutputFormat, o: FlagOptions, limitGb?: number): string {
  switch (format) {
    case "sh":
      return startSh(o);
    case "bat":
      return startBat(o);
    case "pterodactyl":
      return pterodactylCommand(o);
    case "docker":
      return dockerCompose(o, limitGb);
    case "flags":
      return jvmFlags(o).join(" ");
  }
}
