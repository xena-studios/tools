// The server software a start script can be written for.

export type Software =
  | "paper"
  | "purpur"
  | "folia"
  | "velocity"
  | "bungeecord"
  | "fabric"
  | "forge"
  | "vanilla";

export type JavaVersion = 17 | 21 | 25;

export const JAVA_VERSIONS: readonly JavaVersion[] = [17, 21, 25];

export const isJavaVersion = (v: unknown): v is JavaVersion =>
  JAVA_VERSIONS.includes(v as JavaVersion);

export interface SoftwareInfo {
  id: Software;
  label: string;
  /** A few words on what it is, for the picker's title. */
  note: string;
  kind: "server" | "proxy";
  /** The jar's usual name, used when the jar field is empty. */
  jar: string;
  /**
   * How it turns off the server GUI, or null when it has none. Paper's docs
   * write `--nogui`; Mojang's write `nogui`. Both are read by the same option.
   */
  nogui: "--nogui" | "nogui" | null;
  /** `TYPE` for itzg/minecraft-server or itzg/mc-proxy. */
  dockerType: string;
  /** Another TYPE the same option covers, written as a comment. */
  dockerTypeAlt?: string;
  /** Pterodactyl's eggs for it pass jline options for the panel console. */
  pterodactylConsole: boolean;
  /** Paper's family: Paper, Purpur and Folia. */
  paperFamily: boolean;
}

export const SOFTWARE: readonly SoftwareInfo[] = [
  {
    id: "paper",
    label: "Paper",
    note: "Plugins, the usual choice",
    kind: "server",
    jar: "paper.jar",
    nogui: "--nogui",
    dockerType: "PAPER",
    pterodactylConsole: true,
    paperFamily: true,
  },
  {
    id: "purpur",
    label: "Purpur",
    note: "A Paper fork with more settings",
    kind: "server",
    jar: "purpur.jar",
    nogui: "--nogui",
    dockerType: "PURPUR",
    pterodactylConsole: true,
    paperFamily: true,
  },
  {
    id: "folia",
    label: "Folia",
    note: "Paper split across many cores, for big servers",
    kind: "server",
    jar: "folia.jar",
    nogui: "--nogui",
    dockerType: "FOLIA",
    pterodactylConsole: true,
    paperFamily: true,
  },
  {
    id: "velocity",
    label: "Velocity",
    note: "Proxy",
    kind: "proxy",
    jar: "velocity.jar",
    nogui: null,
    dockerType: "VELOCITY",
    pterodactylConsole: false,
    paperFamily: false,
  },
  {
    id: "bungeecord",
    label: "BungeeCord/Waterfall",
    note: "Proxy",
    kind: "proxy",
    jar: "BungeeCord.jar",
    nogui: null,
    dockerType: "BUNGEECORD",
    dockerTypeAlt: "WATERFALL",
    pterodactylConsole: false,
    paperFamily: false,
  },
  {
    id: "fabric",
    label: "Fabric",
    note: "Mods",
    kind: "server",
    jar: "fabric-server-launch.jar",
    nogui: "nogui",
    dockerType: "FABRIC",
    pterodactylConsole: false,
    paperFamily: false,
  },
  {
    id: "forge",
    label: "Forge/NeoForge",
    note: "Mods",
    kind: "server",
    jar: "forge.jar",
    nogui: "nogui",
    dockerType: "FORGE",
    dockerTypeAlt: "NEOFORGE",
    pterodactylConsole: true,
    paperFamily: false,
  },
  {
    id: "vanilla",
    label: "Vanilla",
    note: "Mojang's own server.jar",
    kind: "server",
    jar: "server.jar",
    nogui: "nogui",
    dockerType: "VANILLA",
    pterodactylConsole: false,
    paperFamily: false,
  },
];

export const isSoftware = (v: unknown): v is Software => SOFTWARE.some((s) => s.id === v);

export function softwareInfo(id: Software): SoftwareInfo {
  const s = SOFTWARE.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown software "${id}"`);
  return s;
}
