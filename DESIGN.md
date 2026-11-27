---

name: Xena Tools
description: tools.xenastudios.co. Arc Violet on steel, IBM Plex Sans with JetBrains Mono, Minecraft text only inside previews.
source: xena-studios/brand (synced into apps/web/src/brand/ by scripts/sync-brand.ts)
colors:
arc: "#7052FF"
on-arc: "#F2F3F9"
steel: "#0A0A13"
steel-raised: "#131320"
steel-rule: "#2E2E3F"
text: "#F2F3F9"
muted: "#9FA0B1"
typography:
sans: "IBM Plex Sans (400, 600, 700)"
mono: "JetBrains Mono Variable: kickers, labels, code, output"
preview: "Monocraft (OFL): Minecraft text previews only"
h1: { size: "3rem (1.875rem on phones)", weight: 700, letterSpacing: "-0.02em" }
label: { size: "0.75rem", letterSpacing: "0.14em", transform: uppercase, color: muted, family: mono }
rounded: { panel: "12px", field: "8px", button: "999px" }
motion: { ease: "cubic-bezier(0.16, 1, 0.3, 1)", hover: "160–200ms" }
---

# Design

## 1. Overview

**A precise instrument around a game preview.** The chrome is Xena Tools' brand (Arc Violet on steel, Plex and JetBrains Mono, hairlines), calm enough to disappear. The only game-looking thing on the page is the preview, drawn the way Minecraft draws text. Built on the studio's [design approach](https://github.com/xena-studios/website/blob/main/DESIGN.md): exact type, hairlines, one accent, nothing invented.

Every tool page has the same shape:

1. **Header:** `// CATEGORY` kicker, the tool's name, one sentence on what it does (its registry summary).
2. **Preview:** full width, Minecraft text on the chat box's translucent black.
3. **Inputs left, output right** (stacked on phones, output after inputs): a format picker of pills, then the output in a panel with its copy button.
4. **Guide:** a hairline, then "which format do I need" and tips, capped at 64ch.

## 2. Colour

Tokens are the brand's `--tools-*` properties, aliased in `apps/web/src/styles.css` (`--bg`, `--raised`, `--surface`, `--rule`, `--muted`, `--text`, `--accent`) and exposed to Tailwind as `bg`, `raised`, `surface`, `rule`, `muted`, `text`, `accent`.

- **Arc Violet** marks the primary action, selected pills (border and tint, with text in `text`), focus rings, selection and link underlines. Never small text: arc is 4:1 on steel, below AA for body size.
- **Game colours** appear only inside previews and colour swatches.
- Translucent colours mix in **sRGB** (`color-mix(in srgb, X, transparent)`).

## 3. Typography

- **IBM Plex Sans** for headings (700) and body (400).
- **JetBrains Mono** for the `//` kicker, `.label`s, code, and every output box: anything a machine reads.
- **Monocraft**, an open font in the game's style, for previews and the text inputs whose content becomes game text. It's monospaced and the game's font isn't, so widths are close, not exact; the guides say so.

## 4. Components

- **ToolPage** (`components/ToolPage.tsx`): the header and guide around a tool. `toolHead(slug)` writes its title, description, Open Graph and canonical tags from the registry.
- **McText** (`components/McText.tsx`): draws spans the way the game does: colour, a drop shadow at a quarter of the colour, bold, italic, underline, strikethrough, obfuscated text that churns (stopped by reduced motion), hover text on hover and click actions in a title.
- **FormatPicker / Toggle**: pills backed by real radio buttons and checkboxes, so keyboard and screen readers work.
- **Output**: a panel with the format's name, where it's used, the result in mono (select-all on click) and a copy button.
- **Command palette** (⌘K / Ctrl+K): finds live tools by name and keyword, from `tools.ts`.
- **Footer:** the XENA logo linking to xenastudios.co (the studio's only appearance on the site), the licence, and Mojang's required disclaimer.
- **Icons:** the outbound arrow (`External`) and the list chevron, both drawn SVG. No Unicode arrows or emoji.

## 5. State and URLs

Each tool keeps its settings in the query string (`lib/url-state.ts`): short keys, replaced without adding history entries. Pages are prerendered with defaults; the URL is read after hydration, so the HTML always matches the first render.

## 6. Security headers

`apps/web/scripts/headers.ts` writes `_headers` after the build: per page, a CSP allowing only that page's inline hydration scripts by hash. Styles allow `'unsafe-inline'` because previews colour each span; fonts and images are files (`assetsInlineLimit: 0`), never `data:` fonts.

## 7. Do's and don'ts

**Do:** take colours and logos from the brand repo (`pnpm brand:sync`); keep output visible without scrolling; name formats by where they're used; say plainly when something's approximate.

**Don't:** use game textures, the game's font or Mojang's logos anywhere; put pixel-art styling on the chrome; add a second accent; use arc for body text; animate on scroll; show a tool that isn't built as if it were.
