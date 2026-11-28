import { createFileRoute } from "@tanstack/react-router";
import {
  detectFormat,
  type InputFormat,
  isLossyForLegacy,
  OUTPUT_FORMATS,
  type OutputFormat,
  parse,
  type Span,
  serialize,
} from "@xena-tools/mc-text";
import { useMemo } from "react";
import { Output } from "../components/Copy";
import { FormatPicker } from "../components/FormatPicker";
import { McText } from "../components/McText";
import { ToolPage, toolHead } from "../components/ToolPage";
import { isOutputFormat, TEXT_FORMATS } from "../lib/text-formats";
import { useUrlState } from "../lib/url-state";
import { toolBySlug } from "../tools";

export const Route = createFileRoute("/text-converter")({
  head: () => toolHead("text-converter"),
  component: ConverterTool,
});

const tool = toolBySlug("text-converter");

type InputChoice = "auto" | InputFormat;

const INPUTS: { id: InputChoice; label: string; usedBy: string }[] = [
  { id: "auto", label: "Detect", usedBy: "Work out the format from the text" },
  { id: "legacy", label: "& / § codes", usedBy: "Legacy codes, including &#RRGGBB and &x" },
  { id: "minimessage", label: "MiniMessage", usedBy: "Adventure's tags" },
  { id: "json", label: "JSON", usedBy: "Text components, as in /tellraw" },
];

const INPUT_NAMES: Record<InputFormat, string> = {
  legacy: "& / § codes",
  minimessage: "MiniMessage",
  json: "JSON",
};

interface State {
  input: string;
  from: InputChoice;
  to: OutputFormat;
}

const DEFAULTS: State = {
  input:
    "<gradient:#5CB4FF:#EDF1F7><bold>Xena Studios</bold></gradient> <gray>| <hover:show_text:'<green>Opens the site'><click:open_url:'https://tools.xenastudios.co'><u>tools.xenastudios.co</u></click></hover>",
  from: "auto",
  to: "legacy-hash",
};

const codec = {
  decode(p: URLSearchParams, d: State): State {
    const from = p.get("from");
    const to = p.get("to");
    return {
      input: p.get("text") ?? d.input,
      from: INPUTS.some((i) => i.id === from) ? (from as InputChoice) : d.from,
      to: isOutputFormat(to) ? to : d.to,
    };
  },
  encode(v: State): URLSearchParams {
    return new URLSearchParams({ text: v.input, from: v.from, to: v.to });
  },
};

function ConverterTool() {
  const { value: state, update } = useUrlState(DEFAULTS, codec);

  const detected = detectFormat(state.input);
  const format = state.from === "auto" ? detected : state.from;

  const result = useMemo((): { spans: Span[]; error?: string } => {
    try {
      return { spans: parse(state.input, format) };
    } catch (e) {
      return { spans: [], error: e instanceof Error ? e.message : String(e) };
    }
  }, [state.input, format]);

  const output = result.error ? "" : serialize(result.spans, state.to);
  const info = OUTPUT_FORMATS.find((f) => f.id === state.to);
  const warning =
    !info?.interactive && isLossyForLegacy(result.spans)
      ? "This format can't hold hover text, click actions or fonts, so they're left out."
      : undefined;

  return (
    <ToolPage tool={tool} guide={<Guide />}>
      <McText
        spans={result.spans}
        className="mb-6 min-h-14 py-4 text-xl"
        empty="Type or paste some text below"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <FormatPicker
            label="From"
            options={INPUTS}
            value={state.from}
            onChange={(from) => update({ from })}
          />
          <label className="block">
            <span className="label mb-2 block">
              Text
              {state.from === "auto" && state.input.trim()
                ? ` (looks like ${INPUT_NAMES[detected]})`
                : ""}
            </span>
            <textarea
              className="field min-h-48 resize-y font-mono text-sm"
              aria-invalid={result.error ? true : undefined}
              value={state.input}
              onChange={(e) => update({ input: e.target.value })}
              spellCheck={false}
            />
          </label>
          {result.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              That isn't valid JSON: {result.error}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 self-start lg:sticky lg:top-24">
          <FormatPicker options={TEXT_FORMATS} value={state.to} onChange={(to) => update({ to })} />
          <Output
            label={info?.label ?? "Output"}
            hint={info?.usedBy}
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
      <h2>What it reads</h2>
      <ul>
        <li>
          <strong>Legacy codes</strong> with <code>&amp;</code> or <code>§</code>: colours{" "}
          <code>&amp;0</code>–<code>&amp;f</code>, styles <code>&amp;k</code>–<code>&amp;o</code>,
          reset <code>&amp;r</code>, and the hex forms <code>&amp;#RRGGBB</code>,{" "}
          <code>&amp;x&amp;R&amp;R&amp;G&amp;G&amp;B&amp;B</code>, <code>{"{#RRGGBB}"}</code> and{" "}
          <code>&lt;#RRGGBB&gt;</code>.
        </li>
        <li>
          <strong>MiniMessage</strong>: colours, styles, <code>&lt;gradient&gt;</code>,{" "}
          <code>&lt;rainbow&gt;</code>, <code>&lt;hover&gt;</code>, <code>&lt;click&gt;</code>,{" "}
          <code>&lt;font&gt;</code>, <code>&lt;newline&gt;</code> and <code>&lt;reset&gt;</code>.
          Placeholders like <code>&lt;player&gt;</code> are kept as written.
        </li>
        <li>
          <strong>JSON</strong> text components, in both the 1.21.5+ form (<code>hover_event</code>)
          and the older one (<code>hoverEvent</code>).
        </li>
      </ul>
      <h2>Good to know</h2>
      <ul>
        <li>
          Legacy codes can't hold hover text or click actions. Converting to them keeps the colours
          and styles and leaves the rest out.
        </li>
        <li>
          Gradients become one colour per letter in every format except MiniMessage's own tag, so
          the output can be long. Chat input is capped at 256 characters, configs aren't.
        </li>
        <li>
          The preview uses Monocraft, an open font in the game's style, so widths are close but not
          exact.
        </li>
      </ul>
    </>
  );
}
