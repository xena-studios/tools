// The JVM flags themselves.

import type { JavaVersion } from "./software.ts";

/**
 * Aikar's flags, exactly as PaperMC documents them:
 * https://docs.papermc.io/paper/aikars-flags (the page as of its 18 September 2026 edit).
 *
 * The heap over 12GB variant (G1NewSizePercent=40, G1MaxNewSizePercent=50,
 * G1HeapRegionSize=16M, G1ReservePercent=15, InitiatingHeapOccupancyPercent=20)
 * is from the same page before PaperMC trimmed it in February 2024
 * (https://github.com/PaperMC/docs/blob/46857d786/docs/paper/admin/how-to/aikars-flags.md,
 * "If you are using an Xmx value greater than 12G"), and from Aikar's original
 * post (https://aikar.co/2018/07/02/tuning-the-jvm-g1gc-garbage-collector-flags-for-minecraft/).
 * itzg/minecraft-server's USE_AIKAR_FLAGS applies the same five changes.
 *
 * The order is PaperMC's.
 */
export function aikarFlags(heapMb: number): string[] {
  const large = heapMb > 12 * 1024;
  return [
    "-XX:+UseG1GC",
    "-XX:+ParallelRefProcEnabled",
    "-XX:MaxGCPauseMillis=200",
    "-XX:+UnlockExperimentalVMOptions",
    "-XX:+DisableExplicitGC",
    "-XX:+AlwaysPreTouch",
    `-XX:G1NewSizePercent=${large ? 40 : 30}`,
    `-XX:G1MaxNewSizePercent=${large ? 50 : 40}`,
    `-XX:G1HeapRegionSize=${large ? "16M" : "8M"}`,
    `-XX:G1ReservePercent=${large ? 15 : 20}`,
    "-XX:G1HeapWastePercent=5",
    "-XX:G1MixedGCCountTarget=4",
    `-XX:InitiatingHeapOccupancyPercent=${large ? 20 : 15}`,
    "-XX:G1MixedGCLiveThresholdPercent=90",
    "-XX:G1RSetUpdatingPauseTimePercent=5",
    "-XX:SurvivorRatio=32",
    "-XX:+PerfDisableSharedMem",
    "-XX:MaxTenuringThreshold=1",
    "-Dusing.aikars.flags=https://mcflags.emc.gs",
    "-Daikars.new.flags=true",
  ];
}

/** True when the heap is big enough for Aikar's over-12GB variant. */
export const usesLargeAikar = (heapMb: number) => heapMb > 12 * 1024;

/**
 * Generational ZGC.
 *
 * - Java 21 and 22: `-XX:+UseZGC` alone picks the old, non-generational ZGC, so
 *   generational needs `-XX:+ZGenerational` (JEP 439, https://openjdk.org/jeps/439).
 * - Java 23: generational is the default and ZGenerational is deprecated, with a
 *   warning if it's set (JEP 474, https://openjdk.org/jeps/474).
 * - Java 24 and later: the non-generational mode is gone and ZGenerational is
 *   obsolete (JEP 490, https://openjdk.org/jeps/490).
 *
 * Java 17's ZGC isn't generational at all, so this returns null for it.
 *
 * Beside the collector: AlwaysPreTouch (commit the whole heap at start, as with
 * Xms equal to Xmx), DisableExplicitGC (plugins calling System.gc()) and
 * PerfDisableSharedMem (no hsperfdata writes), for the same reasons as in Aikar's.
 */
export function zgcFlags(java: JavaVersion): string[] | null {
  if (java < 21) return null;
  return [
    "-XX:+UseZGC",
    ...(java < 23 ? ["-XX:+ZGenerational"] : []),
    "-XX:+AlwaysPreTouch",
    "-XX:+DisableExplicitGC",
    "-XX:+PerfDisableSharedMem",
  ];
}

/**
 * Velocity's recommended flags, which PaperMC gives for proxies:
 * https://docs.papermc.io/velocity/tuning ("Tune your startup flags"), in that
 * page's order. Used for BungeeCord and Waterfall too: they're proxies with the
 * same workload, and Aikar's flags are tuned for a game server's allocation rate.
 */
export const VELOCITY_FLAGS: readonly string[] = [
  "-XX:+UseG1GC",
  "-XX:G1HeapRegionSize=4M",
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:+ParallelRefProcEnabled",
  "-XX:+AlwaysPreTouch",
  "-XX:MaxInlineLevel=15",
];

/** `-Xmx8G`, or `-Xmx8704M` for a heap that isn't whole gigabytes. */
export function memoryValue(heapMb: number): string {
  return heapMb % 1024 === 0 ? `${heapMb / 1024}G` : `${heapMb}M`;
}

export const heapFlags = (heapMb: number) => [
  `-Xms${memoryValue(heapMb)}`,
  `-Xmx${memoryValue(heapMb)}`,
];
