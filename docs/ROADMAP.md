# Roadmap

What's built, what's next, and how the rest will work. A tool is planned until it's in [`tools.ts`](../apps/web/src/tools.ts) as `live`.

## Tools

### First release

| Tool           | State | Notes                                                                                                                                                                                                          |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gradient Text  | Built | Every legacy hex form, MiniMessage (per letter or the `<gradient>` tag), JSON for 1.21.5+ and older                                                                                                            |
| Text Converter | Built | Reads legacy, MiniMessage and JSON; writes all of them; warns what a format can't hold                                                                                                                         |
| MOTD Generator | Built | Two lines with a server-list preview; output for `server.properties` (`§` escapes, hex for Paper or the 16 colours for vanilla), Velocity, BungeeCord, MiniMOTD and MiniMessage                       |
| Startup Flags  | Built | RAM, Java (17, 21, 25), software (Paper, Purpur, Folia, Velocity, BungeeCord, Fabric, Forge, vanilla), Aikar's G1 or generational ZGC; `start.sh`, `start.bat`, Pterodactyl and Docker; warns about the Java version, memory and headroom |
| Log Analyzer   | Built | Paste `latest.log`, drop a `.log.gz` or a crash report, or give an mclo.gs link (fetched from the browser; mclo.gs allows it). 31 rules as data in `packages/analyzers`, matched in each software's own wording, each with a fix; errors grouped by plugin; a filtered log viewer for 50,000 lines. Parsed in the browser |
| Server Status  | Next  | Java and Bedrock, with the MOTD drawn by ServerList, version, players, icon, latency, SRV                                                                                                                          |
| Player Lookup  | Next  | Name to UUID and back, skin and cape viewer, head give command, offline-mode UUID                                                                                                                              |
| Server Icon    | Built | Crop and scale any image to 64×64 `server-icon.png` (pixel art or smooth), previewed in the server list. Never uploaded                                                                                       |

### After that

- **Text:** `/tellraw` and title builder, animated text frames (TAB, holograms), scoreboard and tab-list mockup, small caps.
- **Server:** config optimiser (`server.properties`, `bukkit.yml`, `spigot.yml`, Paper's world defaults, Purpur) with explained recommendations and a diff; spark profile reader; `server.properties` editor; pre-generation calculator.
- **Items:** give command generator with 1.20.5+ item components (and NBT for older), custom heads, banners.
- **World:** nether portal coordinates, circles and spheres, chunk and region from coordinates.
- **Resource packs:** SHA-1 and the `server.properties` lines for a pack zip, `pack.mcmeta` with the right `pack_format`.
- **Later:** a Discord bot that runs the log analyzer on a pasted log; optional preset sync.

## How it's built

- **Static first.** Every page is prerendered at build time and served as a static asset: free, and up even if the Worker isn't. Tools run in the browser.
- **The Worker only does what a browser can't:**

| Tool                    | Why it needs the Worker                                                                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server Status (Java)    | A TCP connection to the server (`connect()` in Workers)                                                                                                                                                                                                                                   |
| Server Status (Bedrock) | Bedrock answers over UDP, which Workers can't send. Uses the [mcstatus.io](https://mcstatus.io/docs) API (free, no key, 5 requests a second per IP), from the browser if it allows cross-origin calls, otherwise through the Worker with caching. Our own UDP pinger can replace it later |
| Player Lookup           | Mojang's API doesn't allow cross-origin calls, and answers should be cached                                                                                                                                                                                                               |
| spark reader            | Fetching profiles from spark's bytebin (no CORS)                                                                                                                                                                                                                                          |

- **Shared logic lives in packages** with tests: `mc-text`, `mc-flags` and `analyzers` (log rules; config rules to follow) now; `mc-protocol` (status ping) and `mc-data` (versions, `pack_format`s, items, generated from public data) as their tools arrive.
- **No Mojang assets.** No game textures, font or logos in the repo or on the site. Previews use Monocraft (OFL); item and block icons, when a tool needs them, will be drawn by us or loaded by the visitor's browser from a public source.

## Costs

Meant to cost nothing to run:

| What                  | How                                                                                     | Cost |
| --------------------- | --------------------------------------------------------------------------------------- | ---- |
| Pages, scripts, fonts | Workers static assets: free and unlimited                                               | $0   |
| Status, lookups       | Workers Free: 100,000 requests a day, 10 ms CPU each (pings mostly wait on the network) | $0   |
| Caching               | The Workers Cache API (not KV, whose free plan allows 1,000 writes a day)               | $0   |
| Bedrock status        | mcstatus.io                                                                             | $0   |
| Analytics             | Cloudflare Web Analytics                                                                | $0   |
| CI and deploys        | GitHub Actions (free for public repos)                                                  | $0   |

The rules: run in the browser whenever possible; cache every server answer at the edge (status about a minute, players an hour or more); debounce lookups. Only past 100,000 server calls a day would Workers Paid ($5 a month) be needed.
