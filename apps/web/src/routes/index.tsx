import { createFileRoute, Link } from "@tanstack/react-router";
import { Horizon } from "../components/Brand";
import { ShortcutHint, useOpenPalette } from "../components/CommandPalette";
import type { FileRouteTypes } from "../routeTree.gen";
import { CATEGORIES, LIVE_TOOLS, SITE, TOOLS } from "../tools";

const DESCRIPTION =
  "Free tools for Minecraft servers, by Xena Studios: gradient text, MOTDs, start scripts, log analysis, server status, player lookups and server icons, with output ready to paste.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE.tagline.replace(/\.$/, "")}: ${SITE.name}` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: SITE.name },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: `${SITE.url}/` },
    ],
    links: [{ rel: "canonical", href: `${SITE.url}/` }],
  }),
  component: Home,
});

const GROUPS = CATEGORIES.map((category) => ({
  category,
  tools: LIVE_TOOLS.filter((t) => t.category === category),
})).filter((g) => g.tools.length > 0);

const PROMISES = [
  {
    title: "In your browser",
    text: "Text, scripts, logs and images are worked on in your browser and never uploaded. Server Status and Player Lookup have to ask a server or Mojang, so they go through ours (Bedrock checks through mcstatus.io), and each page says what it sends where.",
  },
  {
    title: "The link keeps your settings",
    text: "Tools write your settings into the address bar. Bookmark it, or send it to your team and they'll see what you see. Logs and images stay out of the link.",
  },
  {
    title: "Ready to paste",
    text: "Output comes in the format your server or plugin reads, named by where it goes: MiniMessage for Paper, &#RRGGBB for Essentials, JSON for /tellraw.",
  },
];

function Home() {
  const openPalette = useOpenPalette();
  const planned = TOOLS.filter((t) => t.status === "planned");

  return (
    <main id="main">
      <section aria-labelledby="page-title" className="relative isolate overflow-hidden">
        <div className="hero-copy wrap pt-[var(--s-8)] pb-[clamp(9rem,20vw,15rem)]">
          <p className="kicker mb-6">{"// Tools"}</p>
          <h1 id="page-title" className="max-w-[20ch] text-[length:var(--t-h1)] leading-[1.05]">
            {SITE.tagline}
          </h1>
          <p className="lead mt-6">
            Free and open source, from Xena Studios. Gradient text, MOTDs, start scripts, crash
            logs, server status and player lookups: see it the way players will, then copy it
            straight into your server.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="button primary" onClick={openPalette}>
              Find a tool
            </button>
            <Link to="/gradient" className="button">
              Make gradient text
            </Link>
          </div>
        </div>
        <Horizon
          className="hero-rise absolute inset-x-0 bottom-0 -z-10 h-[clamp(9rem,22vw,17rem)] w-full"
          idPrefix="home-horizon"
        />
      </section>

      <section aria-labelledby="tools" className="wrap border-t border-rule py-[var(--s-8)]">
        <h2 id="tools" className="text-[length:var(--t-h2)]">
          Tools
        </h2>
        <p className="mt-4 max-w-[var(--measure)] text-muted">
          Each does one job. Search for one with <ShortcutHint /> from any page.
        </p>
        <div className="mt-10 flex flex-col gap-10">
          {GROUPS.map((g) => (
            <section key={g.category} aria-labelledby={`group-${g.category}`}>
              <h3 id={`group-${g.category}`} className="label mb-3 font-normal">
                {g.category}
              </h3>
              <ul className="border-t border-rule">
                {g.tools.map((tool) => (
                  <li key={tool.slug}>
                    <Link
                      to={`/${tool.slug}` as FileRouteTypes["to"]}
                      className="group grid items-center gap-x-6 gap-y-1 border-b border-rule py-5 text-text no-underline transition-colors duration-200 ease-out-expo hover:bg-raised/60 sm:grid-cols-[14rem_minmax(0,1fr)_auto] sm:px-3"
                    >
                      <strong className="text-[length:var(--t-h3)] font-semibold tracking-[-0.02em]">
                        {tool.name}
                      </strong>
                      <span className="text-muted">{tool.summary}</span>
                      <span className="more hidden text-sm font-medium sm:inline">Open</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section aria-labelledby="how" className="wrap border-t border-rule py-[var(--s-8)]">
        <h2 id="how" className="text-[length:var(--t-h2)]">
          How they work
        </h2>
        <dl className="mt-8 border-t border-rule">
          {PROMISES.map((p) => (
            <div
              key={p.title}
              className="grid gap-x-6 gap-y-1 border-b border-rule py-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:px-3"
            >
              <dt className="font-semibold">{p.title}</dt>
              <dd className="m-0 max-w-[var(--measure)] text-muted">{p.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      {planned.length > 0 && (
        <section aria-labelledby="next" className="wrap border-t border-rule py-[var(--s-8)]">
          <h2 id="next" className="text-[length:var(--t-h2)]">
            Next up
          </h2>
          <p className="mt-4 max-w-[var(--measure)] text-muted">
            Not built yet. Follow along, or help, on{" "}
            <a href={`${SITE.repo}/issues`} className="text-text underline">
              GitHub
            </a>
            .
          </p>
          <ul className="mt-8 border-t border-rule">
            {planned.map((tool) => (
              <li
                key={tool.slug}
                className="grid gap-x-6 gap-y-1 border-b border-rule py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:px-3"
              >
                <span>{tool.name}</span>
                <span className="text-sm text-muted">{tool.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
