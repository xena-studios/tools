import monoLatin from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url";
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from "@tanstack/react-router";
import { Horizon } from "../components/Brand";
import { CommandPaletteProvider, ShortcutHint, useOpenPalette } from "../components/CommandPalette";
import { Footer, Header } from "../components/Layout";
import appCss from "../styles.css?url";
import { SITE } from "../tools";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#06080D" },
      { property: "og:site_name", content: SITE.name },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${SITE.url}/og.png` },
      { property: "og:image:alt", content: "XENA STUDIOS over a planet horizon." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    // Each page sets its own title, description and canonical (index.tsx, toolHead).
    links: [
      // The latin JetBrains Mono, which every page draws its first screen in: fetched
      // with the stylesheet, not after it, so text doesn't swap fonts as it lands.
      { rel: "preload", href: monoLatin, as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    // Cloudflare Web Analytics: counts visits with no cookies and no personal
    // data. The token is public (it's in every page that uses the beacon); it's
    // tools.xenastudios.co's own Web Analytics site (the zone-wide xenastudios.co
    // site only accepts its automatic injection, which doesn't reach Worker assets).
    scripts: [
      {
        src: "https://static.cloudflareinsights.com/beacon.min.js",
        defer: true,
        "data-cf-beacon": '{"token": "bb2c2a1c6a8b486ea8186b65590500e8"}',
      },
    ],
  }),
  shellComponent: RootDocument,
  component: () => <Outlet />,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-bg focus:no-underline"
        >
          Skip to content
        </a>
        <CommandPaletteProvider>
          <Header />
          <div className="flex flex-1 flex-col">{children}</div>
          <Footer />
        </CommandPaletteProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  const openPalette = useOpenPalette();
  return (
    <>
      <title>{`Page not found: ${SITE.name}`}</title>
      <meta name="robots" content="noindex" />
      <main id="main" className="wrap pt-[var(--s-8)] pb-[var(--s-7)]">
        <p className="kicker mb-6">{"// 404"}</p>
        <h1 className="mb-4 text-[length:var(--t-h2)]">No tool here</h1>
        <p className="lead">
          That page doesn't exist, or it has moved. Press <ShortcutHint /> on any page to find a
          tool by name.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" className="button primary" onClick={openPalette}>
            Find a tool
          </button>
          <Link to="/" className="button">
            All tools
          </Link>
        </div>
      </main>
      <div
        aria-hidden="true"
        className="relative isolate mt-auto h-[clamp(5rem,22vw,17rem)] overflow-hidden"
      >
        <Horizon className="absolute inset-x-0 bottom-0 h-full w-full" idPrefix="404-horizon" />
      </div>
    </>
  );
}
