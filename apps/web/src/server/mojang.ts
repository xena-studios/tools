// Player lookups against Mojang's public API, and the skin proxy.
//
//   name -> UUID: api.mojang.com/users/profiles/minecraft/<name> (404 if none),
//     with api.minecraftservices.com's lookup as the fallback when the first
//     answers 403 or 5xx, which it sometimes does by mistake.
//   UUID -> profile: sessionserver.mojang.com/session/minecraft/profile/<uuid>
//     (204 if none), whose base64 "textures" property holds the skin and cape.
//
// Mojang's API often refuses Cloudflare Workers outright (it answers our
// requests with errors while answering everyone else), so when it fails the
// lookup falls back to playerdb.co, a public cache of the same Mojang data that
// returns the same base64 "textures" property. A miss is only trusted from
// Mojang: playerdb can't tell "no such player" from "Mojang didn't answer".
//
// Mojang allows about 200 requests per 2 minutes per IP on the name lookup,
// and Workers share IPs, so found players are cached for an hour and misses
// for five minutes. A name nobody has is a 200 with ok: false (it's an answer,
// not a failure, and the browser logs every 4xx as an error).

import { isLookupName, parseUuid } from "@xena-tools/mc-protocol";
import { type Player, type PlayerResult, TEXTURE_HASH } from "../lib/api";
import { type Answer, json } from "./http";

export const FOUND_TTL = 3600;
export const MISSING_TTL = 300;
const TROUBLE_TTL = 30;
const SKIN_TTL = 86400;
const MAX_SKIN_BYTES = 128 * 1024;

class Upstream extends Error {
  constructor(readonly code: "rate_limited" | "upstream_error") {
    super(code);
  }
}

const get = (url: string) =>
  fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (text.length > 64 * 1024) throw new Upstream("upstream_error");
  return JSON.parse(text) as T;
}

/** A name's UUID, or null if no account has it. */
async function uuidForName(name: string): Promise<string | null> {
  const urls = [
    `https://api.mojang.com/users/profiles/minecraft/${name}`,
    `https://api.minecraftservices.com/minecraft/profile/lookup/name/${name}`,
  ];
  let last: Upstream = new Upstream("upstream_error");
  for (const url of urls) {
    let res: Response;
    try {
      res = await get(url);
    } catch {
      last = new Upstream("upstream_error");
      continue;
    }
    if (res.status === 204 || res.status === 404) return null;
    if (res.ok) {
      const body = await readJson<{ id?: string }>(res);
      return body.id ? parseUuid(body.id) : null;
    }
    console.warn(`name lookup answered ${res.status} from ${new URL(url).host}`);
    last = new Upstream(res.status === 429 ? "rate_limited" : "upstream_error");
    // 429 is per IP; the other host shares the limit, so don't spend it.
    if (res.status === 429) break;
  }
  throw last;
}

interface Textures {
  textures?: {
    SKIN?: { url?: string; metadata?: { model?: string } };
    CAPE?: { url?: string };
  };
}

function textureHash(url: string | undefined): string | null {
  const m = /^https?:\/\/textures\.minecraft\.net\/texture\/([0-9a-f]+)$/.exec(url ?? "");
  return m?.[1] && TEXTURE_HASH.test(m[1]) ? m[1] : null;
}

interface ProfileBody {
  id?: string;
  name?: string;
  properties?: { name?: string; value?: string }[];
}

/** The profile with its skin and cape, or null if the UUID has no account. */
async function profile(uuid: string): Promise<Player | null> {
  let res: Response;
  try {
    res = await get(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
  } catch {
    throw new Upstream("upstream_error");
  }
  if (res.status === 204 || res.status === 404 || res.status === 400) return null;
  if (res.status === 429) throw new Upstream("rate_limited");
  if (!res.ok) {
    console.warn(`sessionserver answered ${res.status}`);
    throw new Upstream("upstream_error");
  }
  return fromProfile(await readJson<ProfileBody>(res));
}

/** A player from a sessionserver-shaped profile (Mojang's, or playerdb's copy of it). */
function fromProfile(body: ProfileBody): Player | null {
  const id = parseUuid(body.id ?? "");
  if (!id || typeof body.name !== "string") return null;

  let textures: Textures = {};
  const prop = body.properties?.find((p) => p.name === "textures");
  if (prop?.value) {
    try {
      textures = JSON.parse(atob(prop.value)) as Textures;
    } catch {
      textures = {};
    }
  }
  const skinHash = textureHash(textures.textures?.SKIN?.url);
  const capeHash = textureHash(textures.textures?.CAPE?.url);
  return {
    id,
    name: body.name,
    skin: skinHash
      ? {
          hash: skinHash,
          model: textures.textures?.SKIN?.metadata?.model === "slim" ? "slim" : "classic",
        }
      : null,
    cape: capeHash ? { hash: capeHash } : null,
  };
}

/** The fallback: playerdb.co, by name or UUID. Null when it has no answer either. */
async function fromPlayerDb(input: string): Promise<Player | null> {
  let res: Response;
  try {
    res = await get(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(input)}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  try {
    const body = await readJson<{
      success?: boolean;
      data?: {
        player?: { raw_id?: string; username?: string; properties?: ProfileBody["properties"] };
      };
    }>(res);
    const p = body.success ? body.data?.player : undefined;
    if (!p) return null;
    return fromProfile({ id: p.raw_id, name: p.username, properties: p.properties });
  } catch {
    return null;
  }
}

const MESSAGES = {
  bad_request: "That isn't a Minecraft username or a UUID.",
  not_found: "No Minecraft account has that name or UUID.",
  rate_limited: "Mojang is limiting lookups right now. Try again in a minute.",
  upstream_error: "Mojang's API didn't answer. Try again in a minute.",
} as const;

const result = (r: PlayerResult, status: number, ttl: number): Answer => json(r, status, ttl);

/** The cache key for a lookup, or null if it's neither a name nor a UUID. */
export function playerKey(input: string): string | null {
  const uuid = parseUuid(input);
  if (uuid) return `player/uuid/${uuid}`;
  return isLookupName(input) ? `player/name/${input.toLowerCase()}` : null;
}

export async function lookupPlayer(input: string): Promise<Answer> {
  const checkedAt = Date.now();
  try {
    const uuid = parseUuid(input) ?? (isLookupName(input) ? await uuidForName(input) : undefined);
    if (uuid === undefined)
      return result(
        { ok: false, checkedAt, error: "bad_request", message: MESSAGES.bad_request },
        400,
        0,
      );
    const player = uuid ? await profile(uuid) : null;
    if (!player)
      return result(
        { ok: false, checkedAt, error: "not_found", message: MESSAGES.not_found },
        200,
        MISSING_TTL,
      );
    return result({ ok: true, checkedAt, player }, 200, FOUND_TTL);
  } catch (e) {
    const code = e instanceof Upstream ? e.code : "upstream_error";
    const fallback = await fromPlayerDb(input);
    if (fallback) return result({ ok: true, checkedAt, player: fallback }, 200, FOUND_TTL);
    return result(
      { ok: false, checkedAt, error: code, message: MESSAGES[code] },
      code === "rate_limited" ? 429 : 502,
      TROUBLE_TTL,
    );
  }
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * A skin or cape PNG from textures.minecraft.net, by its hash. Only that host,
 * only a hash: the URL is built here, so this can't fetch anything else.
 */
export async function fetchTexture(hash: string): Promise<Answer> {
  const notFound = (status: number): Answer => ({
    status,
    body: "Not found",
    contentType: "text/plain; charset=utf-8",
    ttl: status === 404 ? MISSING_TTL : 0,
  });
  if (!TEXTURE_HASH.test(hash)) return notFound(400);
  let res: Response;
  try {
    res = await fetch(`https://textures.minecraft.net/texture/${hash}`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return notFound(502);
  }
  if (res.status === 404) return notFound(404);
  if (!res.ok) return notFound(502);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_SKIN_BYTES || !PNG.every((b, i) => bytes[i] === b)) return notFound(502);
  // The hash is the texture's content, so the browser can keep it for good.
  return { status: 200, body: bytes, contentType: "image/png", ttl: SKIN_TTL, immutable: true };
}
