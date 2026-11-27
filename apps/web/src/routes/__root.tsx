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
      { title: `${SITE.name}: ${SITE.tagline}` },
      { name: "description", content: SITE.tagline },
      { name: "theme-color", content: "#0A0A13" },
      { property: "og:site_name", content: SITE.name },
      { property: "og:type", content: "website" },
      { property: "og:image", content: `${SITE.url}/og.png` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
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
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-on-accent"
        >
          Skip to content
        </a>
        <CommandPaletteProvider>
          <Header />
          <div id="content" className="flex-1">
            {children}
          </div>
          <Footer />
        </CommandPaletteProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="wrap pt-16">
      <p className="kicker mb-3">404</p>
      <h1 className="mb-3 text-3xl sm:text-5xl">No tool here</h1>
      <p className="text-muted">
        That page doesn't exist. Press <kbd>⌘K</kbd> to find a tool, or <a href="/">see them all</a>
        .
      </p>
    </main>
  );
}
