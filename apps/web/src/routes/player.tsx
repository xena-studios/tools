import { createFileRoute } from "@tanstack/react-router";
import {
  dashUuid,
  isLookupName,
  isUuid,
  isValidUsername,
  offlineUuid,
  parseUuid,
} from "@xena-tools/mc-protocol";
import { useEffect, useId, useState } from "react";
import { CopyButton, Output } from "../components/Copy";
import { ResultState } from "../components/ResultState";
import { CapeView, SkinViews } from "../components/Skin";
import { ToolPage, toolHead } from "../components/ToolPage";
import type { Player, PlayerResult } from "../lib/api";
import { useUrlState } from "../lib/url-state";
import { toolBySlug } from "../tools";

export const Route = createFileRoute("/player")({
  head: () => toolHead("player"),
  component: PlayerTool,
});

const tool = toolBySlug("player");

interface State {
  query: string;
}

const DEFAULTS: State = { query: "" };

const codec = {
  decode: (p: URLSearchParams, d: State): State => ({
    query: (p.get("q") ?? d.query).slice(0, 40),
  }),
  encode: (v: State) => new URLSearchParams(v.query ? { q: v.query } : {}),
};

type Lookup =
  | { kind: "loading" }
  | { kind: "done"; result: PlayerResult }
  | { kind: "failed"; message: string };

async function lookup(query: string): Promise<Lookup> {
  try {
    const res = await fetch(`/api/player/${encodeURIComponent(query)}`);
    return { kind: "done", result: (await res.json()) as PlayerResult };
  } catch {
    return { kind: "failed", message: "Our lookup couldn't be reached. Check your connection." };
  }
}

function inputError(q: string): string | null {
  const s = q.trim();
  if (!s) return "Type a player's name or UUID.";
  if (isUuid(s) || isLookupName(s)) return null;
  if (s.length > 16 && /^[0-9a-f-]+$/i.test(s))
    return "That looks like a UUID, but it isn't one: a UUID is 32 hex digits, with or without dashes.";
  return "A name is up to 16 letters, digits and underscores. A UUID is 32 hex digits.";
}

function PlayerTool() {
  const { value: state, update } = useUrlState(DEFAULTS, codec);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Lookup | null>(null);
  const ids = useId();

  useEffect(() => setDraft(state.query), [state.query]);

  useEffect(() => {
    if (!state.query || inputError(state.query)) {
      setResult(null);
      return;
    }
    let live = true;
    setResult({ kind: "loading" });
    lookup(state.query).then((r) => live && setResult(r));
    return () => {
      live = false;
    };
  }, [state.query]);

  const submit = (q: string) => {
    const e = inputError(q);
    setError(e);
    if (!e) update({ query: q.trim() });
  };

  const found = result?.kind === "done" && result.result.ok ? result.result.player : null;
  // The offline calculator starts from the name looked up, or the name typed.
  const offlineName = found?.name ?? (state.query && !isUuid(state.query) ? state.query : "");

  return (
    <ToolPage tool={tool} guide={<Guide />}>
      <form
        className="panel flex flex-col gap-3 p-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1" htmlFor={`${ids}-q`}>
            <span className="label mb-2 block">Name or UUID</span>
            <input
              id={`${ids}-q`}
              className="field"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Notch or 069a79f4-44e9-4726-a5be-fca90e38aaf5"
              maxLength={40}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${ids}-error` : `${ids}-hint`}
            />
          </label>
          <button
            type="submit"
            className="button primary shrink-0"
            disabled={result?.kind === "loading"}
          >
            {result?.kind === "loading" ? "Looking up…" : "Look up"}
          </button>
        </div>
        {error ? (
          <p id={`${ids}-error`} role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : (
          <p id={`${ids}-hint`} className="text-xs text-muted">
            Java Edition accounts, from Mojang. Bedrock players (Xbox gamertags) aren't in Mojang's
            records.
          </p>
        )}
      </form>

      <div className="mt-8" aria-live="polite">
        {!state.query && <Empty onPick={submit} />}
        {result?.kind === "loading" && <Loading />}
        {result?.kind === "failed" && (
          <div className="flex flex-col gap-2">
            <ResultState kind="warn">Couldn't look up</ResultState>
            <p className="text-muted">{result.message}</p>
          </div>
        )}
        {result?.kind === "done" && !result.result.ok && (
          <div className="flex flex-col gap-2">
            <ResultState kind={result.result.error === "not_found" ? "bad" : "warn"}>
              {result.result.error === "not_found" ? "Not found" : "Couldn't look up"}
            </ResultState>
            <p className="max-w-[var(--measure)]">{result.result.message}</p>
            {result.result.error === "not_found" && (
              <p className="max-w-[var(--measure)] text-sm text-muted">
                Names are taken and freed all the time, so check the spelling. On an offline-mode
                server a player can use any name; their offline UUID is below.
              </p>
            )}
            {result.result.error !== "not_found" && (
              <button
                type="button"
                className="button compact self-start"
                onClick={() => lookup(state.query).then(setResult)}
              >
                Try again
              </button>
            )}
          </div>
        )}
        {found && <Found player={found} />}
      </div>

      <OfflineCalculator key={offlineName} initial={offlineName} />
    </ToolPage>
  );
}

function Empty({ onPick }: { onPick: (q: string) => void }) {
  return (
    <section aria-label="Examples" className="flex flex-col gap-3">
      <p className="max-w-[var(--measure)] text-muted">
        Find a player's UUID and skin from their name, or their name from a UUID, with a head give
        command for your version. Or try one:
      </p>
      <div className="flex flex-wrap gap-2">
        {["Notch", "jeb_", "069a79f4-44e9-4726-a5be-fca90e38aaf5"].map((q) => (
          <button key={q} type="button" className="button compact" onClick={() => onPick(q)}>
            {q}
          </button>
        ))}
      </div>
    </section>
  );
}

function Loading() {
  return (
    <div aria-busy="true" className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
      <p className="sr-only">Looking up…</p>
      <div className="flex gap-6" aria-hidden="true">
        <span className="skeleton h-64 w-32" />
        <span className="skeleton h-64 w-32" />
      </div>
      <div className="flex flex-col gap-3" aria-hidden="true">
        <span className="skeleton h-7 w-40" />
        <span className="skeleton h-4 w-3/4" />
        <span className="skeleton h-4 w-2/3" />
        <span className="skeleton mt-4 h-24 w-full" />
      </div>
    </div>
  );
}

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <span className="min-w-0">
          <code className="break-all">{value}</code>
          {hint && <span className="block text-sm text-muted">{hint}</span>}
        </span>
        <CopyButton value={value} quiet />
      </dd>
    </div>
  );
}

/** A quoted SNBT string: the name is letters, digits and _, so quotes are enough. */
const snbt = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function Found({ player }: { player: Player }) {
  const dashed = dashUuid(player.id);
  const modern = `/give @s minecraft:player_head[minecraft:profile={name:${snbt(player.name)}}]`;
  const legacy = `/give @s minecraft:player_head{SkullOwner:${snbt(player.name)}}`;
  return (
    <div className="grid gap-10 lg:grid-cols-[auto_minmax(0,1fr)]">
      <section aria-label="Skin" className="flex flex-col gap-4">
        {player.skin ? (
          <>
            <div className="flex flex-wrap gap-6">
              <SkinViews hash={player.skin.hash} model={player.skin.model} name={player.name} />
              {player.cape && <CapeView hash={player.cape.hash} name={player.name} />}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                className="button compact"
                href={`/api/skin/${player.skin.hash}`}
                download={`${player.name}.png`}
              >
                Download skin
              </a>
              <span className="text-xs text-muted">The PNG, exactly as the game uses it</span>
            </div>
          </>
        ) : (
          <p className="max-w-xs text-sm text-muted">
            No custom skin: the game gives this account one of its nine default skins, picked from
            the UUID.
          </p>
        )}
      </section>

      <section aria-label="Player" className="flex min-w-0 flex-col gap-6">
        <div>
          <ResultState kind="good">Found</ResultState>
          <h2 className="mt-2 text-[length:var(--t-h3)]">{player.name}</h2>
        </div>
        <dl className="facts">
          <CopyRow label="UUID" value={dashed} />
          <CopyRow
            label="Without dashes"
            value={player.id}
            hint="As Mojang's API and some configs write it"
          />
          <div>
            <dt>Model</dt>
            <dd>
              {player.skin
                ? player.skin.model === "slim"
                  ? "Slim (Alex): arms 3 pixels wide"
                  : "Classic (Steve): arms 4 pixels wide"
                : "Default skin"}
            </dd>
          </div>
          <div>
            <dt>Cape</dt>
            <dd>{player.cape ? "Yes" : "None"}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-4">
          <Output
            phoneBar={false}
            label="Head, 1.20.5 and later"
            hint="Java, in chat or a command block"
            value={modern}
          />
          <Output
            phoneBar={false}
            quiet
            label="Head, 1.13 to 1.20.4"
            hint="Older versions read NBT"
            value={legacy}
            warning="Before 1.13 the item was skull with data value 3: /give @s skull 1 3 {SkullOwner:...}"
          />
        </div>
      </section>
    </div>
  );
}

function OfflineCalculator({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  const id = useId();
  const n = name.trim();
  const uuid = n ? offlineUuid(n) : "";
  const odd = n && !isValidUsername(n);
  return (
    <section aria-labelledby={`${id}-h`} className="mt-12 border-t border-rule pt-8">
      <h2 id={`${id}-h`} className="text-[length:var(--t-h3)]">
        Offline-mode UUID
      </h2>
      <p className="mt-2 max-w-[var(--measure)] text-sm text-muted">
        The UUID a server with <code>online-mode=false</code> gives a name. It's worked out here in
        your browser, with no lookup, so it works for any name.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="block" htmlFor={`${id}-name`}>
          <span className="label mb-2 block">Name</span>
          <input
            id={`${id}-name`}
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Steve"
            maxLength={16}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
          />
          <span className="mt-2 block text-xs text-muted">
            {odd
              ? "Not a name an account could have, but offline servers may still accept it."
              : "Capitals matter: Steve and steve are different players offline."}
          </span>
        </label>
        <dl className="facts">
          {uuid ? (
            <>
              <CopyRow label="Offline UUID" value={uuid} />
              <CopyRow label="Without dashes" value={parseUuid(uuid) ?? ""} />
            </>
          ) : (
            <div>
              <dt>Offline UUID</dt>
              <dd className="text-muted">Type a name</dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  );
}

function Guide() {
  return (
    <>
      <h2>What it shows</h2>
      <ul>
        <li>
          <strong>UUID</strong>: the account's permanent id. It never changes, even when the player
          changes their name, so plugins, whitelists and bans should store it rather than the name.
        </li>
        <li>
          <strong>Skin</strong>: drawn flat from the skin file, front and back, with the outer layer
          (hat, jacket, sleeves) on top. Slim skins have 3-pixel arms.
        </li>
        <li>
          <strong>Name history</strong> is gone: Mojang removed it from their API in September 2022,
          so no site can show past names any more. A name from a UUID is the current one.
        </li>
        <li>
          Lookups go through our server to Mojang, which doesn't allow browsers to ask directly.
          Found players are kept for an hour and names nobody has for five minutes, so a skin
          changed in the last hour may show the old one.
        </li>
      </ul>
      <h2>Player heads</h2>
      <ul>
        <li>
          From 1.20.5 heads use the <code>profile</code> component, so the command is{" "}
          <code>
            /give @s minecraft:player_head[minecraft:profile={"{"}name:"Notch"{"}"}]
          </code>
          . Before that, back to 1.13, it's NBT:{" "}
          <code>
            {"{"}SkullOwner:"Notch"{"}"}
          </code>
          .
        </li>
        <li>
          A head by name fetches the skin when it's placed, and updates when the player changes
          their skin. If they change their name, it shows whoever has the name next.
        </li>
        <li>
          Change <code>@s</code> to a player's name to give it to someone else. You need operator
          permission (or cheats on in single player).
        </li>
      </ul>
      <h2>Offline mode</h2>
      <ul>
        <li>
          A server with <code>online-mode=false</code> doesn't ask Mojang who players are, so it
          makes each one a UUID from their name: <code>OfflinePlayer:</code> plus the name, hashed
          (Java's <code>UUID.nameUUIDFromBytes</code>, version 3).
        </li>
        <li>
          Moving a server between online and offline mode changes every player's UUID, so their
          inventories, ranks and claims seem to vanish. Behind a Velocity or BungeeCord proxy in
          online mode, the backend servers get the real UUIDs from the proxy.
        </li>
      </ul>
    </>
  );
}
