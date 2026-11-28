// The studio's shell: XENA STUDIOS and the site's name in the header, as on
// brand.xenastudios.co, and xenastudios.co's footer.

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { FileRouteTypes } from "../routeTree.gen";
import { type Category, LIVE_TOOLS, SITE } from "../tools";
import { External, Logo } from "./Brand";
import { useOpenPalette } from "./CommandPalette";

function SearchButton() {
  const open = useOpenPalette();
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button
      type="button"
      onClick={open}
      aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
      className="inline-flex min-h-9 shrink-0 items-center gap-3 rounded-full whitespace-nowrap border border-rule bg-raised/70 py-1 pr-2 pl-4 text-sm text-muted transition-colors duration-200 ease-out-expo hover:border-accent/55 hover:text-text max-sm:pr-4"
    >
      Find a tool
      <kbd className="hidden rounded-full border border-rule px-2 text-xs leading-5 sm:inline">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-rule/70 bg-bg/80 backdrop-blur-md backdrop-saturate-150">
      <div className="wrap flex min-h-16 items-center justify-between gap-6">
        <Link
          to="/"
          className="flex items-center gap-3 py-3 text-text no-underline"
          aria-label="Xena Studios tools, home"
        >
          <Logo className="h-[0.8125rem] w-auto max-[26rem]:h-[0.6875rem]" />
          <span className="label border-l border-rule pl-3 leading-none max-[30rem]:hidden">
            Tools
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 sm:gap-6">
          <SearchButton />
          <a
            href={SITE.repo}
            className="hidden text-sm whitespace-nowrap text-muted no-underline hover:text-text md:inline"
          >
            <External>GitHub</External>
          </a>
        </nav>
      </div>
    </header>
  );
}

/** Footer columns: the tools by kind, then the studio, as xenastudios.co's columns are. */
const FOOT_COLUMNS: { title: string; categories: Category[] }[] = [
  { title: "Text", categories: ["Text"] },
  { title: "Server", categories: ["Server", "Branding"] },
  { title: "Lookup", categories: ["Lookup"] },
];

const footLink = "text-muted no-underline transition-colors duration-150 hover:text-text";

/**
 * The studio's footer, as on xenastudios.co: a line on what this is, the link
 * columns, then the row every Xena site ends with (the XENA mark, the copyright
 * and its one note).
 */
export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-rule pt-12">
      <div className="wrap grid items-start gap-8 pb-12 md:grid-cols-[minmax(0,1fr)_auto]">
        <p className="max-w-[34ch] text-sm text-muted">
          Free web tools for running a Minecraft server. Open source under the{" "}
          <a
            href={`${SITE.repo}/blob/main/LICENSE`}
            className="text-muted underline hover:text-text"
          >
            AGPL-3.0
          </a>
          ; visits are counted with Cloudflare Web Analytics, which uses no cookies.
        </p>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-8 sm:grid-cols-4 md:grid-cols-[repeat(4,minmax(8rem,auto))]"
        >
          {FOOT_COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="label mb-3 font-normal tracking-[0.14em]">{col.title}</h2>
              <ul className="grid gap-2 text-sm">
                {LIVE_TOOLS.filter((t) => col.categories.includes(t.category)).map((t) => (
                  <li key={t.slug}>
                    <Link to={`/${t.slug}` as FileRouteTypes["to"]} className={footLink}>
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h2 className="label mb-3 font-normal tracking-[0.14em]">Studio</h2>
            <ul className="grid gap-2 text-sm">
              <li>
                <a href="https://xenastudios.co" className={footLink}>
                  <External>xenastudios.co</External>
                </a>
              </li>
              <li>
                <a href="https://brand.xenastudios.co" className={footLink}>
                  <External>Brand</External>
                </a>
              </li>
              <li>
                <a href={SITE.repo} className={footLink}>
                  <External>Source</External>
                </a>
              </li>
              <li>
                <a href={`${SITE.repo}/issues/new/choose`} className={footLink}>
                  <External>Report a problem</External>
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="wrap flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-rule py-6 text-[0.8125rem] text-muted">
        <p className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <a
            href="https://xenastudios.co"
            aria-label="Xena Studios"
            className="block text-text transition-colors duration-150 hover:text-accent"
          >
            <Logo name="xena" className="block h-3 w-auto" />
          </a>
          <span className="label">© {year} Xena Studios</span>
        </p>
        <p>
          Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
        </p>
      </div>
    </footer>
  );
}
