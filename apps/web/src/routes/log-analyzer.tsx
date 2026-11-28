import { createFileRoute, Link } from "@tanstack/react-router";
import {
  type Analysis,
  analyse,
  type Finding,
  looksLikeText,
  type PluginErrors,
  SEVERITIES,
} from "@xena-tools/analyzers";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { External } from "../components/Brand";
import { LogViewer, type LogViewerHandle } from "../components/LogViewer";
import {
  SEVERITY_CLASS,
  SEVERITY_PLURAL,
  SeverityIcon,
  SeverityLabel,
} from "../components/Severity";
import { ToolPage, toolHead } from "../components/ToolPage";
import { toolBySlug } from "../tools";

export const Route = createFileRoute("/log-analyzer")({
  head: () => toolHead("log-analyzer"),
  component: LogAnalyzerTool,
});

const tool = toolBySlug("log-analyzer");

// The log itself never goes in the URL, so this tool keeps no URL state at all.

const MAX_BYTES = 200 * 1024 * 1024;
const MCLOGS_API = "https://api.mclo.gs/1/raw/";

type Phase =
  | { kind: "empty" }
  | { kind: "reading"; what: string }
  | { kind: "done"; analysis: Analysis; name: string };

const fmt = (n: number) => n.toLocaleString("en-GB");
const plural = (n: number, [one, many]: [string, string]) => `${fmt(n)} ${n === 1 ? one : many}`;

/** An mclo.gs link or bare id, as the id. */
function mclogsId(input: string): string | null {
  const s = input.trim();
  const m =
    /^(?:https?:\/\/)?(?:www\.)?(?:api\.)?mclo\.gs\/(?:1\/(?:raw|log)\/)?([A-Za-z0-9]{3,32})\/?(?:[?#].*)?$/.exec(
      s,
    ) ?? /^([A-Za-z0-9]{5,32})$/.exec(s);
  return m?.[1] ?? null;
}

class Unreadable extends Error {}

/** A file as text: gunzipped in the browser when it's a .gz. */
async function readFile(file: File): Promise<string> {
  if (file.size > MAX_BYTES)
    throw new Unreadable("That file is over 200MB. Try latest.log or one day's .log.gz.");
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const gzip = head[0] === 0x1f && head[1] === 0x8b;
  let text: string;
  if (gzip) {
    if (typeof DecompressionStream === "undefined")
      throw new Unreadable(
        "This browser can't unpack .gz files. Unpack it first, or paste the log.",
      );
    try {
      text = await new Response(file.stream().pipeThrough(new DecompressionStream("gzip"))).text();
    } catch {
      throw new Unreadable(
        "That .gz file couldn't be unpacked: it may be cut short. Try downloading it again.",
      );
    }
  } else {
    text = await file.text();
  }
  if (!looksLikeText(text.slice(0, 64_000)))
    throw new Unreadable(
      `${file.name} isn't a text log. Choose latest.log, a crash report or a .log.gz from logs/.`,
    );
  return text;
}

/** Yields to the browser so "Reading…" paints before the work starts. */
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

function LogAnalyzerTool() {
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "empty" });
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const results = useRef<HTMLHeadingElement>(null);
  const ids = useId();

  const run = useCallback(async (input: string, name: string) => {
    setError(null);
    const lines = input.split("\n", 500_001).length;
    setPhase({ kind: "reading", what: `Reading ${plural(lines, ["line", "lines"])}…` });
    await nextFrame();
    const analysis = analyse(input);
    setPhase({ kind: "done", analysis, name });
  }, []);

  const alertRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) alertRef.current?.scrollIntoView({ block: "nearest" });
  }, [error]);

  useEffect(() => {
    if (phase.kind !== "done") return;
    results.current?.focus({ preventScroll: true });
    results.current?.scrollIntoView({ block: "start" });
  }, [phase]);

  const onFile = async (file: File) => {
    setError(null);
    setPhase({ kind: "reading", what: `Opening ${file.name}…` });
    try {
      const content = await readFile(file);
      setText("");
      await run(content, file.name);
    } catch (e) {
      setPhase({ kind: "empty" });
      setError(
        e instanceof Unreadable
          ? e.message
          : `${file.name} couldn't be read. Try saving it again, or paste the log instead.`,
      );
    }
  };

  const fetchMclogs = async () => {
    const id = mclogsId(link);
    if (!id) {
      setError("That isn't an mclo.gs link. It looks like https://mclo.gs/abc1234.");
      return;
    }
    setError(null);
    setPhase({ kind: "reading", what: `Fetching mclo.gs/${id}…` });
    try {
      const res = await fetch(`${MCLOGS_API}${id}`);
      if (!res.ok) {
        setPhase({ kind: "empty" });
        setError(
          res.status === 404
            ? `There's no log at mclo.gs/${id}. Check the link: mclo.gs deletes logs nobody has opened in a while.`
            : `mclo.gs answered ${res.status}. Try again in a minute, or paste the log.`,
        );
        return;
      }
      await run(await res.text(), `mclo.gs/${id}`);
    } catch {
      setPhase({ kind: "empty" });
      setError("mclo.gs couldn't be reached. Check your connection, or paste the log instead.");
    }
  };

  const sample = async () => {
    const mod = await import("@xena-tools/analyzers/fixtures/paper-full.log?raw");
    setText(mod.default);
    await run(mod.default, "Sample Paper log");
  };

  const reset = () => {
    setPhase({ kind: "empty" });
    setError(null);
  };

  const busy = phase.kind === "reading";

  return (
    <ToolPage tool={tool} guide={<Guide />}>
      {phase.kind === "done" ? (
        <Results analysis={phase.analysis} name={phase.name} headingRef={results} onReset={reset} />
      ) : (
        <section aria-label="Your log" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dropping is a bonus; the file button does the same */}
          <div
            className={`panel flex flex-col gap-4 p-4 transition-colors duration-200 ease-out-expo ${over ? "border-accent" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const file = e.dataTransfer.files[0];
              if (file) onFile(file);
            }}
          >
            <label className="block">
              <span className="label block">Paste a log or crash report</span>
              <span id={`${ids}-stays`} className="mt-1 mb-2 block text-xs text-muted">
                It stays in this browser: read on your device, never uploaded.
              </span>
              <textarea
                className="field min-h-56 resize-y bg-bg font-mono text-xs leading-relaxed sm:min-h-80"
                value={text}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                wrap="off"
                disabled={busy}
                aria-describedby={`${ids}-stays ${ids}-privacy`}
                placeholder={
                  "[14:02:17] [Server thread/INFO]: Starting minecraft server version 1.21.4\n[14:02:19] [Server thread/ERROR]: Could not load 'plugins/ShopPlus.jar' in 'plugins'\n…"
                }
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="button primary"
                disabled={busy || !text.trim()}
                onClick={() => run(text, "Pasted log")}
              >
                Analyse
              </button>
              <label className={`button choice ${busy ? "pointer-events-none opacity-45" : ""}`}>
                Choose a file
                <input
                  type="file"
                  accept=".log,.txt,.gz,text/plain,application/gzip"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="text-sm text-muted">or drop a .log, .txt or .log.gz here</span>
            </div>
            <form
              className="flex flex-col gap-2 border-t border-rule pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                fetchMclogs();
              }}
            >
              <label htmlFor={`${ids}-mclogs`} className="label">
                Or an mclo.gs link
              </label>
              <div className="flex flex-wrap gap-3">
                <input
                  id={`${ids}-mclogs`}
                  className="field min-w-0 flex-1 basis-56"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://mclo.gs/abc1234"
                  spellCheck={false}
                  autoCapitalize="off"
                  inputMode="url"
                  disabled={busy}
                />
                <button type="submit" className="button" disabled={busy || !link.trim()}>
                  Fetch and analyse
                </button>
              </div>
            </form>
            <p aria-live="polite" className="min-h-6 text-sm text-muted">
              {busy ? phase.what : ""}
            </p>
            {error && (
              <p
                ref={alertRef}
                role="alert"
                className="-mt-4 scroll-mb-24 flex items-start gap-2 text-sm text-[var(--danger)]"
              >
                <SeverityIcon severity="error" className="mt-[0.3em]" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <aside className="flex flex-col gap-6 text-sm text-muted">
            <div>
              <h2 className="mb-2 text-base font-semibold tracking-normal text-text">
                Where to find it
              </h2>
              <ul className="flex flex-col gap-2">
                <li>
                  <code className="text-text">logs/latest.log</code> in the server folder: this
                  session's log, from the start.
                </li>
                <li>
                  <code className="text-text">logs/2026-11-27-1.log.gz</code> and so on: earlier
                  sessions. Drop the .gz as it is.
                </li>
                <li>
                  <code className="text-text">crash-reports/</code>: one file per crash, named after
                  its date.
                </li>
                <li>On a panel such as Pterodactyl, they're in the Files tab.</li>
              </ul>
            </div>
            <p id={`${ids}-privacy`} className="border-t border-rule pt-4">
              <strong className="font-semibold text-text">The one request this page makes</strong>{" "}
              is to mclo.gs, and only when you give it an mclo.gs link. The log isn't put in the
              link either.
            </p>
            <button
              type="button"
              className="button compact self-start"
              onClick={sample}
              disabled={busy}
            >
              Try a sample log
            </button>
          </aside>
        </section>
      )}
    </ToolPage>
  );
}

function Results({
  analysis,
  name,
  headingRef,
  onReset,
}: {
  analysis: Analysis;
  name: string;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onReset: () => void;
}) {
  const viewer = useRef<LogViewerHandle>(null);
  const { summary, findings, errors, log } = analysis;
  const counts = SEVERITIES.map(
    (s) => [s, findings.filter((f) => f.severity === s).length] as const,
  );

  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h2
              id="results-heading"
              ref={headingRef}
              tabIndex={-1}
              className="scroll-mt-24 text-[length:var(--t-h3)] outline-none"
            >
              {name}
            </h2>
            <p className="text-sm text-muted">
              {log.kind === "crash-report" ? "Crash report" : "Log"},{" "}
              {plural(log.lines.length, ["line", "lines"])}. Read in this browser; nothing was
              uploaded.
            </p>
          </div>
          <button type="button" className="button compact" onClick={onReset}>
            Analyse another log
          </button>
        </div>
        <SummaryStrip analysis={analysis} />
        {!analysis.recognised && (
          <p role="status" className="flex items-start gap-2 text-sm text-[var(--warning)]">
            <SeverityIcon severity="warning" className="mt-[0.3em]" />
            <span>
              This doesn't look like a Minecraft server log: no timestamps, stack traces or crash
              report were found. Paste <code>logs/latest.log</code> or a file from{" "}
              <code>crash-reports/</code>.
            </span>
          </p>
        )}
      </div>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="problems-heading" className="min-w-0">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="problems-heading" className="text-[length:var(--t-h3)]">
              Problems
            </h2>
            {findings.length > 0 && (
              <p className="flex flex-wrap gap-x-4 text-sm">
                {counts
                  .filter(([, n]) => n > 0)
                  .map(([s, n]) => (
                    <span
                      key={s}
                      className={`inline-flex items-center gap-1.5 ${SEVERITY_CLASS[s]}`}
                    >
                      <SeverityIcon severity={s} />
                      {plural(n, SEVERITY_PLURAL[s])}
                    </span>
                  ))}
              </p>
            )}
          </div>
          {findings.length === 0 ? (
            <NothingFound errors={errors.length} />
          ) : (
            <div className="flex flex-col gap-8">
              {SEVERITIES.map((s) => {
                const group = findings.filter((f) => f.severity === s);
                if (!group.length) return null;
                return (
                  <section key={s} aria-label={`${SEVERITY_PLURAL[s][1]}`}>
                    <ul className="panel overflow-hidden">
                      {group.map((f) => (
                        <FindingRow
                          key={f.id}
                          finding={f}
                          analysis={analysis}
                          onShow={(n) => viewer.current?.show(n)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <ErrorsByPlugin
          errors={errors}
          kind={summary.pluginKind}
          analysis={analysis}
          onShow={(p) => viewer.current?.showPlugin(p)}
        />
      </div>

      <section aria-labelledby="log-heading">
        <h2 id="log-heading" className="mb-4 text-[length:var(--t-h3)]">
          The log
        </h2>
        <LogViewer analysis={analysis} ref={viewer} />
      </section>
    </section>
  );
}

function SummaryStrip({ analysis }: { analysis: Analysis }) {
  const s = analysis.summary;
  const missing = <span className="text-muted">Not in the log</span>;
  const kind = s.pluginKind === "mods" ? "Mods" : "Plugins";
  const items: [string, React.ReactNode][] = [
    [
      "Software",
      s.software ? (
        <>
          {s.software}
          {s.softwareVersion && (
            <span className="block truncate text-xs text-muted" title={s.softwareVersion}>
              {s.softwareVersion}
            </span>
          )}
        </>
      ) : (
        missing
      ),
    ],
    ["Minecraft", s.minecraft ?? missing],
    ["Java", s.java ?? missing],
    [kind, s.plugins.length ? fmt(s.plugins.length) : missing],
    ["Startup", s.startup !== undefined ? `${s.startup.toFixed(1)}s` : missing],
    [
      "Mode",
      s.mode === "online"
        ? "Online"
        : s.mode === "offline"
          ? "Offline"
          : s.mode === "proxy"
            ? "Offline, behind a proxy"
            : missing,
    ],
  ];
  return (
    <div className="panel overflow-hidden">
      <dl className="grid grid-cols-2 gap-px bg-rule sm:grid-cols-3 xl:grid-cols-6">
        {items.map(([label, value]) => (
          <div key={label} className="min-w-0 bg-raised p-3 sm:p-4">
            <dt className="label mb-1">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {s.plugins.length > 0 && (
        <details className="border-t border-rule px-3 py-2 text-sm sm:px-4">
          <summary className="disclose py-1 text-muted">
            {kind}:{" "}
            {s.plugins
              .slice(0, 6)
              .map((p) => p.name)
              .join(", ")}
            {s.plugins.length > 6 ? `, and ${s.plugins.length - 6} more` : ""}
          </summary>
          <ul className="mt-2 mb-1 grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {s.plugins.map((p) => (
              <li key={p.name} className="min-w-0 truncate">
                {p.name} <span className="text-muted">{p.version}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function NothingFound({ errors }: { errors: number }) {
  return (
    <div className="panel flex flex-col gap-2 p-5 text-sm">
      <p className="font-semibold">No known problems in this log.</p>
      <p className="text-muted">
        None of the checks matched.{" "}
        {errors > 0
          ? "There are errors, though: Errors by plugin shows whose they are, and the log below has them."
          : "There are no errors or stack traces in it either."}{" "}
        If the server still misbehaves, the cause may be in a config or in lag, which a log can't
        show: a spark profile can.
      </p>
    </div>
  );
}

function FindingRow({
  finding: f,
  analysis,
  onShow,
}: {
  finding: Finding;
  analysis: Analysis;
  onShow: (n: number) => void;
}) {
  const hits = new Set(f.lines);
  const first = f.lines[0];
  return (
    <li className="flex flex-col gap-3 border-rule p-4 not-first:border-t sm:p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SeverityLabel severity={f.severity} />
        {f.count > 1 && !f.title.includes(`${f.count} times`) && (
          <span className="text-xs text-muted tabular-nums">{fmt(f.count)} times</span>
        )}
      </div>
      <h3 className="text-base font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]">
        {f.title}
      </h3>
      <p className="max-w-[var(--measure)] text-sm text-muted [overflow-wrap:anywhere]">
        {f.explanation}
      </p>
      {f.fix.length > 0 && (
        <div>
          <h4 className="label mb-2">Fix</h4>
          <ol className="flex max-w-[var(--measure)] list-decimal [overflow-wrap:anywhere] flex-col gap-1.5 pl-5 text-sm marker:text-muted marker:tabular-nums">
            {f.fix.map((step) => (
              <li key={step} className="pl-1">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
      {f.links.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {f.links.map((l) => (
            <li key={l.url}>
              {l.url.startsWith("/") ? (
                <a href={l.url} className="more">
                  {l.label}
                </a>
              ) : (
                <a href={l.url} rel="noreferrer">
                  <External>{l.label}</External>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {f.context.length > 0 && (
        <details>
          <summary className="disclose text-sm text-muted hover:text-text">
            Matching lines ({fmt(f.lines.length)})
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <div className="log-excerpt">
              <ol>
                {f.context.map((n) => (
                  <li key={n} className={hits.has(n) ? "hit" : undefined}>
                    <span className="n">{n}</span>
                    <span className="t">{analysis.log.lines[n - 1]?.text || " "}</span>
                  </li>
                ))}
              </ol>
            </div>
            {first !== undefined && (
              <button
                type="button"
                className="button compact self-start"
                onClick={() => onShow(first)}
              >
                Show line {fmt(first)} in the log
              </button>
            )}
          </div>
        </details>
      )}
    </li>
  );
}

function ErrorsByPlugin({
  errors,
  kind,
  analysis,
  onShow,
}: {
  errors: PluginErrors[];
  kind: "plugins" | "mods";
  analysis: Analysis;
  onShow: (plugin: string) => void;
}) {
  const plugins = new Set(analysis.entryPlugins);
  return (
    <section aria-labelledby="by-plugin-heading" className="min-w-0 lg:sticky lg:top-24">
      <h2 id="by-plugin-heading" className="mb-4 text-[length:var(--t-h3)]">
        Errors by {kind === "mods" ? "mod" : "plugin"}
      </h2>
      {errors.length === 0 ? (
        <p className="panel p-4 text-sm text-muted">No errors or stack traces in this log.</p>
      ) : (
        <ul className="panel overflow-hidden">
          {errors.map((g) => (
            <li key={g.name} className="flex flex-col gap-1 border-rule p-4 not-first:border-t">
              <div className="flex items-baseline justify-between gap-3">
                <h3
                  className="min-w-0 truncate text-sm font-semibold tracking-normal"
                  title={g.name}
                >
                  {g.name === "Server" ? "The server itself" : g.name}
                </h3>
                <span className="shrink-0 text-sm text-[var(--danger)] tabular-nums">
                  {plural(g.entries.length, ["error", "errors"])}
                </span>
              </div>
              {g.exceptions.length > 0 && (
                <p className="truncate text-xs text-muted">
                  {g.exceptions
                    .slice(0, 3)
                    .map((x) => (x.count > 1 ? `${x.name} (${x.count})` : x.name))
                    .join(", ")}
                </p>
              )}
              {plugins.has(g.name) && (
                <button
                  type="button"
                  className="mt-1 self-start text-xs text-muted underline decoration-rule underline-offset-4 hover:text-text"
                  onClick={() => onShow(g.name)}
                >
                  Show in the log
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">
        Named from the line, its thread, or the first frame of its stack trace that isn't the
        server's. A package name means the plugin wasn't in the log's plugin list.
      </p>
    </section>
  );
}

function Guide() {
  return (
    <>
      <h2>Where the logs are</h2>
      <ul>
        <li>
          <code>logs/latest.log</code> is everything since the server last started. When it starts
          again, the old one is packed as <code>logs/YYYY-MM-DD-N.log.gz</code>; drop that here as
          it is, it's unpacked in your browser.
        </li>
        <li>
          <code>crash-reports/</code> has one file per crash, like{" "}
          <code>crash-2026-11-27_14.20.31-server.txt</code>. A crash report says what was running
          when the game stopped, which the log often doesn't.
        </li>
        <li>
          On Pterodactyl and most hosts, the Files tab has both folders. The console only shows the
          last few hundred lines; the file has all of them.
        </li>
        <li>
          On Velocity, the log is in the proxy's own <code>logs/</code> folder.
        </li>
      </ul>

      <h2>Sharing a log safely</h2>
      <p>
        This page reads the log in your browser and sends it nowhere. To ask someone else for help,
        a paste site made for logs, such as{" "}
        <a href="https://mclo.gs/">
          <External>mclo.gs</External>
        </a>
        , keeps the lines readable. Before you share one anywhere:
      </p>
      <ul>
        <li>
          Look for IP addresses: the log has every player's, in lines like{" "}
          <code>Steve[/203.0.113.9:51234] logged in</code>.
        </li>
        <li>
          Look for passwords and tokens: some plugins print database or web details when they
          connect.
        </li>
        <li>Share the whole log, not the last few lines: the first error is usually the cause.</li>
      </ul>

      <h2>What it can and can't tell</h2>
      <ul>
        <li>
          It knows the common problems by the exact words Paper, Spigot, vanilla, Fabric, Forge and
          Velocity log them in: the wrong Java, a missing plugin or mod, the port in use, a plugin
          that won't enable, a frozen server, offline mode, proxy forwarding, and more.
        </li>
        <li>
          It groups every error by the plugin it came from, from the line itself, its thread or its
          stack trace. That's a good guess, not proof: a plugin can break another's code.
        </li>
        <li>
          It can't see your configs or measure lag. For lag, a{" "}
          <a href="https://spark.lucko.me/">
            <External>spark</External>
          </a>{" "}
          profile shows what takes the time.
        </li>
        <li>
          Messages change between versions. If it misses something, the log viewer still filters to
          errors and to each plugin.
        </li>
        <li>
          Starting the server again? The{" "}
          <Link to="/flags" className="more">
            Startup Flags
          </Link>{" "}
          tool writes its start script.
        </li>
      </ul>
    </>
  );
}
