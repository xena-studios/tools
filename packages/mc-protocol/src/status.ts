// The Status Response's JSON, read defensively: servers, proxies and plugins
// write it in many shapes, and anything can be missing or the wrong type.

export type Description = string | Record<string, unknown> | unknown[];

export interface SamplePlayer {
  name: string;
  /** As the server sent it; often all zeros for a fake line of text. */
  id: string;
}

export interface Mod {
  id: string;
  version?: string;
}

export interface ModInfo {
  /** Where the list came from: FML's modinfo (1.7 to 1.12) or forgeData (1.13+), which NeoForge keeps. */
  loader: "forge" | "fabric" | "other";
  mods: Mod[];
  /** forgeData says it left mods out to keep the response small. */
  truncated: boolean;
}

export interface JavaStatus {
  version: { name: string; protocol: number | null };
  players: { online: number | null; max: number | null; sample: SamplePlayer[] };
  /** The MOTD: a string with § codes, or a JSON text component. */
  description: Description;
  /** A data:image/png;base64 URI, if the server has an icon. */
  favicon: string | null;
  enforcesSecureChat: boolean | null;
  previewsChat: boolean | null;
  mods: ModInfo | null;
  /** NeoForge and some mods set isModded: true, with or without a mod list. */
  modded: boolean | null;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const str = (v: unknown): string | null =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : null;

const int = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;

const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);

const FAVICON = /^data:image\/png;base64,[A-Za-z0-9+/=\s]+$/;

export class StatusParseError extends Error {}

function readMods(json: Record<string, unknown>): ModInfo | null {
  // 1.13+ Forge (and NeoForge, which keeps the name).
  const forge = json.forgeData;
  if (isObject(forge)) {
    const list = Array.isArray(forge.mods) ? forge.mods : [];
    const mods = list.flatMap((m): Mod[] => {
      if (!isObject(m)) return [];
      const id = str(m.modId) ?? str(m.modid);
      if (!id) return [];
      const version = str(m.modmarker) ?? str(m.version);
      return [version ? { id, version } : { id }];
    });
    return {
      loader: "forge",
      mods,
      truncated: forge.truncated === true,
    };
  }
  // 1.7 to 1.12 Forge: modinfo { type: "FML", modList: [{ modid, version }] }.
  const info = json.modinfo;
  if (isObject(info)) {
    const list = Array.isArray(info.modList) ? info.modList : [];
    const mods = list.flatMap((m): Mod[] => {
      if (!isObject(m)) return [];
      const id = str(m.modid) ?? str(m.modId);
      if (!id) return [];
      const version = str(m.version);
      return [version ? { id, version } : { id }];
    });
    const type = (str(info.type) ?? "").toLowerCase();
    return {
      loader: type === "fml" || type === "forge" ? "forge" : type === "fabric" ? "fabric" : "other",
      mods,
      truncated: false,
    };
  }
  return null;
}

/** Reads a Status Response's JSON string. Throws StatusParseError if it isn't a status at all. */
export function parseStatus(raw: string): JavaStatus {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new StatusParseError("The status isn't valid JSON");
  }
  if (!isObject(json)) throw new StatusParseError("The status isn't a JSON object");

  const version = isObject(json.version) ? json.version : {};
  const players = isObject(json.players) ? json.players : {};
  const sample = (Array.isArray(players.sample) ? players.sample : [])
    .flatMap((p): SamplePlayer[] => {
      if (!isObject(p)) return [];
      const name = str(p.name);
      return name === null ? [] : [{ name, id: str(p.id) ?? "" }];
    })
    .slice(0, 100);

  const d = json.description;
  const description: Description =
    typeof d === "string" || isObject(d) || Array.isArray(d) ? d : d == null ? "" : String(d);

  const favicon =
    typeof json.favicon === "string" && FAVICON.test(json.favicon) ? json.favicon : null;

  return {
    version: { name: str(version.name) ?? "", protocol: int(version.protocol) },
    players: { online: int(players.online), max: int(players.max), sample },
    description,
    favicon: favicon?.replace(/\s/g, "") ?? null,
    enforcesSecureChat: bool(json.enforcesSecureChat),
    previewsChat: bool(json.previewsChat),
    mods: readMods(json),
    modded: bool(json.isModded),
  };
}
