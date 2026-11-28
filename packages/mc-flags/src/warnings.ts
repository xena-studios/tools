// What's likely wrong with a set of choices, in words.

import { usesLargeAikar } from "./flags.ts";
import { atLeast, formatMcVersion, parseMcVersion, requiredJava } from "./java.ts";
import { type FlagOptions, heapMbOf } from "./scripts.ts";
import { softwareInfo } from "./software.ts";

export interface Advice {
  id: string;
  level: "warning" | "note";
  text: string;
  /** A heap, in GB, that would clear it. */
  fixRamGb?: number;
}

export interface MachineOptions {
  /** The machine's or container's whole memory, in GB. */
  totalGb?: number;
  /** Docker, Pterodactyl or another container, where the limit is hard. */
  container: boolean;
}

const gb = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}GB`;
const floorHalf = (n: number) => Math.floor(n * 2) / 2;

/**
 * How much the machine needs beyond the heap. PaperMC: "reduce your Xmx and Xms
 * by about 1000-1500MB" (https://docs.papermc.io/paper/aikars-flags); itzg's
 * docs: an extra 25% of the heap for a container. Proxies follow Velocity's
 * tuning page: half the container, or "double the size of the proxy heap and
 * then add 2GB" for a machine (https://docs.papermc.io/velocity/tuning).
 */
export function headroom(totalGb: number, container: boolean, proxy: boolean) {
  if (proxy) return container ? totalGb / 2 : (totalGb + 2) / 2;
  return container ? Math.max(1.5, totalGb * 0.2) : Math.max(1, totalGb * 0.1);
}

export function advise(o: FlagOptions, m: MachineOptions): Advice[] {
  const out: Advice[] = [];
  const info = softwareInfo(o.software);
  const proxy = info.kind === "proxy";
  const heapGb = heapMbOf(o.ramGb) / 1024;
  const version = o.mcVersion.trim() ? parseMcVersion(o.mcVersion) : null;

  // Java against the Minecraft version.
  if (o.mcVersion.trim() && !version && !proxy) {
    out.push({
      id: "version-unknown",
      level: "note",
      text: `"${o.mcVersion.trim()}" isn't a release number, so Java isn't checked. Write it like 1.21.4 or 26.1.`,
    });
  }
  if (version && !proxy) {
    const need = requiredJava(version);
    const name = formatMcVersion(version);
    if (o.java < need) {
      out.push({
        id: "java-too-old",
        level: "warning",
        text: `Minecraft ${name} needs Java ${need} or newer, so it won't start on Java ${o.java}.`,
      });
    } else if (need === 17 && info.paperFamily && atLeast(version, [1, 20, 0]) && o.java < 21) {
      out.push({
        id: "java-paper-21",
        level: "note",
        text: `Paper recommends Java 21 for ${name}, though Java 17 runs it.`,
      });
    } else if (need <= 16 && o.java >= 17) {
      out.push({
        id: "java-old-version",
        level: "note",
        text: `Minecraft ${name} was built for Java ${need}. It may start on Java ${o.java}, but mods and plugins that old often don't${o.software === "forge" ? ", and Forge for it needs Java 8" : ""}.`,
      });
    }
  } else if (!proxy && !version && o.java < 25) {
    out.push({
      id: "java-latest",
      level: "note",
      text: `Minecraft 26.1 and later need Java 25. On an older version? Enter it to check Java ${o.java}.`,
    });
  }
  if (o.software === "velocity" && o.java < 25) {
    out.push({
      id: "java-velocity",
      level: "warning",
      text: `Current Velocity needs Java 25; Java ${o.java} only runs older builds.`,
    });
  }

  // The heap size.
  if (proxy) {
    if (heapGb > 4) {
      out.push({
        id: "proxy-ram",
        level: "warning",
        text: `${gb(heapGb)} is more than a proxy needs. Velocity's rule is 512MB per 500 players plus 1GB, so 2GB covers about 1,000 players. A proxy holds no worlds.`,
        fixRamGb: 2,
      });
    } else if (heapGb < 1) {
      out.push({
        id: "proxy-ram-low",
        level: "note",
        text: "Under 1GB leaves a proxy no room for error. Velocity's rule is 512MB per 500 players plus 1GB.",
        fixRamGb: 1,
      });
    }
  } else if (heapGb < 2) {
    out.push({
      id: "ram-low",
      level: "warning",
      text: `${gb(heapGb)} is very little: enough for a few players on vanilla at best. PaperMC recommends 6 to 10GB, and modpacks often want more.`,
      fixRamGb: 6,
    });
  } else if (heapGb < 4 && info.paperFamily) {
    out.push({
      id: "ram-paper",
      level: "note",
      text: `PaperMC recommends 6 to 10GB however few players you have, because G1 works better with more room. ${gb(heapGb)} runs, but will collect garbage often.`,
    });
  } else if (heapGb >= 32) {
    out.push({
      id: "ram-high",
      level: "warning",
      text: `From 32GB Java can't use compressed pointers, so the heap holds less than it did at 31GB. PaperMC also warns that more memory stops helping well before this.`,
      fixRamGb: 31,
    });
  } else if (heapGb > 20) {
    out.push({
      id: "ram-diminishing",
      level: "note",
      text: `More memory stops helping past a point; PaperMC warns that 32GB "will only waste your money". Measure with spark before going this high.`,
    });
  }

  // The machine.
  if (m.totalGb && m.totalGb > 0) {
    const need = headroom(m.totalGb, m.container, proxy);
    const left = m.totalGb - heapGb;
    // A proxy is never pointed past what it needs, even on a big machine.
    const fit = Math.min(floorHalf(m.totalGb - need), proxy ? 2 : Number.POSITIVE_INFINITY);
    if (left <= 0) {
      out.push({
        id: "over-total",
        level: "warning",
        text: `The heap is ${gb(heapGb)} but the ${m.container ? "container" : "machine"} has ${gb(m.totalGb)}. Java needs memory beyond the heap, so the server will be killed or won't start.`,
        fixRamGb: fit >= 0.5 ? fit : undefined,
      });
    } else if (left < need) {
      const where = m.container
        ? "In a container the limit is hard: go over and the kernel kills the server."
        : "Leave room for the operating system too.";
      out.push({
        id: "headroom",
        level: "warning",
        text: `Only ${gb(left)} is left beyond the heap. Java uses memory outside it (threads, its own code, native buffers), so leave ${proxy ? "what Velocity advises" : `about ${gb(need)}`}. ${where}`,
        fixRamGb: fit >= 0.5 ? fit : undefined,
      });
    }
  }

  // The collector.
  if (!proxy && o.gc === "zgc") {
    if (o.java < 21) {
      out.push({
        id: "zgc-java17",
        level: "warning",
        text: "Java 17's ZGC isn't generational, so these are Aikar's G1 flags instead. Generational ZGC needs Java 21 or newer.",
      });
    } else if (heapGb < 8) {
      out.push({
        id: "zgc-small",
        level: "warning",
        text: `ZGC pays off on big heaps with spare cores. On ${gb(heapGb)} it uses more memory and CPU than G1 for little gain: Aikar's flags are the better choice here.`,
      });
    }
  }
  if (proxy && o.gc === "zgc") {
    out.push({
      id: "proxy-gc",
      level: "note",
      text: "Proxies get Velocity's own G1 flags, whatever the collector setting. Velocity's docs advise ZGC only with caution.",
    });
  }
  if (!proxy && o.gc === "g1" && usesLargeAikar(heapMbOf(o.ramGb))) {
    out.push({
      id: "aikar-large",
      level: "note",
      text: "Over 12GB, so these use Aikar's larger-heap values. If old-generation collections go up, go back to the base flags.",
    });
  }

  // The software.
  if (o.software === "folia") {
    out.push({
      id: "folia",
      level: "warning",
      text: "Folia is for big servers whose players spread out, on many cores (PaperMC suggests 16 or more) with a pre-generated world. Most plugins don't run on it unless they say they support Folia, and only experimental builds exist.",
    });
  }
  if (o.software === "bungeecord") {
    out.push({
      id: "waterfall-eol",
      level: "note",
      text: "Waterfall has reached end of life and gets no updates. PaperMC recommends moving to Velocity.",
    });
  }
  if (o.software === "forge" && version && !atLeast(version, [1, 17, 0])) {
    out.push({
      id: "forge-old",
      level: "note",
      text: `Forge for ${formatMcVersion(version)} is a jar: put its full file name in the jar field.`,
    });
  }
  return out;
}
