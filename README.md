![Xena Tools by Xena Studios. The clamp icon and the Xena Tools wordmark over an Arc Violet planet horizon, with the headline "Server tools. Free and open source." and a list of the tools.](https://cdn.jsdelivr.net/gh/xena-studios/brand@1/github/tools-banner.png)

**Tools for running a Minecraft server.**

Xena Tools is a set of free web tools for people who run Minecraft servers, by [Xena Studios](https://xenastudios.co), at [tools.xenastudios.co](https://tools.xenastudios.co). Every tool runs in your browser, keeps its settings in the link so you can share them, and gives you output that's ready to paste into your server.

> **Status:** in development, not yet live. Gradient Text and Text Converter work; the rest are planned, in [docs/ROADMAP.md](docs/ROADMAP.md).

| Tool                                                          | What it does                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [Gradient Text](https://tools.xenastudios.co/gradient)        | Colours text with a gradient, written as MiniMessage, `&#RRGGBB`, `&x&R&R…`, `{#RRGGBB}`, `<#RRGGBB>`, 16-colour codes or JSON |
| [Text Converter](https://tools.xenastudios.co/text-converter) | Reads legacy codes, MiniMessage or JSON, shows it as players will see it, and converts it to any of the others                 |

## What's here

|                                                  |                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/web/`](apps/web/)                         | The site: [TanStack Start](https://tanstack.com/start) on a Cloudflare Worker. Every page is prerendered and served as a static asset |
| [`packages/mc-text/`](packages/mc-text/)         | Minecraft text: reads and writes legacy codes, MiniMessage and JSON components, gradients and colour maths. No dependencies           |
| [`scripts/sync-brand.ts`](scripts/sync-brand.ts) | Copies the logo, icons and colour tokens from [xena-studios/brand](https://github.com/xena-studios/brand)                             |
| [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) | Who it's for and how it looks                                                                                                         |
| [docs/ROADMAP.md](docs/ROADMAP.md)               | The tools still to come, and how they'll be built                                                                                     |

## Building

Needs Node 24 and pnpm.

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # lint, typecheck, test and build: what CI runs
```

`pnpm --filter web build` builds the site to `apps/web/dist`, prerendering every page and writing `_headers` with a content security policy per page (`apps/web/scripts/headers.ts`). `pnpm exec wrangler dev` in `apps/web` serves the build as Cloudflare will.

To add a tool, add it to [`apps/web/src/tools.ts`](apps/web/src/tools.ts) (the home page, the ⌘K search and the sitemap read from it), then add its page in `apps/web/src/routes/<slug>.tsx` using `ToolPage`. Logic that isn't about the page goes in a package, with tests.

Brand files are copies: change them in xena-studios/brand, then run `pnpm brand:sync` with the brand repo checked out next to this one (or `BRAND_DIR=…`). Never edit `apps/web/src/brand/` by hand.

Pushes to `main` deploy to Cloudflare from GitHub Actions. Running costs are meant to stay at nothing: see [Costs](docs/ROADMAP.md#costs).

## Contributing

Issues and pull requests are welcome. The org's [contributing guide](https://github.com/xena-studios/.github/blob/main/CONTRIBUTING.md) covers how, and the [security policy](https://github.com/xena-studios/.github/blob/main/SECURITY.md) covers reporting a vulnerability. Commits follow [Conventional Commits](https://www.conventionalcommits.org).

## Licence

[AGPL-3.0](LICENSE). If you run a changed copy of the site for other people, you have to share its source. The Xena Tools and Xena Studios logos are the [brand's](https://github.com/xena-studios/brand/blob/main/LICENSE), not covered by the AGPL. The preview font is [Monocraft](https://github.com/IdreesInc/Monocraft), under the [SIL Open Font License](apps/web/src/fonts/Monocraft-OFL.txt).

Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
