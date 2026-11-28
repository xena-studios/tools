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
| Server Status  | Built | Java (our own ping from the Worker), Bedrock (mcstatus.io, from the browser) or both for Geyser. The server-list entry with the real icon and MOTD, version and protocol, players and the sample, latency, the SRV record and IP, secure chat, Forge mods, and how old the answer is. The address is in the link |
| Player Lookup  | Built | Name to UUID and back (dashed and undashed), the skin drawn flat front and back on a canvas, model and cape, the skin PNG, head give commands for 1.20.5+ and 1.13 to 1.20.4, and an offline-mode UUID calculator that runs in the browser |
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
| Server Status (Bedrock) | Bedrock answers over UDP, which Workers can't send. Uses the [mcstatus.io](https://mcstatus.io/docs) API (free, no key, 5 requests a second per IP) from the browser: it sends `Access-Control-Allow-Origin: *`, so the Worker isn't involved and only `/status`'s CSP allows `https://api.mcstatus.io`. Our own UDP pinger can replace it later |
| Player Lookup           | Mojang's API doesn't allow cross-origin calls, and answers should be cached                                                                                                                                                                                                               |
| spark reader            | Fetching profiles from spark's bytebin (no CORS)                                                                                                                                                                                                                                          |

- **Shared logic lives in packages** with tests: `mc-text`, `mc-flags`, `analyzers` (log rules; config rules to follow) and `mc-protocol` (the status ping, UUIDs and address checks) now; `mc-data` (versions, `pack_format`s, items, generated from public data) as their tools arrive.
- **No Mojang assets.** No game textures, font or logos in the repo or on the site. Previews use Monocraft (OFL); item and block icons, when a tool needs them, will be drawn by us or loaded by the visitor's browser from a public source.

## How the API works

The Worker serves three GET endpoints, as TanStack Start server routes (`apps/web/src/routes/api/`), with the work in `apps/web/src/server/`. The pages stay prerendered static assets; the routes aren't linked, so the prerenderer never crawls them, and their code is stripped from the browser bundle.

| Route | What it does | Cached |
| --- | --- | --- |
| `GET /api/status/java?host=<host[:port]>[&port=<port>]` | Validates the address, follows `_minecraft._tcp` SRV when no port is given (DNS over HTTPS to `cloudflare-dns.com`), resolves A then AAAA records, refuses if any is non-public, then `connect()`s to that IP and runs the handshake, status request and ping, with a 5 second limit and a 256KB cap. Always answers JSON: `online: true` with `status`, `target` (SRV, host, IP, port), `latency` and `from` (the data centre), or `online: false` with `error` and `message` | 60 s per host and port, online or not. Bad input isn't cached at the edge |
| `GET /api/player/<name or UUID>` | A name goes to `api.mojang.com/users/profiles/minecraft/<name>` (falling back to `api.minecraftservices.com/minecraft/profile/lookup/name/<name>` on a 403 or 5xx), then `sessionserver.mojang.com/session/minecraft/profile/<uuid>`, whose base64 `textures` property gives the skin, its model and the cape. Answers `ok: true` with `player`, or `ok: false` with `error` | Found: an hour. Not found: 5 minutes (a 200 with `ok: false`). Rate limited or Mojang down: 30 s |
| `GET /api/skin/<texture hash>` | The PNG from `textures.minecraft.net/texture/<hash>`, so the page draws it on a canvas under `img-src 'self'`. Only that host and only a hex hash: the URL is built by the Worker, so it isn't an open proxy. Checked to be a PNG under 128KB | A day, and `immutable` in the browser: the hash is the file's content |

**Error codes.** Java status: `bad_request` (not an address, or a port outside 1 to 65535), `blocked_address` (private, loopback, link-local, CGNAT, multicast, documentation or other reserved IPv4 and IPv6 ranges, `localhost`, `.local` and similar names, as typed or after DNS, SRV targets included), `dns_failed`, `timeout`, `refused`, `bad_response` (something answered but not with a status), and `cloudflare_ip`. Player: `bad_request`, `not_found`, `rate_limited`, `upstream_error`.

**Servers on Cloudflare's network.** Workers can't open sockets to Cloudflare's own IP ranges, and some big networks (Hypixel among them) use Cloudflare Spectrum. The Worker answers `cloudflare_ip` for those without connecting, and the page asks mcstatus.io's Java endpoint from the browser instead, and says so.

**Caching.** Every answer goes through the Workers Cache API (`caches.default`), keyed by the normalised host and port, the lower-cased name or the UUID, or the texture hash. A cached answer tells the browser only the time it has left (`max-age` minus its age), so nothing is held longer than its TTL in all. The cache is per data centre, so the first visitor in each one pays for a fresh check. Every answer carries `checkedAt`, which the page shows as "checked 20 s ago".

**Limits.** Each check is a few small fetches and one socket, mostly waiting on the network, so it stays well inside Workers Free's 10 ms of CPU. Mojang allows about 200 name lookups per 2 minutes per IP, and Workers share outgoing IPs, hence the long cache; a 429 shows as "Mojang is limiting lookups right now". mcstatus.io allows 5 requests a second per visitor's IP.

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
