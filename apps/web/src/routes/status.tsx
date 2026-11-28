import { createFileRoute, Link } from "@tanstack/react-router";
import {
  type AddressError,
  BEDROCK_PORT,
  formatAddress,
  type JavaStatus,
  parseAddress,
} from "@xena-tools/mc-protocol";
import type { Span } from "@xena-tools/mc-text";
import { useCallback, useEffect, useId, useState } from "react";
import { External } from "../components/Brand";
import { type FormatOption, FormatPicker } from "../components/FormatPicker";
import { McLine } from "../components/McText";
import { ago, ResultState, useNow } from "../components/ResultState";
import { ServerList } from "../components/ServerList";
import { ToolPage, toolHead } from "../components/ToolPage";
import type { JavaResult, JavaTarget } from "../lib/api";
import { descriptionSpans, legacySpans, plain } from "../lib/status-text";
import { useUrlState } from "../lib/url-state";
import { toolBySlug } from "../tools";

export const Route = createFileRoute("/status")({
  head: () => toolHead("status"),
  component: StatusTool,
});

const tool = toolBySlug("status");

type Edition = "java" | "bedrock" | "both";

const EDITIONS: FormatOption<Edition>[] = [
  { id: "java", label: "Java", usedBy: "Java Edition: PC, Mac and Linux" },
  { id: "bedrock", label: "Bedrock", usedBy: "Bedrock Edition: consoles, phones and Windows" },
  {
    id: "both",
    label: "Both",
    usedBy: "A Java server with Geyser, which lets Bedrock players join",
  },
];

const isEdition = (v: string | null): v is Edition => EDITIONS.some((e) => e.id === v);

interface State {
  address: string;
  edition: Edition;
}

const DEFAULTS: State = { address: "", edition: "java" };

const codec = {
  decode(p: URLSearchParams, d: State): State {
    const e = p.get("e");
    return {
      address: (p.get("a") ?? d.address).slice(0, 270),
      edition: isEdition(e) ? e : d.edition,
    };
  },
  encode(v: State): URLSearchParams {
    const p = new URLSearchParams();
    if (v.address) p.set("a", v.address);
    if (v.edition !== "java") p.set("e", v.edition);
    return p;
  },
};

const MCSTATUS = "https://api.mcstatus.io/v2/status";

const INPUT_ERRORS: Record<AddressError, string> = {
  empty: "Type a server address, like play.example.com.",
  bad_port: "The port is a number from 1 to 65535, after a colon: play.example.com:25566.",
  bad_host: "That isn't a server address. Type a name like play.example.com, or an IP.",
  private_name:
    "That name only works on your own network, so it can't be checked from the internet.",
  private_ip:
    "That's a private or local IP (like 192.168.x.x or 127.0.0.1), so it can't be checked from the internet. Check it from the same network in the game instead.",
};

// mcstatus.io's answers, as far as this page reads them.
interface McStatusJava {
  online: boolean;
  host: string;
  port: number;
  ip_address: string | null;
  retrieved_at: number;
  srv_record?: { host: string; port: number } | null;
  version?: { name_raw?: string; protocol?: number } | null;
  players?: { online?: number; max?: number; list?: { uuid?: string; name_raw?: string }[] } | null;
  motd?: { raw?: string } | null;
  icon?: string | null;
  mods?: { name?: string; version?: string }[];
}

interface McStatusBedrock {
  online: boolean;
  host: string;
  port: number;
  ip_address: string | null;
  retrieved_at: number;
  version?: { name?: string; protocol?: number } | null;
  players?: { online?: number; max?: number; list?: { name_raw?: string }[] } | null;
  motd?: { raw?: string } | null;
  gamemode?: string | null;
  edition?: string | null;
  software?: string | null;
}

type Java =
  | { kind: "loading" }
  | { kind: "done"; result: JavaResult; via: "worker" | "mcstatus" }
  | { kind: "failed"; message: string };

type Bedrock =
  | { kind: "loading" }
  | { kind: "done"; result: McStatusBedrock }
  | { kind: "failed"; message: string };

/** mcstatus.io's Java answer in our own shape, for a server our checker can't reach. */
function fromMcStatus(query: string, m: McStatusJava): JavaResult {
  const checkedAt = m.retrieved_at || Date.now();
  if (!m.online)
    return {
      online: false,
      query,
      checkedAt,
      error: "timeout",
      message: "mcstatus.io couldn't get a status from it either.",
    };
  const mods = m.mods ?? [];
  const status: JavaStatus = {
    version: { name: m.version?.name_raw ?? "", protocol: m.version?.protocol ?? null },
    players: {
      online: m.players?.online ?? null,
      max: m.players?.max ?? null,
      sample: (m.players?.list ?? []).map((p) => ({ name: p.name_raw ?? "", id: p.uuid ?? "" })),
    },
    description: m.motd?.raw ?? "",
    favicon: m.icon?.startsWith("data:image/png;base64,") ? m.icon : null,
    enforcesSecureChat: null,
    previewsChat: null,
    mods:
      mods.length > 0
        ? {
            loader: "other",
            mods: mods.map((x) => ({ id: x.name ?? "", version: x.version })),
            truncated: false,
          }
        : null,
    modded: null,
  };
  return {
    online: true,
    query,
    checkedAt,
    target: {
      srv: m.srv_record ? { target: m.srv_record.host, port: m.srv_record.port } : null,
      host: m.host,
      ip: m.ip_address ?? "",
      port: m.port,
    },
    latency: null,
    from: null,
    status,
  };
}

async function checkJava(address: string): Promise<Java> {
  let result: JavaResult;
  try {
    const res = await fetch(`/api/status/java?host=${encodeURIComponent(address)}`);
    result = (await res.json()) as JavaResult;
  } catch {
    return { kind: "failed", message: "Our checker couldn't be reached. Check your connection." };
  }
  if (result.online || result.error !== "cloudflare_ip")
    return { kind: "done", result, via: "worker" };
  // Workers can't open sockets to Cloudflare's own network, so ask mcstatus.io.
  try {
    const res = await fetch(`${MCSTATUS}/java/${encodeURIComponent(address)}`);
    if (!res.ok) throw new Error(String(res.status));
    return {
      kind: "done",
      result: fromMcStatus(address, (await res.json()) as McStatusJava),
      via: "mcstatus",
    };
  } catch {
    return { kind: "done", result, via: "worker" };
  }
}

async function checkBedrock(address: string): Promise<Bedrock> {
  try {
    const res = await fetch(`${MCSTATUS}/bedrock/${encodeURIComponent(address)}`);
    if (res.status === 429)
      return {
        kind: "failed",
        message: "mcstatus.io is limiting checks right now. Try again in a few seconds.",
      };
    if (!res.ok)
      return {
        kind: "failed",
        message: `mcstatus.io answered ${res.status}. Try again in a minute.`,
      };
    return { kind: "done", result: (await res.json()) as McStatusBedrock };
  } catch {
    return { kind: "failed", message: "mcstatus.io couldn't be reached. Check your connection." };
  }
}

/** The address each edition is checked at: Bedrock uses 19132 unless it's checked alone with a port. */
function targets(address: string, edition: Edition) {
  const parsed = parseAddress(address);
  if (!parsed.ok) return null;
  const { host, port } = parsed.address;
  return {
    java: edition === "bedrock" ? null : formatAddress(host, port),
    bedrock:
      edition === "java"
        ? null
        : formatAddress(host, edition === "bedrock" ? (port ?? BEDROCK_PORT) : BEDROCK_PORT),
  };
}

const EXAMPLES: { address: string; edition: Edition }[] = [
  { address: "mc.hypixel.net", edition: "java" },
  { address: "play.cubecraft.net", edition: "both" },
  { address: "geo.hivebedrock.network", edition: "bedrock" },
];

function StatusTool() {
  const { value: state, update } = useUrlState(DEFAULTS, codec);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [java, setJava] = useState<Java | null>(null);
  const [bedrock, setBedrock] = useState<Bedrock | null>(null);
  const [run, setRun] = useState(0);
  const ids = useId();

  // The address from a shared link fills the field.
  useEffect(() => setDraft(state.address), [state.address]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: run is the "check again" counter
  useEffect(() => {
    if (!state.address) {
      setJava(null);
      setBedrock(null);
      return;
    }
    const t = targets(state.address, state.edition);
    if (!t) return;
    let live = true;
    setJava(t.java ? { kind: "loading" } : null);
    setBedrock(t.bedrock ? { kind: "loading" } : null);
    if (t.java) checkJava(t.java).then((r) => live && setJava(r));
    if (t.bedrock) checkBedrock(t.bedrock).then((r) => live && setBedrock(r));
    return () => {
      live = false;
    };
  }, [state.address, state.edition, run]);

  const submit = useCallback(
    (address: string, edition = state.edition) => {
      const parsed = parseAddress(address);
      if (!parsed.ok) {
        setInputError(INPUT_ERRORS[parsed.error]);
        return;
      }
      setInputError(null);
      const a = address.trim();
      if (a === state.address && edition === state.edition) setRun((n) => n + 1);
      else update({ address: a, edition });
    },
    [state.address, state.edition, update],
  );

  const busy = java?.kind === "loading" || bedrock?.kind === "loading";
  const t = state.address ? targets(state.address, state.edition) : null;

  return (
    <ToolPage tool={tool} guide={<Guide />}>
      <form
        className="panel flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        noValidate
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1" htmlFor={`${ids}-address`}>
            <span className="label mb-2 block">Server address</span>
            <input
              id={`${ids}-address`}
              className="field"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="play.example.com or play.example.com:25566"
              maxLength={270}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              inputMode="url"
              aria-invalid={inputError ? true : undefined}
              aria-describedby={inputError ? `${ids}-error` : `${ids}-hint`}
            />
          </label>
          <button type="submit" className="button primary shrink-0" disabled={busy}>
            {busy ? "Checking…" : "Check"}
          </button>
        </div>
        {inputError ? (
          <p id={`${ids}-error`} role="alert" className="-mt-1 text-sm text-[var(--danger)]">
            {inputError}
          </p>
        ) : (
          <p id={`${ids}-hint`} className="-mt-1 text-xs text-muted">
            A name or IP, with :port if it isn't the default (25565 for Java, 19132 for Bedrock).
          </p>
        )}
        <FormatPicker
          label="Edition"
          options={EDITIONS}
          value={state.edition}
          onChange={(edition) => {
            if (state.address) submit(draft || state.address, edition);
            else update({ edition });
          }}
        />
      </form>

      <div className="mt-8 flex flex-col gap-10" aria-live="polite">
        {!state.address && <Empty onPick={(a, e) => submit(a, e)} />}
        {java && t?.java && (
          <JavaSection
            state={java}
            address={t.java}
            both={state.edition === "both"}
            onAgain={() => setRun((n) => n + 1)}
          />
        )}
        {bedrock && t?.bedrock && (
          <BedrockSection
            state={bedrock}
            address={t.bedrock}
            both={state.edition === "both"}
            onAgain={() => setRun((n) => n + 1)}
          />
        )}
      </div>
    </ToolPage>
  );
}

function Empty({ onPick }: { onPick: (address: string, edition: Edition) => void }) {
  return (
    <section aria-label="Examples" className="flex flex-col gap-3">
      <p className="max-w-[var(--measure)] text-muted">
        Type your server's address to see what players see in their server list: whether it's up,
        its MOTD and icon, the version it asks for, who's online and how fast it answers. Or try one
        of these:
      </p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex.address}
            type="button"
            className="button compact"
            onClick={() => onPick(ex.address, ex.edition)}
          >
            {ex.address}
            <span className="text-muted">
              {ex.edition === "both" ? "Both" : ex.edition === "java" ? "Java" : "Bedrock"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SectionHead({
  title,
  address,
  children,
}: {
  title: string;
  address: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[length:var(--t-h3)]">
        {title}
        <span className="ml-3 align-middle text-sm font-normal tracking-normal text-muted">
          {address}
        </span>
      </h2>
      {children}
    </div>
  );
}

function Again({ checkedAt, onAgain }: { checkedAt: number; onAgain: () => void }) {
  const now = useNow();
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted">Checked {ago(checkedAt, now)}</span>
      <button type="button" className="button compact" onClick={onAgain}>
        Check again
      </button>
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true">
      <p className="sr-only">{label}</p>
      <div className="server-list" aria-hidden="true">
        <div className="server-entry">
          <span className="skeleton aspect-square w-[calc(var(--gp)*32)] shrink-0" />
          <div className="flex flex-1 flex-col gap-[calc(var(--gp)*3)] pt-[var(--gp)]">
            <span className="skeleton h-[calc(var(--gp)*7)] w-1/2" />
            <span className="skeleton h-[calc(var(--gp)*7)] w-11/12" />
            <span className="skeleton h-[calc(var(--gp)*7)] w-3/4" />
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:max-w-md" aria-hidden="true">
        <span className="skeleton h-4 w-2/3" />
        <span className="skeleton h-4 w-1/2" />
        <span className="skeleton h-4 w-3/5" />
      </div>
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-GB");

function JavaSection({
  state,
  address,
  both,
  onAgain,
}: {
  state: Java;
  address: string;
  both: boolean;
  onAgain: () => void;
}) {
  const title = both ? "Java Edition" : "Status";
  if (state.kind === "loading")
    return (
      <section aria-label="Java Edition">
        <SectionHead title={title} address={address} />
        <Skeleton label={`Checking ${address}…`} />
      </section>
    );
  if (state.kind === "failed")
    return (
      <section aria-label="Java Edition">
        <SectionHead title={title} address={address} />
        <ResultState kind="warn">Couldn't check</ResultState>
        <p className="mt-2 text-muted">{state.message}</p>
      </section>
    );

  const r = state.result;
  if (!r.online) {
    const blocked = r.error === "blocked_address" || r.error === "bad_request";
    return (
      <section aria-label="Java Edition">
        <SectionHead title={title} address={address}>
          <Again checkedAt={r.checkedAt} onAgain={onAgain} />
        </SectionHead>
        {!blocked && (
          <ServerList
            name={address}
            motd={[{ text: "Can't connect to server", style: { color: "#AA0000" } }]}
            offline
          />
        )}
        <div className="mt-5 flex flex-col gap-2">
          <ResultState kind={blocked ? "warn" : "bad"}>
            {blocked ? "Can't check this address" : "Offline"}
          </ResultState>
          <p className="max-w-[var(--measure)]">{r.message}</p>
          <p className="max-w-[var(--measure)] text-sm text-muted">{OFFLINE_HELP[r.error]}</p>
          {r.target && (r.target.ip || r.target.srv) && (
            <dl className="facts mt-3 max-w-xl">
              <Hops target={r.target} />
            </dl>
          )}
        </div>
      </section>
    );
  }

  const s = r.status;
  const motd = descriptionSpans(s.description);
  return (
    <section aria-label="Java Edition">
      <SectionHead title={title} address={address}>
        <Again checkedAt={r.checkedAt} onAgain={onAgain} />
      </SectionHead>
      <ServerList
        name={address}
        motd={motd}
        online={s.players.online ?? undefined}
        max={s.players.max ?? undefined}
        icon={s.favicon ?? undefined}
        ping={r.latency}
      />
      <p className="sr-only">MOTD: {plain(motd)}</p>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <ResultState kind="good">Online</ResultState>
          <dl className="facts mt-4">
            <div>
              <dt>Version</dt>
              <dd>
                {plain(legacySpans(s.version.name)) || "Not given"}
                {s.version.protocol !== null && (
                  <span className="block text-sm text-muted">Protocol {s.version.protocol}</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Players</dt>
              <dd>
                {s.players.online !== null && s.players.max !== null
                  ? `${fmt(s.players.online)} of ${fmt(s.players.max)}`
                  : "Hidden"}
              </dd>
            </div>
            <div>
              <dt>Latency</dt>
              <dd>
                {r.latency !== null ? (
                  <>
                    {r.latency} ms
                    <span className="block text-sm text-muted">
                      From Cloudflare{r.from ? `'s ${r.from} data centre` : ""} to the server, not
                      from you
                    </span>
                  </>
                ) : (
                  <span className="text-muted">Not measured</span>
                )}
              </dd>
            </div>
            <Hops target={r.target} />
            <div>
              <dt>Secure chat</dt>
              <dd>
                {s.enforcesSecureChat === true
                  ? "Enforced: players need signed chat"
                  : s.enforcesSecureChat === false
                    ? "Not enforced"
                    : "Not stated"}
              </dd>
            </div>
          </dl>
          {state.via === "mcstatus" && (
            <p className="mt-4 text-xs text-muted">
              This server is on Cloudflare's network, which our checker can't open connections to,
              so this status is from{" "}
              <a href="https://mcstatus.io" target="_blank" rel="noreferrer">
                <External>mcstatus.io</External>
              </a>
              .
            </p>
          )}
        </div>
        <div className="flex flex-col gap-8">
          <Sample players={s.players.sample} />
          {s.mods && s.mods.mods.length > 0 && <Mods mods={s.mods} />}
        </div>
      </div>
    </section>
  );
}

const OFFLINE_HELP: Record<string, string> = {
  dns_failed:
    "Check the spelling. If it's a new domain, its DNS record can take a while to appear; if you use an SRV record, check it points to a name with an A record.",
  timeout:
    "The server may be starting, overloaded or down, or a firewall is dropping connections to its port. If it's yours, check the port is open to the internet, not only on your network.",
  refused:
    "The machine is up but nothing is listening on that port. Check the server is running, and the port in server.properties (server-port) matches.",
  bad_response:
    "That port may be for something else (a website, SSH, a Bedrock-only server), or the server is very old (before 1.7), which uses a different ping.",
  blocked_address: "Only servers on the public internet can be checked here.",
  bad_request: "Type a name like play.example.com, an IP, and :port if it isn't 25565.",
  cloudflare_ip: "mcstatus.io couldn't be reached to check it instead. Try again in a minute.",
};

/** The SRV record followed, and the IP and port connected to. */
function Hops({ target }: { target: Partial<JavaTarget> }) {
  return (
    <>
      {target.srv && (
        <div>
          <dt>SRV record</dt>
          <dd>
            {target.srv.target}:{target.srv.port}
            <span className="block text-sm text-muted">
              From _minecraft._tcp, as the game follows it
            </span>
          </dd>
        </div>
      )}
      {target.ip && (
        <div>
          <dt>Connected to</dt>
          <dd>{formatAddress(target.ip, target.port ?? null)}</dd>
        </div>
      )}
    </>
  );
}

function Sample({ players }: { players: JavaStatus["players"]["sample"] }) {
  return (
    <div>
      <h3 className="label mb-3">Player sample</h3>
      {players.length === 0 ? (
        <p className="text-sm text-muted">
          The server didn't send one. Servers can hide it, and many big networks do.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-1 rounded-[var(--radius)] bg-[#0c0c0c] p-3 font-mc text-base">
            {players.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: names can repeat; order is the identity
              <li key={i} className="mc mc-shadow truncate">
                <McLine spans={legacySpans(p.name)} fallback="#AAAAAA" />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            What the game shows when you hover over the player count. Servers choose it: it can be a
            few real players, or lines of text.
          </p>
        </>
      )}
    </div>
  );
}

function Mods({ mods }: { mods: NonNullable<JavaStatus["mods"]> }) {
  return (
    <div>
      <h3 className="label mb-3">
        Mods ({fmt(mods.mods.length)}
        {mods.truncated ? "+, the list is cut short" : ""})
      </h3>
      <ul className="max-h-72 overflow-auto rounded-[var(--radius)] border border-rule">
        {mods.mods.map((m, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: ids can repeat
            key={i}
            className="flex justify-between gap-4 border-t border-rule px-3 py-1.5 text-sm first:border-t-0"
          >
            <span className="min-w-0 truncate">{m.id}</span>
            {m.version && <span className="shrink-0 text-muted tabular-nums">{m.version}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BedrockSection({
  state,
  address,
  both,
  onAgain,
}: {
  state: Bedrock;
  address: string;
  both: boolean;
  onAgain: () => void;
}) {
  const title = both ? "Bedrock Edition" : "Status";
  const credit = (
    <p className="mt-4 text-xs text-muted">
      Bedrock status from{" "}
      <a href="https://mcstatus.io" target="_blank" rel="noreferrer">
        <External>mcstatus.io</External>
      </a>
      , checked from their servers and cached by them for about a minute.
    </p>
  );
  if (state.kind === "loading")
    return (
      <section aria-label="Bedrock Edition">
        <SectionHead title={title} address={address} />
        <Skeleton label={`Checking ${address} over Bedrock…`} />
      </section>
    );
  if (state.kind === "failed")
    return (
      <section aria-label="Bedrock Edition">
        <SectionHead title={title} address={address} />
        <ResultState kind="warn">Couldn't check</ResultState>
        <p className="mt-2 text-muted">{state.message}</p>
        {credit}
      </section>
    );
  const b = state.result;
  if (!b.online)
    return (
      <section aria-label="Bedrock Edition">
        <SectionHead title={title} address={address}>
          <Again checkedAt={b.retrieved_at} onAgain={onAgain} />
        </SectionHead>
        <ResultState kind="bad">Offline</ResultState>
        <p className="mt-2 max-w-[var(--measure)]">No Bedrock server answered at {address}.</p>
        <p className="mt-1 max-w-[var(--measure)] text-sm text-muted">
          Bedrock answers over UDP on its own port, 19132 unless it's set otherwise. With Geyser,
          check its port in plugins/Geyser-Spigot/config.yml (bedrock, port) is open to the internet
          for UDP, not only TCP.
        </p>
        {credit}
      </section>
    );

  const motd = legacySpans(b.motd?.raw ?? "");
  const lines = splitLines(motd);
  const list = (b.players?.list ?? []).filter((p) => p.name_raw);
  return (
    <section aria-label="Bedrock Edition">
      <SectionHead title={title} address={address}>
        <Again checkedAt={b.retrieved_at} onAgain={onAgain} />
      </SectionHead>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <ResultState kind="good">Online</ResultState>
          <div className="mc mc-shadow mt-4 rounded-[var(--radius)] bg-[#0c0c0c] px-4 py-3 text-lg">
            {lines.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity beyond their place
              <div key={i} className="truncate">
                <McLine spans={line} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            The MOTD as Bedrock sends it: the first line is the server's name, the second its world.
            Bedrock's own list draws it differently from Java's.
          </p>
          <dl className="facts mt-4">
            <div>
              <dt>Version</dt>
              <dd>
                {b.version?.name || "Not given"}
                {b.version?.protocol !== undefined && (
                  <span className="block text-sm text-muted">Protocol {b.version.protocol}</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Players</dt>
              <dd>
                {b.players?.online !== undefined && b.players?.max !== undefined
                  ? `${fmt(b.players.online)} of ${fmt(b.players.max)}`
                  : "Hidden"}
              </dd>
            </div>
            {b.gamemode && (
              <div>
                <dt>Game mode</dt>
                <dd>{b.gamemode}</dd>
              </div>
            )}
            {b.software && (
              <div>
                <dt>Software</dt>
                <dd>{b.software}</dd>
              </div>
            )}
            {b.ip_address && (
              <div>
                <dt>Answered from</dt>
                <dd>{formatAddress(b.ip_address, b.port)}</dd>
              </div>
            )}
          </dl>
          {credit}
        </div>
        {list.length > 0 && (
          <div>
            <h3 className="label mb-3">Player sample</h3>
            <ul className="flex flex-col gap-1 rounded-[var(--radius)] bg-[#0c0c0c] p-3 font-mc text-base">
              {list.map((p, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: names can repeat
                <li key={i} className="mc mc-shadow truncate">
                  <McLine spans={legacySpans(p.name_raw ?? "")} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function splitLines(spans: Span[]): Span[][] {
  const lines: Span[][] = [[]];
  for (const span of spans) {
    const parts = span.text.split("\n");
    parts.forEach((text, i) => {
      if (i > 0) lines.push([]);
      if (text) lines[lines.length - 1]?.push({ text, style: span.style });
    });
  }
  return lines.filter((l) => l.length > 0);
}

function Guide() {
  return (
    <>
      <h2>How it checks</h2>
      <ul>
        <li>
          <strong>Java</strong> servers are checked the way the game fills in its server list: our
          checker, on Cloudflare's network, opens a connection to the server and asks for its
          status. Without a port, it first looks up the <code>_minecraft._tcp</code> SRV record, as
          the game does, then falls back to port 25565.
        </li>
        <li>
          <strong>Bedrock</strong> servers answer over UDP, which our checker can't send, so their
          status comes from{" "}
          <a href="https://mcstatus.io" target="_blank" rel="noreferrer">
            <External>mcstatus.io</External>
          </a>
          , straight from your browser. Bedrock's port is 19132 unless the server sets another.
        </li>
        <li>
          <strong>Both</strong> is for a Java server running Geyser: it checks the Java address and
          Bedrock on port 19132 at the same time. If you typed a port, it's used for Java only.
        </li>
        <li>
          Answers are kept for a minute, so many people checking the same server don't flood it.
          "Checked 20 s ago" tells you how fresh it is.
        </li>
      </ul>
      <h2>Reading the result</h2>
      <ul>
        <li>
          <strong>Latency</strong> is from the Cloudflare data centre nearest you to the server, not
          from your computer, so it's close to what a player near you would see, not exact.
        </li>
        <li>
          <strong>Version</strong> is what the server says it accepts. Proxies and ViaVersion often
          say a range ("1.8 to 1.21"), and the protocol number is the one they report.
        </li>
        <li>
          <strong>Secure chat</strong> is <code>enforce-secure-profile</code> in server.properties.
          When it's on, players with chat reporting turned off can't join.
        </li>
        <li>
          <strong>Mods</strong> show for Forge and NeoForge servers, which list them so the game can
          warn about a mismatch. Fabric doesn't send a list.
        </li>
      </ul>
      <h2>If it says offline</h2>
      <ul>
        <li>
          Check the server is running, then that the port is open to the internet: a server that
          works on your own network but not here usually needs a port forward on the router.
        </li>
        <li>
          Private addresses (<code>192.168.x.x</code>, <code>10.x.x.x</code>, <code>127.0.0.1</code>
          , <code>localhost</code>) can't be checked from the internet, and this tool won't try.
        </li>
        <li>
          Changed your MOTD or icon?{" "}
          <Link to="/motd" className="more">
            MOTD Generator
          </Link>{" "}
          and{" "}
          <Link to="/server-icon" className="more">
            Server Icon
          </Link>{" "}
          make both.
        </li>
      </ul>
    </>
  );
}
