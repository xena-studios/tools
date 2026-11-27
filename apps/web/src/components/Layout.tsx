// The studio's shell, as on brand.xenastudios.co: XENA STUDIOS and the site's
// name in the header, and the XENA mark, the licence and the links in the footer.

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SITE } from "../tools";
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

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-rule pt-10 pb-12 text-[0.9375rem] text-muted">
      <div className="wrap grid gap-4">
        <p className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a
            href="https://xenastudios.co"
            className="inline-flex text-text"
            aria-label="Xena Studios"
          >
            <Logo name="xena" className="h-[0.9rem] w-auto" />
          </a>
          <span className="label font-medium">© {year} Xena Studios</span>
        </p>
        <p className="max-w-[72ch] text-sm">
          Free and open source under the{" "}
          <a href={`${SITE.repo}/blob/main/LICENSE`} className="underline">
            AGPL-3.0
          </a>
          . Not an official Minecraft product. Not approved by or associated with Mojang or
          Microsoft.
        </p>
        <nav aria-label="Footer">
          <ul className="mt-1 flex flex-wrap gap-x-7 gap-y-1">
            <li>
              <Link to="/" className="no-underline hover:text-text">
                All tools
              </Link>
            </li>
            <li>
              <a href={SITE.repo} className="no-underline hover:text-text">
                <External>Source</External>
              </a>
            </li>
            <li>
              <a href={`${SITE.repo}/issues/new/choose`} className="no-underline hover:text-text">
                <External>Report a problem</External>
              </a>
            </li>
            <li>
              <a href="https://xenastudios.co" className="no-underline hover:text-text">
                <External>xenastudios.co</External>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
