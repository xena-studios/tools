import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SITE } from "../tools";
import { External, ToolsLogo, XenaLogo } from "./Brand";
import { useOpenPalette } from "./CommandPalette";

function SearchButton() {
  const open = useOpenPalette();
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <button type="button" className="btn gap-3 text-muted" onClick={open}>
      <span>Find a tool</span>
      <kbd className="hidden rounded border border-rule px-1.5 text-xs sm:inline">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-rule/70 bg-bg/80 backdrop-blur-md">
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link to="/" className="no-underline" aria-label="Xena Tools home">
          <ToolsLogo className="block h-7 w-auto" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4" aria-label="Main">
          <SearchButton />
          <a
            href={SITE.repo}
            className="hidden text-sm text-muted no-underline hover:text-text sm:inline"
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
    <footer className="mt-24 border-t border-rule">
      <div className="wrap flex flex-col gap-8 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-3">
          <a
            href="https://xenastudios.co"
            className="text-text no-underline"
            aria-label="Xena Studios"
          >
            <XenaLogo className="h-4 w-auto" />
          </a>
          <p className="label">© {year} Xena Studios</p>
        </div>
        <div className="flex max-w-md flex-col gap-3 text-sm text-muted">
          <p>
            Free and open source under the AGPL-3.0.{" "}
            <a href={SITE.repo}>
              Source on <External>GitHub</External>
            </a>
          </p>
          <p className="text-xs">
            Not an official Minecraft product. Not approved by or associated with Mojang or
            Microsoft.
          </p>
        </div>
      </div>
    </footer>
  );
}
