import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { CommandPaletteProvider } from "../components/CommandPalette";
import { Footer, Header } from "../components/Layout";
import appCss from "../styles.css?url";
import { SITE } from "../tools";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SITE.name },
      { name: "description", content: SITE.tagline },
      { name: "theme-color", content: "#06080D" },
      { property: "og:site_name", content: SITE.name },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${SITE.url}/og.png` },
      { property: "og:image:alt", content: "XENA STUDIOS over a planet horizon." },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
    // Cloudflare Web Analytics: counts visits with no cookies and no personal
    // data. The token is public (it's in every page that uses the beacon); it's
    // the xenastudios.co site, which reports each subdomain by host.
    scripts: [
      {
        src: "https://static.cloudflareinsights.com/beacon.min.js",
        defer: true,
        "data-cf-beacon": '{"token": "1b6818b82f294d5aa6c76d35768d8098"}',
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
  return (
    <main id="main" className="wrap pt-[var(--s-8)]">
      <p className="kicker mb-6">{"// 404"}</p>
      <h1 className="mb-4 text-[length:var(--t-h2)]">No tool here</h1>
      <p className="text-muted">
        That page doesn't exist. Press <kbd>⌘K</kbd> to find a tool, or <a href="/">see them all</a>
        .
      </p>
    </main>
  );
}
