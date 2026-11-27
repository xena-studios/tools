// Every tool, live or planned. The home page, the ⌘K palette, the sitemap and
// each tool's page header read from here, so adding a tool starts with one entry.

export type Category = "Text" | "Server" | "Lookup" | "Branding";

export const CATEGORIES: readonly Category[] = ["Text", "Server", "Lookup", "Branding"];

export interface Tool {
  slug: string;
  name: string;
  category: Category;
  /** One sentence: what it does for a server owner. Also the meta description. */
  summary: string;
  /** Extra words people search for. */
  keywords: string[];
  status: "live" | "planned";
}

export const TOOLS: readonly Tool[] = [
  {
    slug: "gradient",
    name: "Gradient Text",
    category: "Text",
    summary:
      "Colour text with a smooth gradient for chat, ranks, MOTDs and item names, in every format servers and plugins read.",
    keywords: ["rgb", "hex", "color", "colour", "minimessage", "prefix", "rank", "rainbow", "&#"],
    status: "live",
  },
  {
    slug: "text-converter",
    name: "Text Converter",
    category: "Text",
    summary:
      "Paste text in any format (& codes, MiniMessage or JSON), see it as players will, and convert it to any other.",
    keywords: ["minimessage", "legacy", "json", "tellraw", "convert", "preview", "editor", "§"],
    status: "live",
  },
  {
    slug: "motd",
    name: "MOTD Generator",
    category: "Text",
    summary:
      "Design your server list message with a true-to-game preview, for server.properties and proxies.",
    keywords: ["server list", "motd", "velocity", "bungeecord", "server.properties"],
    status: "live",
  },
  {
    slug: "flags",
    name: "Startup Flags",
    category: "Server",
    summary:
      "Generate a start script with tuned JVM flags for your RAM, Java version and server software.",
    keywords: ["aikar", "jvm", "java", "zgc", "g1gc", "start.sh", "pterodactyl", "memory"],
    status: "planned",
  },
  {
    slug: "log-analyzer",
    name: "Log Analyzer",
    category: "Server",
    summary:
      "Paste a server log or crash report and get the problems explained, with the fix for each.",
    keywords: ["crash", "latest.log", "error", "exception", "mclo.gs", "debug"],
    status: "planned",
  },
  {
    slug: "status",
    name: "Server Status",
    category: "Lookup",
    summary:
      "Check whether a Java or Bedrock server is online, with its MOTD, version, players and ping.",
    keywords: ["ping", "online", "bedrock", "geyser", "srv", "players"],
    status: "planned",
  },
  {
    slug: "player",
    name: "Player Lookup",
    category: "Lookup",
    summary: "Find a player's UUID and skin from their name, or their name from a UUID.",
    keywords: ["uuid", "skin", "head", "name", "mojang", "offline uuid"],
    status: "planned",
  },
  {
    slug: "server-icon",
    name: "Server Icon",
    category: "Branding",
    summary: "Turn any image into a 64×64 server-icon.png, previewed in the server list.",
    keywords: ["icon", "favicon", "server-icon.png", "64x64"],
    status: "live",
  },
];

export const LIVE_TOOLS = TOOLS.filter((t) => t.status === "live");

export function toolBySlug(slug: string): Tool {
  const tool = TOOLS.find((t) => t.slug === slug);
  if (!tool) throw new Error(`No tool "${slug}" in tools.ts`);
  return tool;
}

export const SITE = {
  name: "Xena Studios tools",
  url: "https://tools.xenastudios.co",
  tagline: "Tools for running a Minecraft server.",
  repo: "https://github.com/xena-studios/tools",
} as const;
