import { createFileRoute, Link } from "@tanstack/react-router";
import {
  advise,
  effectiveCollector,
  type FlagOptions,
  forgeUsesArgsFile,
  heapMbOf,
  isJavaVersion,
  isOutputFormat,
  isSoftware,
  JAVA_VERSIONS,
  type JavaVersion,
  OUTPUT_FORMATS,
  type OutputFormat,
  pterodactylPanelMb,
  pterodactylShare,
  SOFTWARE,
  type Software,
  softwareInfo,
  writeOutput,
} from "@xena-tools/mc-flags";
import { useEffect, useId, useState } from "react";
import { External } from "../components/Brand";
import { Output } from "../components/Copy";
import { type FormatOption, FormatPicker, Toggle } from "../components/FormatPicker";
import { SeverityLabel } from "../components/Severity";
import { ToolPage, toolHead } from "../components/ToolPage";
import { flag, useUrlState } from "../lib/url-state";
import { toolBySlug } from "../tools";

export const Route = createFileRoute("/flags")({
  head: () => toolHead("flags"),
  component: FlagsTool,
});

const tool = toolBySlug("flags");

const RAM_MIN = 0.5;
const RAM_MAX = 256;
const SLIDER_MIN = 1;
const SLIDER_MAX = 32;

interface State extends FlagOptions {
  /** The machine's or container's memory in GB; 0 when not given. */
  totalGb: number;
  container: boolean;
  format: OutputFormat;
}

const DEFAULTS: State = {
  ramGb: 8,
  software: "paper",
  java: 25,
  gc: "g1",
  mcVersion: "",
  jar: "",
  nogui: true,
  restart: false,
  totalGb: 0,
  container: false,
  format: "sh",
};

const FORMATS: FormatOption<OutputFormat>[] = OUTPUT_FORMATS.map((f) => ({ ...f }));
const SOFTWARE_OPTIONS: FormatOption<Software>[] = SOFTWARE.map((s) => ({
  id: s.id,
  label: s.label,
  usedBy: s.note,
}));
const JAVA_OPTIONS: FormatOption<`${JavaVersion}`>[] = JAVA_VERSIONS.map((j) => ({
  id: `${j}` as const,
  label: `Java ${j}`,
  usedBy: j === 25 ? "Minecraft 26.1 and later" : j === 21 ? "1.20.5 to 1.21.11" : "1.18 to 1.20.4",
}));
const GC_OPTIONS: FormatOption<FlagOptions["gc"]>[] = [
  { id: "g1", label: "Aikar's G1 (recommended)", usedBy: "PaperMC's recommended flags" },
  { id: "zgc", label: "Generational ZGC", usedBy: "Big heaps with spare cores, Java 21 or later" },
];

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const halfStep = (n: number) => Math.round(n * 2) / 2;

function gbParam(v: string | null, fallback: number, lo: number) {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) && n >= lo ? clamp(halfStep(n), lo, RAM_MAX * 4) : fallback;
}

const codec = {
  decode(p: URLSearchParams, d: State): State {
    const s = p.get("s");
    const j = Number(p.get("j"));
    const f = p.get("f");
    return {
      ramGb: clamp(gbParam(p.get("r"), d.ramGb, RAM_MIN), RAM_MIN, RAM_MAX),
      software: isSoftware(s) ? s : d.software,
      java: isJavaVersion(j) ? j : d.java,
      gc: p.get("g") === "zgc" ? "zgc" : p.get("g") === "g1" ? "g1" : d.gc,
      mcVersion: (p.get("v") ?? d.mcVersion).slice(0, 16),
      jar: (p.get("n") ?? d.jar).slice(0, 128),
      nogui: flag(p, "u", d.nogui),
      restart: flag(p, "l", d.restart),
      totalGb: gbParam(p.get("t"), d.totalGb, 0),
      container: flag(p, "c", d.container),
      format: isOutputFormat(f) ? f : d.format,
    };
  },
  encode(v: State, d: State): URLSearchParams {
    const p = new URLSearchParams({
      r: String(v.ramGb),
      s: v.software,
      j: String(v.java),
      g: v.gc,
      f: v.format,
      u: v.nogui ? "1" : "0",
      l: v.restart ? "1" : "0",
    });
    if (v.mcVersion !== d.mcVersion) p.set("v", v.mcVersion);
    if (v.jar !== d.jar) p.set("n", v.jar);
    if (v.totalGb) p.set("t", String(v.totalGb));
    if (v.container) p.set("c", "1");
    return p;
  },
};

const gb = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}GB`;

/** A number field that lets you clear it while typing, and settles on blur. */
function NumberField({
  value,
  onCommit,
  min,
  max,
  step,
  placeholder,
  ...rest
}: {
  value: number | "";
  onCommit: (n: number | null) => void;
  min: number;
  max: number;
  step: number;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      {...rest}
      className="field w-24 tabular-nums"
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number.parseFloat(e.target.value);
        if (e.target.value === "") onCommit(null);
        else if (Number.isFinite(n) && n >= min) onCommit(Math.min(max, n));
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}

function FlagsTool() {
  const { value: state, update } = useUrlState(DEFAULTS, codec);
  const ids = useId();
  const info = softwareInfo(state.software);
  const proxy = info.kind === "proxy";
  const forgeArgs = forgeUsesArgsFile(state);
  const collector = effectiveCollector(state);
  const limitGb = state.container && state.totalGb > 0 ? state.totalGb : undefined;
  const output = writeOutput(state.format, state, limitGb);
  const advice = advise(state, {
    totalGb: state.totalGb || undefined,
    container: state.container,
  });
  const format = OUTPUT_FORMATS.find((f) => f.id === state.format);
  const heapGb = heapMbOf(state.ramGb) / 1024;

  const sliderValue = clamp(state.ramGb, SLIDER_MIN, SLIDER_MAX);
  const fill = `${((sliderValue - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%`;

  const hint = (() => {
    switch (state.format) {
      case "sh":
        return "Save it next to the jar, run chmod +x start.sh once, then ./start.sh";
      case "bat":
        return "Save it next to the jar and double-click it";
      case "pterodactyl":
        return `Set the server's memory in the panel to ${pterodactylPanelMb(state)} MB for a ${gb(heapGb)} heap`;
      case "docker":
        return "Save it as compose.yaml, then run docker compose up -d";
      case "flags":
        return forgeArgs
          ? "One line for user_jvm_args.txt, which Forge's run.sh reads"
          : "Paste them after java and before -jar";
    }
  })();

  const formatNote = (() => {
    if (state.format === "pterodactyl") {
      return `The heap is ${pterodactylShare(state.software)}% of the panel's memory, so it follows the panel when you change it. Pterodactyl restarts crashed servers itself, so there's no loop.`;
    }
    if (state.format === "docker") {
      return `The image downloads ${info.label} itself, so the jar name isn't used.${state.restart ? " restart: unless-stopped does the restart loop's job." : ""}`;
    }
    if (state.format === "bat" && forgeArgs && state.restart) {
      return "Forge's run.bat ends with pause, so each restart waits for a key. Delete that line from run.bat to restart on its own.";
    }
    return undefined;
  })();

  const versionInvalid = advice.some((a) => a.id === "version-unknown");

  return (
    <ToolPage tool={tool} guide={<Guide />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <fieldset>
            <legend className="label mb-2">Memory for the server</legend>
            <div className="flex items-center gap-3">
              <input
                type="range"
                className="range"
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={0.5}
                value={sliderValue}
                aria-label="Memory in GB"
                aria-valuetext={gb(state.ramGb)}
                style={{ "--fill": fill } as React.CSSProperties}
                onChange={(e) => update({ ramGb: Number(e.target.value) })}
              />
              <NumberField
                aria-label="Memory in GB, typed"
                value={state.ramGb}
                min={RAM_MIN}
                max={RAM_MAX}
                step={0.5}
                onCommit={(n) => n !== null && update({ ramGb: halfStep(n) || RAM_MIN })}
              />
              <span className="text-sm text-muted">GB</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              The Java heap, set as both Xms and Xmx. The machine needs more than this.
            </p>
          </fieldset>

          <FormatPicker
            label="Server software"
            options={SOFTWARE_OPTIONS}
            value={state.software}
            onChange={(software) => update({ software })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label mb-2 block">Minecraft version</span>
              <input
                className="field"
                value={state.mcVersion}
                placeholder="Optional, like 1.21.4"
                maxLength={16}
                spellCheck={false}
                inputMode="decimal"
                disabled={proxy}
                aria-invalid={versionInvalid ? true : undefined}
                aria-describedby={`${ids}-version`}
                onChange={(e) => update({ mcVersion: e.target.value })}
              />
              <span id={`${ids}-version`} className="mt-1 block text-xs text-muted">
                {proxy
                  ? "A proxy runs every version, so it isn't needed."
                  : versionInvalid
                    ? "Not a release number: write it like 1.21.4 or 26.1."
                    : "Checks your Java against it."}
              </span>
            </label>
            <label className="block">
              <span className="label mb-2 block">
                {forgeArgs ? "Forge starts with" : "Jar file"}
              </span>
              <input
                className="field"
                value={forgeArgs ? "run.sh / run.bat" : state.jar}
                placeholder={info.jar}
                maxLength={128}
                spellCheck={false}
                disabled={forgeArgs}
                aria-describedby={`${ids}-jar`}
                onChange={(e) => update({ jar: e.target.value })}
              />
              <span id={`${ids}-jar`} className="mt-1 block text-xs text-muted">
                {forgeArgs
                  ? "The installer's scripts, from 1.17 on: no jar to name."
                  : "Its name in your server folder."}
              </span>
            </label>
          </div>

          <FormatPicker
            label="Java"
            options={JAVA_OPTIONS}
            value={`${state.java}`}
            onChange={(j) => update({ java: Number(j) as JavaVersion })}
          />

          <div>
            <FormatPicker
              label="Garbage collector"
              options={GC_OPTIONS}
              value={state.gc}
              onChange={(gc) => update({ gc })}
            />
            <p className="mt-2 text-xs text-muted">
              {collector === "proxy"
                ? "Proxies use Velocity's recommended flags instead."
                : collector === "zgc"
                  ? `Generational ZGC, written for Java ${state.java}.`
                  : state.gc === "zgc"
                    ? "Java 17 has no generational ZGC, so this is G1."
                    : heapGb > 12
                      ? "Aikar's flags, with his values for heaps over 12GB."
                      : "Aikar's flags, as PaperMC publishes them."}
            </p>
          </div>

          <fieldset>
            <legend className="label mb-2">The machine</legend>
            <div className="flex flex-wrap items-center gap-3">
              <NumberField
                aria-label="Total memory of the machine or container, in GB"
                aria-describedby={`${ids}-total`}
                value={state.totalGb || ""}
                placeholder="None"
                min={0}
                max={RAM_MAX * 4}
                step={0.5}
                onCommit={(n) => update({ totalGb: n ? halfStep(n) : 0 })}
              />
              <span className="text-sm text-muted">GB in all</span>
              <Toggle checked={state.container} onChange={(container) => update({ container })}>
                Container (Docker, Pterodactyl)
              </Toggle>
            </div>
            <p id={`${ids}-total`} className="mt-2 text-xs text-muted">
              Optional. With it, you're told if Java has too little room beyond the heap.
            </p>
          </fieldset>

          <fieldset>
            <legend className="label mb-2">Script</legend>
            <div className="flex flex-wrap gap-2">
              {info.nogui && (
                <Toggle checked={state.nogui} onChange={(nogui) => update({ nogui })}>
                  No GUI window ({info.nogui})
                </Toggle>
              )}
              <Toggle checked={state.restart} onChange={(restart) => update({ restart })}>
                Restart when it stops
              </Toggle>
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-4 self-start lg:sticky lg:top-24">
          <FormatPicker
            label="Where it goes"
            options={FORMATS}
            value={state.format}
            onChange={(f) => update({ format: f })}
          />
          <Output
            label={format?.label ?? "Output"}
            hint={hint}
            value={output}
            warning={formatNote}
          />
          {advice.length > 0 && (
            <section aria-label="Checks" className="flex flex-col gap-2">
              <h2 className="label">Checks</h2>
              <ul className="flex flex-col gap-2" aria-live="polite">
                {advice.map((a) => (
                  <li
                    key={a.id}
                    className="panel flex flex-wrap items-start gap-x-3 gap-y-2 p-3 text-sm"
                  >
                    <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
                      <SeverityLabel severity={a.level === "warning" ? "warning" : "info"} />
                      <p className="text-muted">{a.text}</p>
                    </div>
                    {a.fixRamGb !== undefined && a.fixRamGb !== state.ramGb && (
                      <button
                        type="button"
                        className="button compact shrink-0"
                        onClick={() => update({ ramGb: a.fixRamGb })}
                      >
                        Use {gb(a.fixRamGb ?? 0)}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </ToolPage>
  );
}

function Guide() {
  return (
    <>
      <h2>What the flags do</h2>
      <ul>
        <li>
          <strong>Xms and Xmx</strong> set the heap: the memory Java keeps the server's objects in.
          Xmx is the most it may use; Xms is how much it takes at the start.
        </li>
        <li>
          <strong>Aikar's flags</strong> tune the G1 collector for how Minecraft uses memory: it
          makes a huge amount of short-lived garbage (block positions, packets), so they give the
          young generation far more room, collect it in pauses of up to 200ms (four ticks at most),
          and stop plugins forcing a full collection with <code>System.gc()</code>. PaperMC explains
          each one on its{" "}
          <a href="https://docs.papermc.io/paper/aikars-flags">
            Aikar's flags <External>page</External>
          </a>
          . Over 12GB, a few values change to suit the bigger heap.
        </li>
        <li>
          <strong>Generational ZGC</strong> collects almost entirely alongside the server, so pauses
          stay under a millisecond, at the cost of more CPU and memory. It's worth trying on big
          heaps (16GB and up) with cores to spare. On Java 21 it needs{" "}
          <code>-XX:+ZGenerational</code>; from Java 23 that's the default and the flag is
          deprecated, so it's left out.
        </li>
        <li>
          <strong>Proxies</strong> (Velocity, BungeeCord, Waterfall) get{" "}
          <a href="https://docs.papermc.io/velocity/tuning">
            Velocity's recommended <External>flags</External>
          </a>
          . A proxy holds no worlds, so it needs far less memory: about 512MB per 500 players, plus
          1GB.
        </li>
      </ul>

      <h2>Why Xms equals Xmx</h2>
      <p>
        Plan for the server to use all of Xmx, because in time it will. Then a lower Xms saves
        nothing: it only makes Java grow the heap in steps while you play, and G1 works better with
        all its room from the start. <code>-XX:+AlwaysPreTouch</code> claims the whole heap at
        launch, so if the machine can't hold it you find out then, not at peak hours.
      </p>

      <h2>Leave memory for Java itself</h2>
      <p>
        Java uses memory outside the heap: threads, compiled code, the collector's own tables and
        network buffers. Leave 1 to 1.5GB, or 10 to 15%, beyond Xmx: on an 8GB machine give the
        server about 6.5GB. In a container the limit is hard and going over gets the server killed
        without a crash report, so leave more, around a fifth.
      </p>

      <h2>On a VPS or your own machine</h2>
      <ul>
        <li>
          Linux: save <code>start.sh</code> in the server folder, run <code>chmod +x start.sh</code>{" "}
          once, then <code>./start.sh</code>. Run it inside <code>screen</code> or <code>tmux</code>{" "}
          so it keeps going when you log out.
        </li>
        <li>
          Windows: save <code>start.bat</code> in the server folder and double-click it.{" "}
          <code>pause</code> keeps the window open if it stops, so you can read why.
        </li>
        <li>
          With the restart loop, <code>/stop</code> restarts the server after five seconds. Press
          Ctrl+C during the wait to stop for good.
        </li>
        <li>
          Forge and NeoForge from 1.17 have no server jar: the installer writes <code>run.sh</code>{" "}
          and <code>user_jvm_args.txt</code>. The script here writes the flags into that file and
          then calls <code>run.sh</code>.
        </li>
      </ul>

      <h2>On Pterodactyl</h2>
      <ul>
        <li>
          The startup command is on the server's Startup tab. Only an admin can change it: on a
          hosted panel, ask your host, or paste just the flags if they give you a field for them.
        </li>
        <li>
          <code>{"{{SERVER_MEMORY}}"}</code> is the memory you set for the server in MB, and{" "}
          <code>{"{{SERVER_JARFILE}}"}</code> is the egg's jar variable. The panel's startup script
          expands the line, so the heap is worked out from the memory: 85% of it for a server and
          half for a proxy, as Velocity advises. Wings already lets the container go 5 to 15% over
          that figure, but that alone is less than Java needs.
        </li>
      </ul>

      <h2>On Docker</h2>
      <ul>
        <li>
          The compose file is for{" "}
          <a href="https://docker-minecraft-server.readthedocs.io/">
            <External>itzg/minecraft-server</External>
          </a>
          , or{" "}
          <a href="https://github.com/itzg/docker-mc-proxy">
            <External>itzg/mc-proxy</External>
          </a>{" "}
          for a proxy. It sets <code>MEMORY</code> (both Xms and Xmx) and turns on the image's own{" "}
          <code>USE_AIKAR_FLAGS</code>, which follows the same 12GB rule. ZGC and proxy flags go in{" "}
          <code>JVM_XX_OPTS</code>.
        </li>
        <li>
          The image tag picks the Java version. With the machine's memory and Container set, it also
          sets <code>mem_limit</code>; itzg suggests a container a quarter bigger than the heap.
        </li>
      </ul>

      <h2>Good to know</h2>
      <ul>
        <li>
          Minecraft 26.1 and later need Java 25, 1.20.5 to 1.21.11 need Java 21, and 1.18 to 1.20.4
          need Java 17, from the Java version Mojang lists for each release.
        </li>
        <li>
          More memory isn't always faster: PaperMC says the returns shrink past a point, and that
          32GB "will only waste your money". If the server still lags, a profile from{" "}
          <a href="https://spark.lucko.me/">
            <External>spark</External>
          </a>{" "}
          shows where the time goes.
        </li>
        <li>
          Writing the server list message next? The{" "}
          <Link to="/motd" className="more">
            MOTD Generator
          </Link>{" "}
          previews it in the server list.
        </li>
      </ul>
    </>
  );
}
