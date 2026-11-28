// UUIDs and usernames as Minecraft uses them.

import { md5, toHex } from "./md5.ts";

const UNDASHED = /^[0-9a-f]{32}$/i;
const DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A UUID with or without dashes, as 32 lower-case hex digits; null if it isn't one. */
export function parseUuid(input: string): string | null {
  const s = input.trim();
  if (UNDASHED.test(s)) return s.toLowerCase();
  if (DASHED.test(s)) return s.replace(/-/g, "").toLowerCase();
  return null;
}

export const isUuid = (input: string): boolean => parseUuid(input) !== null;

/** 8-4-4-4-12, lower case. Throws if it isn't a UUID. */
export function dashUuid(input: string): string {
  const u = parseUuid(input);
  if (!u) throw new TypeError(`"${input}" isn't a UUID`);
  return `${u.slice(0, 8)}-${u.slice(8, 12)}-${u.slice(12, 16)}-${u.slice(16, 20)}-${u.slice(20)}`;
}

export function undashUuid(input: string): string {
  const u = parseUuid(input);
  if (!u) throw new TypeError(`"${input}" isn't a UUID`);
  return u;
}

/** The UUID's version digit (4 for a Mojang account, 3 for offline mode). */
export function uuidVersion(input: string): number | null {
  const u = parseUuid(input);
  return u ? Number.parseInt(u[12] as string, 16) : null;
}

/**
 * A name Mojang accounts can have: 3 to 16 letters, digits and underscores.
 * A few very old accounts have shorter names, so lookups accept 1 to 16.
 */
export const USERNAME = /^[A-Za-z0-9_]{3,16}$/;
const LOOKUP_NAME = /^[A-Za-z0-9_]{1,16}$/;

export const isValidUsername = (name: string): boolean => USERNAME.test(name);
export const isLookupName = (name: string): boolean => LOOKUP_NAME.test(name);

/**
 * The UUID an offline-mode server gives a player: Java's
 * UUID.nameUUIDFromBytes("OfflinePlayer:" + name), an MD5 v3 UUID. It's case
 * sensitive: "Notch" and "notch" are different players offline.
 */
export function offlineUuid(name: string): string {
  const hash = md5(new TextEncoder().encode(`OfflinePlayer:${name}`));
  hash[6] = ((hash[6] as number) & 0x0f) | 0x30; // version 3
  hash[8] = ((hash[8] as number) & 0x3f) | 0x80; // IETF variant
  return dashUuid(toHex(hash));
}

/**
 * The UUID as four signed 32-bit integers, most significant first: how NBT
 * and data components store a UUID (the int-array form).
 */
export function uuidIntArray(input: string): [number, number, number, number] {
  const u = undashUuid(input);
  const part = (i: number) => Number.parseInt(u.slice(i * 8, i * 8 + 8), 16) | 0;
  return [part(0), part(1), part(2), part(3)];
}
