import { createFileRoute, Link } from "@tanstack/react-router";
import {
  detectFormat,
  isLossyForLegacy,
  isMotdTarget,
  MOTD_TARGETS,
  MOTD_WIDTH,
  type MotdTarget,
  motdSpans,
  NAMED_COLORS,
  namedByHex,
  parse,
  parseColor,
  type Span,
  textWidth,
  writeMotd,
} from "@xena-tools/mc-text";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Output } from "../components/Copy";
import { type FormatOption, FormatPicker, Toggle } from "../components/FormatPicker";
import { ImageDrop, useImageFile } from "../components/ImageDrop";
import { ServerList } from "../components/ServerList";
import { ToolPage, toolHead } from "../components/ToolPage";
import { flag, useUrlState } from "../lib/url-state";
import { toolBySlug } from "../tools";

export const Route = createFileRoute("/motd")({
  head: () => toolHead("motd"),
  component: MotdTool,
});

const tool = toolBySlug("motd");

const TARGETS: FormatOption<MotdTarget>[] = MOTD_TARGETS.map((t) => ({
  id: t.id,
  label: t.label,
  usedBy: t.file,
}));

interface State {
  line1: string;
  line2: string;
  name: string;
  online: number;
  max: number;
  format: MotdTarget;
  /** server.properties only: write hex colours (Paper) or the 16 (vanilla). */
  hex: boolean;
}

const DEFAULTS: State = {
  line1: "&#5CB4FF&lSkyward SMP &8| &7Survival on 1.21",
  line2: "&fThe new spawn is open. &aCome and see!",
  name: "Minecraft Server",
  online: 12,
  max: 100,
  format: "server-properties",
  hex: true,
};

const count = (v: string | null, fallback: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 999_999) : fallback;
};

const codec = {
  decode(p: URLSearchParams, d: State): State {
    const f = p.get("f");
    return {
      line1: p.get("a") ?? d.line1,
      line2: p.get("b") ?? d.line2,
      name: p.get("n") ?? d.name,
      online: count(p.get("o"), d.online),
      max: count(p.get("m"), d.max),
      format: isMotdTarget(f) ? f : d.format,
      hex: flag(p, "h", d.hex),
    };
  },
  encode(v: State): URLSearchParams {
    return new URLSearchParams({
      a: v.line1,
      b: v.line2,
      n: v.name,
      o: String(v.online),
      m: String(v.max),
      f: v.format,
      h: v.hex ? "1" : "0",
    });
  },
};

function read(line: string): { spans: Span[]; error?: string } {
  try {
    return { spans: parse(line) };
  } catch (e) {
    return { spans: [], error: e instanceof Error ? e.message : String(e) };
  }
}

type Syntax = "legacy" | "minimessage";

/** The syntax a line is written in, so inserts match it. An empty line follows the other one. */
function syntaxOf(line: string, other: string): Syntax {
  const s = line.trim() ? line : other;
  return s.trim() && detectFormat(s) === "minimessage" ? "minimessage" : "legacy";
}

const STYLES: { label: string; legacy: string; tag: string }[] = [
  { label: "Bold", legacy: "l", tag: "bold" },
  { label: "Italic", legacy: "o", tag: "italic" },
  { label: "Underline", legacy: "n", tag: "underlined" },
  { label: "Strike", legacy: "m", tag: "strikethrough" },
  { label: "Obfuscated", legacy: "k", tag: "obfuscated" },
  { label: "Reset", legacy: "r", tag: "reset" },
];

const LABEL = (name: string) => name.replace(/_/g, " ");

function MotdTool() {
  const { value: state, update } = useUrlState(DEFAULTS, codec);
  const icon = useImageFile();
  const inputs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const [active, setActive] = useState<0 | 1>(0);
  const [pick, setPick] = useState("#5CB4FF");
  // After an insert, the caret goes after what was inserted, as soon as the value is in the field.
  const caret = useRef<{ index: 0 | 1; pos: number } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when either line changes
  useLayoutEffect(() => {
    const c = caret.current;
    if (!c) return;
    caret.current = null;
    const el = inputs[c.index]?.current;
    el?.focus();
    el?.setSelectionRange(c.pos, c.pos);
  }, [state.line1, state.line2]);

  const one = useMemo(() => read(state.line1), [state.line1]);
  const two = useMemo(() => read(state.line2), [state.line2]);
  const spans = useMemo(() => motdSpans(one.spans, two.spans), [one.spans, two.spans]);

  const output = writeMotd(one.spans, two.spans, state.format, { hex: state.hex });
  const target = MOTD_TARGETS.find((t) => t.id === state.format);
  const usesHex = spans.some((s) => s.style.color && !namedByHex(s.style.color));
  const legacyTarget = state.format === "server-properties" || state.format === "bungeecord";

  const warning =
    legacyTarget && isLossyForLegacy(spans)
      ? "Hover, click and fonts can't be written as codes, so they're left out."
      : state.format === "server-properties" && state.hex && usesHex
        ? "Hex colours show on Paper and its forks. Vanilla can't read §x and shows the wrong colours, so turn off hex colours for a vanilla server."
        : state.format === "minimotd"
          ? "MiniMOTD also fills in <online_players> and <max_players>."
          : undefined;

  const widths = [
    { line: 1, width: textWidth(one.spans) },
    { line: 2, width: textWidth(two.spans) },
  ];
  const lines = [state.line1, state.line2];

  const insert = (open: string, close = "") => {
    const el = inputs[active]?.current;
    const key = active === 0 ? "line1" : "line2";
    const value = lines[active] ?? "";
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    const wrapped = selected && close ? `${open}${selected}${close}` : open;
    const next = value.slice(0, start) + wrapped + value.slice(end);
    update({ [key]: next } as Partial<State>);
    caret.current = { index: active, pos: start + wrapped.length };
  };

  const syntax = syntaxOf(lines[active] ?? "", lines[active === 0 ? 1 : 0] ?? "");
  const insertColor = (hex: string) => {
    const named = namedByHex(hex);
    if (syntax === "minimessage") {
      const tag = named?.name ?? hex;
      insert(`<${tag}>`, `</${tag}>`);
    } else insert(named ? `&${named.code}` : `&${hex}`);
  };
  const insertStyle = (s: (typeof STYLES)[number]) =>
    syntax === "minimessage"
      ? insert(`<${s.tag}>`, s.tag === "reset" ? "" : `</${s.tag}>`)
      : insert(`&${s.legacy}`);

  return (
    <ToolPage tool={tool} guide={<Guide />}>
      <ServerList
        name={state.name}
        motd={spans}
        online={state.online}
        max={state.max}
        icon={icon.image?.url}
      />
      <p className="mt-2 mb-6 text-xs text-muted">
        {widths.map(({ line, width: w }) => (
          <span key={line} className="mr-4 inline-block">
            Line {line}: about {w} of {MOTD_WIDTH} px
            {w > MOTD_WIDTH ? ", too wide: the game wraps it and drops what's past line two" : ""}
          </span>
        ))}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="label mb-2">MOTD</legend>
            {([0, 1] as const).map((i) => {
              const result = i === 0 ? one : two;
              const errorId = `motd-line-${i + 1}-error`;
              return (
                <div key={i}>
                  <label className="block">
                    <span className="sr-only">Line {i + 1}</span>
                    <input
                      ref={inputs[i]}
                      className="field font-mc text-lg"
                      value={lines[i]}
                      placeholder={i === 0 ? "Line 1" : "Line 2 (optional)"}
                      maxLength={512}
                      spellCheck={false}
                      aria-invalid={result.error ? true : undefined}
                      aria-describedby={result.error ? errorId : undefined}
                      onFocus={() => setActive(i)}
                      onChange={(e) =>
                        update(i === 0 ? { line1: e.target.value } : { line2: e.target.value })
                      }
                    />
                  </label>
                  {result.error && (
                    <p id={errorId} role="alert" className="mt-2 text-sm text-[var(--danger)]">
                      Line {i + 1} isn't valid JSON: {result.error}
                    </p>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-muted">
              Write <code>&amp;</code> codes, <code>&amp;#RRGGBB</code> or MiniMessage; each line is
              read on its own.
            </p>
          </fieldset>

          <fieldset>
            <legend className="label mb-2">
              Insert into line {active + 1}, as {syntax === "minimessage" ? "MiniMessage" : "codes"}
            </legend>
            <div className="flex flex-wrap gap-2">
              {NAMED_COLORS.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className="swatch"
                  style={{ "--swatch": c.hex } as React.CSSProperties}
                  title={`${LABEL(c.name)} (&${c.code})`}
                  aria-label={`Insert ${LABEL(c.name)}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertColor(c.hex)}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={pick.toLowerCase()}
                onChange={(e) => setPick(parseColor(e.target.value) ?? pick)}
                aria-label="Hex colour"
                className="h-11 w-14 shrink-0 cursor-pointer rounded-[var(--radius)] border border-rule bg-raised p-1.5"
              />
              <button
                type="button"
                className="button compact"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertColor(pick)}
              >
                Insert {pick}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  className="button compact"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertStyle(s)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label mb-2">Preview</legend>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <label className="block">
                <span className="label mb-2 block">Server name</span>
                <input
                  className="field"
                  value={state.name}
                  maxLength={64}
                  onChange={(e) => update({ name: e.target.value })}
                  spellCheck={false}
                />
              </label>
              <label className="block">
                <span className="label mb-2 block">Online</span>
                <input
                  className="field tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={state.online}
                  onChange={(e) => update({ online: count(e.target.value, 0) })}
                />
              </label>
              <label className="block">
                <span className="label mb-2 block">Max</span>
                <input
                  className="field tabular-nums"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={state.max}
                  onChange={(e) => update({ max: count(e.target.value, 0) })}
                />
              </label>
            </div>
            <div className="mt-3">
              <ImageDrop
                compact
                label={icon.image ? "Change icon" : "Preview an icon"}
                onFile={icon.load}
                error={icon.error}
                hint={
                  icon.image && (
                    <button type="button" className="button compact" onClick={icon.clear}>
                      Remove
                    </button>
                  )
                }
              />
              <p className="mt-2 text-xs text-muted">
                Only for the preview, and it stays in your browser. Images can't go in a link, so
                sharing this page shares the text, not the icon.{" "}
                <Link to="/server-icon" className="more">
                  Make a server icon
                </Link>
              </p>
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-4 self-start lg:sticky lg:top-24">
          <FormatPicker
            label="Where it goes"
            options={TARGETS}
            value={state.format}
            onChange={(format) => update({ format })}
          />
          {state.format === "server-properties" && (
            <div className="flex flex-wrap items-center gap-3">
              <Toggle checked={state.hex} onChange={(hex) => update({ hex })}>
                Hex colours (Paper)
              </Toggle>
              <span className="text-xs text-muted">
                {state.hex ? "Off for vanilla: the 16 colours only" : "The 16 colours, for vanilla"}
              </span>
            </div>
          )}
          <Output
            label={target?.label ?? "Output"}
            hint={target?.file}
            value={output}
            warning={warning}
          />
        </div>
      </div>
    </ToolPage>
  );
}

function Guide() {
  return (
    <>
      <h2>Where it goes</h2>
      <ul>
        <li>
          <strong>server.properties</strong>, in your server's folder: replace the{" "}
          <code>motd=</code> line. <code>§</code> is written as <code>§</code> and the line break as{" "}
          <code>\n</code>, which is how Java's properties files spell them, so it reads the same
          however the file is saved. Stop the server, edit the file, then start it: there's no
          command that reloads it.
        </li>
        <li>
          <strong>Velocity</strong>: the <code>motd</code> line in <code>velocity.toml</code>, in
          MiniMessage, the only format Velocity reads there. Run <code>/velocity reload</code> or
          restart the proxy.
        </li>
        <li>
          <strong>BungeeCord or Waterfall</strong>: the <code>motd:</code> line under{" "}
          <code>listeners:</code> in <code>config.yml</code>. Keep its indentation. Restart the
          proxy to be sure it's picked up.
        </li>
        <li>
          <strong>MiniMOTD</strong>: replace the <code>motds</code> list in{" "}
          <code>plugins/MiniMOTD/main.conf</code> (on Velocity,{" "}
          <code>plugins/minimotd-velocity/main.conf</code>), then run <code>/minimotd reload</code>.
        </li>
        <li>
          <strong>MiniMessage</strong> for anything else that takes it, with{" "}
          <code>&lt;newline&gt;</code> between the lines.
        </li>
      </ul>
      <h2>Hex colours</h2>
      <ul>
        <li>
          Players see hex colours from 1.16. In server.properties they're written{" "}
          <code>§x§R§R§G§G§B§B</code>, which Paper and its forks read. Vanilla doesn't: it only
          knows the 16 colours, so turn off hex colours and each one becomes the nearest of them.
        </li>
        <li>
          BungeeCord reads hex as <code>&amp;x&amp;R&amp;R&amp;G&amp;G&amp;B&amp;B</code>, not{" "}
          <code>&amp;#RRGGBB</code>, so that's what it gets.
        </li>
      </ul>
      <h2>Good to know</h2>
      <ul>
        <li>
          The list gives the MOTD about 267 pixels of the game's font per line, wraps anything
          longer, and drops whatever falls past the second line. The pixel counts above are
          estimates from the game's letter widths.
        </li>
        <li>
          The preview uses Monocraft, an open font in the game's style. It's monospaced and the
          game's font isn't, so the width is close, not exact.
        </li>
        <li>Text with no colour is grey in the server list, a little darker than chat's grey.</li>
      </ul>
    </>
  );
}
