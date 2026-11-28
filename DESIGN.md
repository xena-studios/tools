---
name: Tools
description: tools.xenastudios.co, the Xena Studios tools. The studio's own design system (Ion Blue on deep space, JetBrains Mono, hairlines, one planet horizon) around a true-to-game Minecraft preview.
colors:
  void: "#06080D"
  space: "#0A0E16"
  surface: "#121824"
  line: "#222B3B"
  muted: "#8A93A6"
  text: "#EDF1F7"
  accent: "#5CB4FF"
  danger: "#FF8A8A"
  warning: "#F2C46D"
typography:
  display:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(1.75rem, 1.1rem + 3.9vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(1.75rem, 1.3rem + 1.9vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(1.125rem, 1.05rem + 0.4vw, 1.375rem)"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(1.0625rem, 1rem + 0.35vw, 1.25rem)"
    fontWeight: 400
    lineHeight: 1.75
  body:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.14em"
  kicker:
    fontFamily: "JetBrains Mono Variable, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    letterSpacing: "0.18em"
  preview:
    fontFamily: "Monocraft, ui-monospace, monospace"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.25
rounded:
  code: "4px"
  inset: "8px"
  panel: "12px"
  pill: "999px"
spacing:
  s-1: "0.25rem"
  s-2: "0.5rem"
  s-3: "0.75rem"
  s-4: "1rem"
  s-5: "1.5rem"
  s-6: "2rem"
  s-7: "3rem"
  s-8: "clamp(4rem, 3rem + 4vw, 6rem)"
  page: "clamp(1.25rem, 4vw, 3rem)"
components:
  button:
    backgroundColor: "color-mix(in srgb, #0A0E16 70%, transparent)"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.void}"
    rounded: "{rounded.pill}"
    padding: "0 1.5rem"
    height: "2.75rem"
  button-compact:
    backgroundColor: "color-mix(in srgb, #0A0E16 70%, transparent)"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "2.25rem"
  choice-selected:
    backgroundColor: "color-mix(in srgb, #5CB4FF 14%, transparent)"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    padding: "0 1rem"
    height: "2.25rem"
  field:
    backgroundColor: "{colors.space}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "0.55rem 0.9rem"
    height: "2.75rem"
  panel:
    backgroundColor: "{colors.space}"
    rounded: "{rounded.panel}"
    padding: "1rem"
  output-box:
    backgroundColor: "{colors.void}"
    textColor: "{colors.text}"
    rounded: "{rounded.inset}"
    padding: "0.75rem"
  preview-chat:
    backgroundColor: "rgba(0, 0, 0, 0.5)"
    textColor: "#FFFFFF"
    typography: "{typography.preview}"
    padding: "1rem 0.75rem"
  server-list:
    backgroundColor: "#0C0C0C"
    textColor: "#FFFFFF"
    typography: "{typography.preview}"
    rounded: "{rounded.panel}"
    padding: "1rem"
  range:
    backgroundColor: "{colors.line}"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    height: "2.75rem"
---

# Design System: Tools

## Overview

**Creative North Star: "The Studio Instrument"**

Tools is the Xena Studios tools site, and it has no identity of its own: it joins the studio's design system exactly as Brand (brand.xenastudios.co) does, with the same tokens, type, hairlines and planet horizon as xenastudios.co. Every colour and logo comes from [xena-studios/brand](https://github.com/xena-studios/brand), synced into `apps/web/src/brand/` with `pnpm brand:sync`; `apps/web/src/styles.css` only aliases those tokens and adds scale. The chrome is calm enough to disappear. The only thing on the page that looks like the game is the preview, drawn by the game's own rules.

Each tool is one working bench: a compact header, the preview at full width, then the controls and the output side by side, with the copy button in the first screen. The home page is the studio's page hero (kicker, title, lead, a primary pill, the rising horizon) followed by hairline rows: the tools, how they work, and what's next. Density is moderate and even; the space between sections does the grouping, not boxes.

It reads like an engineer wrote it: plain words, real format and plugin names, and a straight note wherever the preview is only close.

**Key Characteristics:**

- Deep-space neutrals with Ion Blue as the only accent.
- One family, JetBrains Mono, for all chrome; Monocraft only for game text.
- Hairline rows and 12px panels, never card grids.
- 999px pills for every control.
- The planet horizon is the one picture, and the home hero is the one authored entrance.
- Every tool's settings live in the link.

## Colors

Restrained: tinted deep-space neutrals carry the page, and Ion Blue appears on well under a tenth of any screen. The tokens are the brand's `--xena-*` custom properties, aliased as `--bg`, `--raised`, `--surface`, `--rule`, `--muted`, `--text` and `--accent`, and exposed to Tailwind as `bg`, `raised`, `surface`, `rule`, `muted`, `text` and `accent`.

### Primary

- **Ion Blue** (`accent`): the primary action pill (solid, with void text), selected pills (edge and 14% tint), focus rings, text selection at 35%, the caret, the guide's list dashes and the horizon's rim. Nothing decorative. 9.0:1 on void.

### Neutral

- **Void** (`void`): the page ground, the inside of output boxes, the primary pill's text, and the browser `theme-color`.
- **Space** (`space`): raised surfaces: panels, fields, the command palette, and the pill fill at 70%.
- **Surface** (`surface`): the one step above space: inline code in the guides and the palette's highlighted row.
- **Line** (`line`): every hairline: borders, row dividers, the header's rule, and the scrollbar thumb.
- **Muted** (`muted`): leads, summaries, labels, hints and placeholders. 6.5:1 on void, 5.8:1 on surface.
- **Text** (`text`): headings, body and output. 17.7:1 on void.

### State

- **Danger** (`danger`): a colour the studio's palette doesn't have, added by this site for errors only: an invalid field's border, the error line under it, and the Log Analyzer's errors. 8.8:1 on void.
- **Warning** (`warning`): amber, the second state colour, for warnings only: the Log Analyzer's warnings and a WARN line's mark in its log viewer. 12.3:1 on void. Never an accent, never decoration.

### Named Rules

**The Brand Repo Rule.** Every site colour is a brand token, synced with `pnpm brand:sync` and never retyped. Danger and warning, the two state colours, are the only additions.

**The One Accent Rule.** Ion Blue is the only accent. Selected, focused, primary and current all use it; nothing else gets a colour.

**The Words First Rule.** Danger and warning are always paired with words saying what's wrong, and with a drawn shape where there's a severity (an octagon for an error, a triangle for a warning, a circle for a note); colour never carries meaning alone.

**The sRGB Tint Rule.** Translucent colours mix in sRGB (`color-mix(in srgb, X, transparent)`); oklch mixing with `transparent` drifts the hue. Mixing two solid colours (a hover border warming toward Ion Blue) may use oklch.

**The Game Colours Stay In The Game Rule.** Minecraft's colours, gradient presets and the colour swatches appear only inside previews and the controls that set them, never as site colours.

## Typography

**Display Font:** JetBrains Mono Variable (with ui-monospace, SFMono-Regular, Menlo, monospace), self-hosted through Fontsource
**Body Font:** the same
**Preview Font:** Monocraft (OFL), self-hosted at 400 and 700, for Minecraft text only

**Character:** One monospaced family with size and weight doing the hierarchy, as on every studio site: exact, technical and quiet. Monocraft is the game's look, kept inside the preview and the inputs whose content becomes game text.

### Hierarchy

- **Display** (600, `clamp(1.75rem, 1.1rem + 3.9vw, 4.5rem)`, 1.05): the home page's h1 only, capped at 20ch.
- **Headline** (600, `clamp(1.75rem, 1.3rem + 1.9vw, 2.75rem)`, 1.12): home section titles, the 404 title, and a tool page's h1 (`--t-tool`, deliberately a step below the home page's, because on a tool the task comes first).
- **Title** (600, `clamp(1.125rem, 1.05rem + 0.4vw, 1.375rem)`): tool names in the list rows and the guide's headings.
- **Lead** (400, `clamp(1.0625rem, 1rem + 0.35vw, 1.25rem)`, 1.75, muted): the sentence under each h1, capped at 64ch.
- **Body** (400, 1rem, 1.7): everything else; prose capped at 64ch. Ligatures are off.
- **Label** (400, 0.75rem, +0.14em, uppercase, muted): metadata and control names: fieldset legends ("Format", "Colours"), the "Tools" name in the header, a tool's category in its list row, the palette's group names and the copyright.
- **Kicker** (400, 0.75rem, +0.18em, uppercase, muted): the brand's `//` kicker over each page's h1.

Headings use -0.03em tracking and `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

### Named Rules

**The One Kicker Rule.** The brand's `//` kicker (`// TOOLS`, `// TEXT`, `// 404`) sits over each page's h1 and nowhere else, as on xenastudios.co. Nothing else is an eyebrow over a heading.

**The Monocraft Rule.** Monocraft is for game text only: the preview, and an input whose content becomes game text (the gradient tool's text field). It's monospaced and the game's font isn't, so widths are close, not exact, and the guides say so.

**The Logo Is Artwork Rule.** The wordmark is the brand's SVG, inlined in `currentColor` and cropped to its ink. Its typeface is never set as live text.

## Layout

One centred column, `--max` 76rem wide plus fluid page gutters (`--page`, `clamp(1.25rem, 4vw, 3rem)`), on a 4pt spacing scale that turns fluid at the top step (`--s-8`, `clamp(4rem, 3rem + 4vw, 6rem)`) for section padding.

- **Header:** sticky, 64px, a hairline below and a blurred void at 80%. XENA STUDIOS, a hairline, then the `Tools` label (hidden under 30rem); the "Find a tool" search pill with its ⌘K / Ctrl K hint; GitHub from md up.
- **Home:** the page hero with the horizon rising at its bottom edge, then sections separated by hairlines, each a headline and a list of hairline rows (`14rem / 1fr / auto` from sm up, stacked below).
- **Tool page** (`ToolPage`): kicker, h1 and lead in a compact header; the preview at full width; then controls left and output right in two equal columns from lg up, with the output column sticky at 6rem from the top. Below lg it stacks, controls first.
- **Guide:** under the tool, a hairline, then "How to use it" prose at 64ch.
- **Closing horizon:** every tool page ends with a static horizon (`clamp(5rem, 22vw, 17rem)` tall) below the work, so it never pushes the output down.
- **Footer:** a hairline, the XENA mark linking to xenastudios.co, the copyright, the AGPL-3.0 licence, Mojang's required disclaimer, and the footer links.

### Named Rules

**The Output First Rule.** At 1440×900 the preview, the controls and the copy button are in the first screen. On a phone, while the output panel is off screen, a fixed bar at the bottom keeps its copy button in reach.

**The Rows Not Cards Rule.** Lists are hairline rows that tint to space at 60% on hover. No card grids.

## Elevation & Depth

Flat by default. Depth is tonal (void ground, space panels, surface for the one step above) and hairlines separate everything. Two surfaces float over the page, and both use a blurred translucent void rather than a shadow: the sticky header and the phone copy bar. The ⌘K palette is the only element with a cast shadow, because it is a modal dialog over a dimmed page (void at 75%).

### Shadow Vocabulary

- **Dialog** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)`): the command palette only.
- **Field focus** (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent)`): a soft Ion Blue ring round a focused field, with its border turning Ion Blue.
- **Game shadow** (`text-shadow: 0.125em 0.125em 0 <quarter of the colour>`): inside previews only, the game's drop shadow at a quarter of each span's colour (`shadowOf` in `@xena-tools/mc-text`).

### Named Rules

**The Glass Bar Rule.** Anything pinned over content (header, copy bar) is void at 80–90% with a backdrop blur and a hairline edge, never a shadow.

## Shapes

Soft rectangles and full pills. Panels, fields, the palette and the colour swatch use the 12px radius; boxes nested inside them (the output's text, palette rows) step down to 8px so the corners stay concentric; inline code is 4px. Every button, toggle, radio choice, the search pill and its key hint are 999px pills. Borders are always 1px hairlines in `line`. The one curve that isn't a box is the planet horizon, masked so its body fades into the page and never shows a hard edge.

## Components

### Buttons

Pills, quiet until touched.

- **Shape:** full pill (999px), 44px tall.
- **Primary:** solid Ion Blue, void text, 600 weight; on hover it lifts 12% toward white. One per view: "Find a tool" on home, Copy on a tool.
- **Default:** space at 70% with a hairline and text colour; on hover the hairline warms toward Ion Blue (55%). Press moves it down 1px. Disabled is 45% opacity with no hover.
- **Compact:** 36px tall with 1rem padding, for dense rows of choices inside a tool.
- **Transitions:** 200ms on the expo-out curve.

### Chips (choice pills)

- **Style:** a compact pill wrapping a real, visually hidden radio button or checkbox (`FormatPicker`, `Toggle`), so keyboard and screen readers work natively. Each format's "used by" note is its title.
- **State:** selected is an Ion Blue edge and a 14% Ion Blue tint, with the text kept in the text colour. Focus draws the 2px Ion Blue ring round the whole pill.

### Cards / Containers

- **Corner Style:** 12px.
- **Background:** space.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** a 1px hairline.
- **Internal Padding:** 1rem.

### Inputs / Fields

- **Style:** space fill, hairline border, 12px radius, 44px minimum height, Ion Blue caret, muted placeholder.
- **Focus:** the border turns Ion Blue with a 3px Ion Blue ring at 22%, in place of the outline.
- **Hover:** the hairline warms 35% toward Ion Blue.
- **Error:** the border turns danger (`aria-invalid`), and a `role="alert"` line in danger says what's wrong.

### Navigation

- **Header:** XENA STUDIOS | TOOLS on the left; the search pill (muted text, hairline, warming to Ion Blue and text colour on hover) and GitHub on the right.
- **Command palette (⌘K / Ctrl K):** a 36rem dialog at 12vh, space fill, hairline, 12px radius. A borderless search input over grouped results; group names are labels, rows are a name and a one-line muted summary, and the highlighted row is surface. It finds live tools by name and keyword.
- **Links:** text colour, underlined at 0.25em offset in a 35% tint that goes solid on hover. Outbound links carry the External arrow; links deeper into the site carry the `.more` chevron.
- **Skip link:** the first focusable element, shown as an Ion Blue box with void text.

### Output

The result and its copy button. A panel with the format's name (small, 600) and where it's used (muted), the Copy pill on the right, then the result in mono on void in an 8px box (select-all, scrolls past 12rem). A note for anything the format can't hold goes under it in muted text. Copy says "Copied" for 1.6s.

### McText (signature)

Draws spans the way the game does, in Monocraft at 1.25 line height, with `pre-wrap` and ligatures off.

- Each span's colour, with the game's drop shadow at a quarter of that colour.
- Bold (Monocraft 700), italic, and underline and strikethrough at 0.125em thick.
- Obfuscated text churns every 60ms after hydration; reduced motion freezes it on one scramble.
- Hover text appears on hover in the game's tooltip (a `#100010` box at 95% with a 2px `#25015B` border and 3px corners); click actions show in the title.
- Backgrounds: chat's translucent black (default), a plain dark stand-in for the menu backdrop (`#2B2118`, no textures), or none.
- Uncoloured text falls back to white, as in chat; a tool drawing the server list passes the game's grey instead.

### ServerList

`components/ServerList.tsx`: one entry of the game's multiplayer screen, used by the MOTD Generator and Server Icon, and meant for Server Status. Everything in it is drawn by us: no game textures, sprites or font.

- **Grid:** laid out in game pixels (`--gp`), as the game lays out the row: 305 wide, a 32-pixel icon, a 3-pixel gap, then 267 pixels for the name and the MOTD. A game pixel is 2px where there's room and shrinks with the container (`100cqw / 306`) on a phone, so the proportions hold at any width.
- **Icon:** 64×64 on screen at 2×, `image-rendering: pixelated`. With no icon it draws a placeholder: a dark square with a hairline and a small landscape.
- **Name:** white, with the game's shadow.
- **MOTD:** McText's line renderer in Monocraft at 9 game pixels to the em (Monocraft's own grid: 9 to the em, 6 to an advance), line height 9. It wraps in the 267-pixel box and clips after two lines, as the game does. Uncoloured text is the list's grey, `#808080`, a step darker than chat's.
- **Player count:** top right, the numbers in gray (`#AAAAAA`) and the slash in dark grey (`#555555`), as the game draws them.
- **Signal:** five green bars, our own SVG, 10×8 game pixels.
- **Backdrop:** a plain near-black (`#0C0C0C`) panel, 12px radius. No menu texture.
- **Honesty:** Monocraft is monospaced and the game's font isn't, so widths and wrap points are close, not exact; the guides say so.

### Range slider

`.range`: a 4px hairline track in `line`, filled in Ion Blue up to the thumb (`--fill`, set by the page), and a text-coloured round thumb with a 2px Ion Blue edge. Focus draws the soft Ion Blue ring round the thumb. It's a native `input type="range"`, so arrow keys, Page Up/Down and Home/End work.

### Swatches and the crop

- **Swatch** (`.swatch`): a 36px round pill filled with a game colour inside a hairline, for inserting that colour. The colour is the control's subject, which is the one place game colours may sit outside a preview.
- **Crop** (`.crop-view`): a square window on an image with a hairline and the 12px radius, dragged to pan (pointer capture, `touch-action: none`) and moved with the arrow keys when focused.

### External and inward links

- **Severity** (`Severity.tsx`): an octagon with a cross (error), a triangle with a bar (warning) and a circle with a bar (note), drawn as SVG in `currentColor` with the same 1.4 stroke, always beside the word.
- **External** (`Brand.tsx`): an icon an outbound arrow drawn as SVG at 0.62em in `currentColor` with a 1.4 stroke, nudging up and right on hover. It wraps the link's last word so it never wraps alone.
- **Inward chevron** (`.more`): drawn in CSS with two 1.4px borders, nudging right on hover of its row.

### Log viewer

`components/LogViewer.tsx`: a log of up to tens of thousands of lines on void in a 12px box, filtered by level (choice pills) and by plugin (a native select styled as a field, with the CSS chevron). Rows are a fixed 24px, mono at 0.75rem, unwrapped, and only those in view (plus 30 either side) are rendered, so the box scrolls sideways and the line-number gutter stays put. An ERROR or WARN entry's first line carries its severity shape in the gutter. A line jumped to from a problem is tinted Ion Blue at 14%.

### Horizon

The brand's `scene/horizon.svg`, inlined with `preserveAspectRatio="xMidYMax slice"` and a bottom mask (solid to 55%, then fading) so the planet body melts into the page. It sits absolutely at the bottom of an isolated section. On home it rises; on tool pages it closes the page, still.

### URL state

Every tool keeps its settings in the query string (`lib/url-state.ts`) with short keys (`t`, `c`, `f`…), written with `replaceState` 250ms after the last change, so there's no history entry per keystroke. Pages are prerendered with the defaults and the URL is read after hydration, so the HTML always matches the first render. Sharing the link shares the result.

### Per-page CSP

`apps/web/scripts/headers.ts` writes `dist/client/_headers` after the build. Each page gets a CSP that allows only its own inline hydration scripts, by SHA-256 hash read from the built HTML, under `default-src 'none'`. Styles allow `'unsafe-inline'` because previews colour every span inline, and a style can't run code. Fonts and images are files (`assetsInlineLimit: 0`), never inlined `data:` fonts.

## Do's and Don'ts

### Do:

- **Do** take every colour, logo and scene from the brand repo (`pnpm brand:sync`); add only `danger` for errors and `warning` for warnings.
- **Do** keep the preview and the copy button in the first screen, and the copy button in reach on a phone.
- **Do** build every control as a pill backed by a real radio button, checkbox or button.
- **Do** name formats by where they're used ("MiniMessage", "&#RRGGBB", "JSON for /tellraw") and say plainly where the preview is only close.
- **Do** keep each tool's settings in its URL, with the prerendered HTML matching the defaults.
- **Do** keep one authored moment per page: the home horizon rises (1.8s, expo out) and the hero copy settles in a 90ms stagger. Hover and focus run 160–200ms on the same curve, and reduced motion collapses all of it.
- **Do** draw previews by the game's rules: colours, the quarter-colour shadow, decorations, obfuscation and hover text.

### Don't:

- **Don't** add a second accent colour, or use game colours for the chrome.
- **Don't** use game textures, the game's own font or Mojang's logos anywhere, or put pixel-art styling on the chrome; the game's look belongs inside previews only.
- **Don't** add stars, particles, glows beyond the horizon, gradient text on the chrome, angled panels or card grids.
- **Don't** put a kicker or eyebrow over anything but a page's h1.
- **Don't** use Monocraft outside previews and game-text inputs.
- **Don't** use Unicode arrows or emoji as icons; the External arrow, the severity shapes and the CSS chevron are the only ones.
- **Don't** animate on scroll or on entry beyond the home hero.
- **Don't** inline scripts the CSP hasn't hashed, or inline fonts as `data:` URLs.
- **Don't** show a tool that isn't built as if it were; planned tools are plain rows under "Next up".
