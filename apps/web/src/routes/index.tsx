import { createFileRoute, Link } from "@tanstack/react-router";
import { useOpenPalette } from "../components/CommandPalette";
import type { FileRouteTypes } from "../routeTree.gen";
import { CATEGORIES, SITE, TOOLS } from "../tools";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE.url}/` }],
  }),
  component: Home,
});

function Home() {
  const openPalette = useOpenPalette();
  const planned = TOOLS.filter((t) => t.status === "planned");

  return (
    <main className="wrap pt-14 sm:pt-24">
      <section className="max-w-3xl">
        <p className="kicker mb-4">Tools</p>
        <h1 className="mb-5 text-4xl sm:text-6xl">{SITE.tagline}</h1>
        <p className="mb-8 max-w-2xl text-lg text-muted">
          Free, open source and quick. Everything runs in your browser, every tool keeps its
          settings in the link so you can share them, and the output is ready to paste into your
          server.
        </p>
        <button type="button" className="btn btn-primary h-11 px-6" onClick={openPalette}>
          Find a tool
        </button>
      </section>

      {CATEGORIES.map((category) => {
        const live = TOOLS.filter((t) => t.category === category && t.status === "live");
        if (live.length === 0) return null;
        return (
          <section key={category} className="mt-16">
            <h2 className="label mb-2">{category}</h2>
            <ul className="border-t border-rule">
              {live.map((tool) => (
                <li key={tool.slug} className="border-b border-rule">
                  <Link
                    to={`/${tool.slug}` as FileRouteTypes["to"]}
                    className="group grid gap-1 py-5 no-underline sm:grid-cols-[16rem_1fr_auto] sm:items-baseline sm:gap-8"
                  >
                    <span className="font-semibold transition-colors group-hover:text-accent">
                      {tool.name}
                    </span>
                    <span className="text-muted">{tool.summary}</span>
                    <svg
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                      className="hidden size-3 text-muted transition-transform duration-200 ease-out-expo group-hover:translate-x-1 group-hover:text-accent sm:block"
                    >
                      <path
                        d="M4.25 2.5 7.75 6l-3.5 3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      />
                    </svg>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {planned.length > 0 && (
        <section className="mt-16">
          <h2 className="label mb-2">Next up</h2>
          <p className="mb-4 max-w-2xl text-sm text-muted">
            Not built yet. Follow along, or help, on <a href={`${SITE.repo}/issues`}>GitHub</a>.
          </p>
          <ul className="border-t border-rule">
            {planned.map((tool) => (
              <li
                key={tool.slug}
                className="grid gap-1 border-b border-rule py-4 sm:grid-cols-[16rem_1fr] sm:items-baseline sm:gap-8"
              >
                <span className="text-muted">{tool.name}</span>
                <span className="text-sm text-muted/80">{tool.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
