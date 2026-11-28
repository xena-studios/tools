// Which Java a Minecraft version needs.
//
// From the `javaVersion.majorVersion` in each release's version JSON in
// Mojang's manifest (https://piston-meta.mojang.com/mc/game/version_manifest_v2.json),
// checked November 2026:
//   1.16.5 and older: 8    1.17 to 1.17.1: 16    1.18 to 1.20.4: 17
//   1.20.5 to 1.21.11: 21  26.1 and later (the year-numbered releases): 25

export type McVersion = readonly [number, number, number];

/** Reads "1.21.4", "1.20", "26.1" or "26.1.2". Null for anything else. */
export function parseMcVersion(input: string): McVersion | null {
  const m = /^\s*(\d{1,3})\.(\d{1,3})(?:\.(\d{1,3}))?\s*$/.exec(input);
  if (!m) return null;
  const v: McVersion = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  // Before 2026 every release was 1.x; from 26.1 they're numbered by year.
  if (v[0] === 1 ? v[1] < 0 || v[1] > 21 : v[0] < 26) return null;
  return v;
}

export function compareVersions(a: McVersion, b: McVersion): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export const atLeast = (v: McVersion, min: McVersion) => compareVersions(v, min) >= 0;

/** The oldest Java that version's server runs on. */
export function requiredJava(v: McVersion): 8 | 16 | 17 | 21 | 25 {
  if (atLeast(v, [26, 1, 0])) return 25;
  if (atLeast(v, [1, 20, 5])) return 21;
  if (atLeast(v, [1, 18, 0])) return 17;
  if (atLeast(v, [1, 17, 0])) return 16;
  return 8;
}

export const formatMcVersion = (v: McVersion) =>
  v[2] === 0 ? `${v[0]}.${v[1]}` : `${v[0]}.${v[1]}.${v[2]}`;
