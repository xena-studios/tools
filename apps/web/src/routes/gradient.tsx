import { createFileRoute } from "@tanstack/react-router";
import {
  type Decoration,
  gradient,
  type Interpolation,
  isLossyForLegacy,
  namedByHex,
  type OutputFormat,
  parseColor,
  serialize,
} from "@xena-tools/mc-text";
import { useMemo } from "react";
import { Output } from "../components/Copy";
import {
  type FormatOption,
  FormatPicker,
  isOutputFormat,
  TEXT_FORMATS,
  Toggle,
} from "../components/FormatPicker";
import { McText } from "../components/McText";
import { ToolPage, toolHead } from "../components/ToolPage";
import { flag, useUrlState } from "../lib/url-state";
import { toolBySlug } from "../tools";

export const Route = createFileRoute("/gradient")({
  head: () => toolHead("gradient"),
  component: GradientTool,
});

const tool = toolBySlug("gradient");

type Format = OutputFormat | "minimessage-tag";

const FORMATS: FormatOption<Format>[] = [
  TEXT_FORMATS[0] as FormatOption<Format>,
  { id: "minimessage-tag", label: "<gradient> tag", usedBy: "MiniMessage, shortest to write" },
  ...(TEXT_FORMATS.slice(1) as FormatOption<Format>[]),
];

const PRESETS: { name: string; colors: string[] }[] = [
  { name: "Ion", colors: ["#5CB4FF", "#EDF1F7"] },
  { name: "Sunset", colors: ["#FF5F6D", "#FFC371"] },
  { name: "Ocean", colors: ["#00C6FF", "#0072FF"] },
  { name: "Mint", colors: ["#A8FF78", "#78FFD6"] },
  { name: "Candy", colors: ["#FF5FA2", "#A06BFF"] },
  { name: "Ember", colors: ["#FF3D3D", "#FFAA00", "#FFFF55"] },
  {
    name: "Rainbow",
    colors: ["#FF5555", "#FFAA00", "#FFFF55", "#55FF55", "#55FFFF", "#5555FF", "#FF55FF"],
  },
];

const DECORATIONS: { id: Decoration; label: string; key: string }[] = [
  { id: "bold", label: "Bold", key: "b" },
  { id: "italic", label: "Italic", key: "i" },
  { id: "underlined", label: "Underline", key: "u" },
  { id: "strikethrough", label: "Strike", key: "s" },
  { id: "obfuscated", label: "Obfuscated", key: "o" },
];

interface State {
  text: string;
  colors: string[];
  decorations: Decoration[];
  interpolation: Interpolation;
  skipSpaces: boolean;
  format: Format;
}

const DEFAULTS: State = {
  text: "Xena Tools",
  colors: ["#5CB4FF", "#FF55FF"],
  decorations: ["bold"],
  interpolation: "oklab",
  skipSpaces: false,
  format: "minimessage",
};

const codec = {
  decode(p: URLSearchParams, d: State): State {
    const colors = (p.get("c") ?? "")
      .split("-")
      .map((c) => parseColor(c))
      .filter((c): c is string => !!c)
      .slice(0, 10);
    const fmt = p.get("f");
    const decoKeys = p.get("d");
    return {
      text: p.get("t") ?? d.text,
      colors: colors.length >= 2 ? colors : d.colors,
      decorations:
        decoKeys === null
          ? d.decorations
          : DECORATIONS.filter((x) => decoKeys.includes(x.key)).map((x) => x.id),
      interpolation:
        p.get("i") === "rgb" ? "rgb" : p.get("i") === "oklab" ? "oklab" : d.interpolation,
      skipSpaces: flag(p, "s", d.skipSpaces),
      format: fmt === "minimessage-tag" || isOutputFormat(fmt) ? fmt : d.format,
    };
  },
  encode(v: State): URLSearchParams {
    return new URLSearchParams({
      t: v.text,
      c: v.colors.map((c) => c.slice(1)).join("-"),
      d: DECORATIONS.filter((x) => v.decorations.includes(x.id))
        .map((x) => x.key)
        .join(""),
      i: v.interpolation,
      s: v.skipSpaces ? "1" : "0",
      f: v.format,
    });
  },
};

function gradientTag(state: State): string {
  const colors = state.colors.map((c) => namedByHex(c)?.name ?? c).join(":");
  const escaped = state.text.replace(/\\/g, "\\\\").replace(/</g, "\\<");
  const open = state.decorations.map((d) => `<${d}>`).join("");
  return `${open}<gradient:${colors}>${escaped}</gradient>`;
}

function GradientTool() {
  const { value: state, update, reset } = useUrlState(DEFAULTS, codec);

  const spans = useMemo(() => {
    const style = Object.fromEntries(state.decorations.map((d) => [d, true]));
    return gradient(state.text, state.colors, {
      interpolation: state.interpolation,
      skipSpaces: state.skipSpaces,
      style,
    });
  }, [state.text, state.colors, state.decorations, state.interpolation, state.skipSpaces]);

  const output =
    state.format === "minimessage-tag" ? gradientTag(state) : serialize(spans, state.format);
  const formatInfo = FORMATS.find((f) => f.id === state.format);
  const tagNote =
    state.format === "minimessage-tag" && state.interpolation === "oklab"
      ? "MiniMessage draws its own gradient in RGB, so it looks a little different from the preview. Choose Linear RGB to match it exactly."
      : undefined;
  const legacyNote =
    state.format.startsWith("legacy") && isLossyForLegacy(spans)
      ? "Hover and click can't be written as codes."
      : undefined;

  const setColor = (i: number, hex: string) => {
    const parsed = parseColor(hex);
    if (!parsed) return;
    update({ colors: state.colors.map((c, j) => (j === i ? parsed : c)) });
  };

  return (
    <ToolPage tool={tool} guide={<Guide />}>
      <McText spans={spans} className="mb-6 py-4 text-2xl sm:text-3xl" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <label className="block">
            <span className="label mb-2 block">Text</span>
            <input
              className="field font-mc text-lg"
              value={state.text}
              maxLength={256}
              onChange={(e) => update({ text: e.target.value })}
              spellCheck={false}
            />
          </label>

          <fieldset>
            <legend className="label mb-2">Colours</legend>
            <ol className="flex flex-col gap-2">
              {state.colors.map((color, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: stops are identified by position
                <li key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color.toLowerCase()}
                    onChange={(e) => setColor(i, e.target.value)}
                    aria-label={`Colour ${i + 1}`}
                    className="h-9 w-12 cursor-pointer rounded-md border border-rule bg-raised p-1"
                  />
                  <input
                    key={color}
                    className="field w-32 uppercase"
                    defaultValue={color}
                    aria-label={`Colour ${i + 1} hex`}
                    onBlur={(e) => setColor(i, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setColor(i, e.currentTarget.value)}
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="btn"
                    disabled={state.colors.length <= 2}
                    onClick={() => update({ colors: state.colors.filter((_, j) => j !== i) })}
                    aria-label={`Remove colour ${i + 1}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn"
                disabled={state.colors.length >= 10}
                onClick={() =>
                  update({ colors: [...state.colors, state.colors.at(-1) ?? "#FFFFFF"] })
                }
              >
                Add colour
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => update({ colors: [...state.colors].reverse() })}
              >
                Reverse
              </button>
              <button type="button" className="btn" onClick={reset}>
                Start over
              </button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="label mb-2">Presets</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  className="btn"
                  onClick={() => update({ colors: p.colors })}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label mb-2">Style</legend>
            <div className="flex flex-wrap gap-2">
              {DECORATIONS.map((d) => (
                <Toggle
                  key={d.id}
                  checked={state.decorations.includes(d.id)}
                  onChange={(on) =>
                    update({
                      decorations: on
                        ? [...state.decorations, d.id]
                        : state.decorations.filter((x) => x !== d.id),
                    })
                  }
                >
                  {d.label}
                </Toggle>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label mb-2">Blending</legend>
            <div className="flex flex-wrap gap-2">
              <Toggle
                checked={state.interpolation === "oklab"}
                onChange={() => update({ interpolation: "oklab" })}
              >
                Even (OKLab)
              </Toggle>
              <Toggle
                checked={state.interpolation === "rgb"}
                onChange={() => update({ interpolation: "rgb" })}
              >
                Linear RGB
              </Toggle>
              <Toggle checked={state.skipSpaces} onChange={(v) => update({ skipSpaces: v })}>
                Skip spaces
              </Toggle>
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-4">
          <FormatPicker
            options={FORMATS}
            value={state.format}
            onChange={(format) => update({ format })}
          />
          <Output
            label={formatInfo?.label ?? "Output"}
            hint={formatInfo?.usedBy}
            value={output}
            warning={tagNote ?? legacyNote}
          />
          <p className="text-xs text-muted">
            {output.length} characters. Players can type 256 in chat; configs have no limit.
          </p>
        </div>
      </div>
    </ToolPage>
  );
}

function Guide() {
  return (
    <>
      <h2>Which format do I need?</h2>
      <ul>
        <li>
          <strong>MiniMessage</strong> for Paper, Velocity and plugins that say they support it
          (most new ones do). The <code>&lt;gradient&gt;</code> tag is shorter and easier to edit
          later.
        </li>
        <li>
          <strong>&amp;#RRGGBB</strong> for EssentialsX, CMI, LuckPerms prefixes shown through a
          chat plugin, and most plugins that ask for "hex colours".
        </li>
        <li>
          <strong>&amp;x&amp;R&amp;R…</strong> for Spigot and BungeeCord, and anywhere that only
          reads what the server understands natively.
        </li>
        <li>
          <strong>& codes (16 colours)</strong> for servers before 1.16, which can't show hex
          colours. Each colour becomes the closest of the 16.
        </li>
        <li>
          <strong>JSON</strong> for <code>/tellraw</code>, <code>/title</code>, signs and books.
          Servers before 1.21.5 need the older JSON.
        </li>
      </ul>
      <h2>Tips</h2>
      <ul>
        <li>
          Use two or three colours that are close in brightness: the text stays readable on any
          background.
        </li>
        <li>
          "Even" blending keeps the middle of the gradient from going muddy. "Linear RGB" matches
          what MiniMessage's own <code>&lt;gradient&gt;</code> tag draws.
        </li>
        <li>
          The link in your address bar saves everything here. Bookmark it or send it to your team.
        </li>
      </ul>
    </>
  );
}
