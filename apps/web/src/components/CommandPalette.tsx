// ⌘K / Ctrl+K: jump to any tool by name or by what it's for.

import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CATEGORIES, LIVE_TOOLS } from "../tools";

/** ⌘K on Apple devices, Ctrl K everywhere else. Renders ⌘K until hydrated. */
export function ShortcutHint({ className = "" }: { className?: string }) {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return <kbd className={`text-text ${className}`}>{mac ? "⌘K" : "Ctrl K"}</kbd>;
}

const PaletteContext = createContext<() => void>(() => {});
export const useOpenPalette = () => useContext(PaletteContext);

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback(
    (slug: string) => {
      setOpen(false);
      void navigate({ to: `/${slug}` });
    },
    [navigate],
  );

  const groups = useMemo(
    () =>
      CATEGORIES.map((c) => ({
        category: c,
        tools: LIVE_TOOLS.filter((t) => t.category === c),
      })).filter((g) => g.tools.length > 0),
    [],
  );

  return (
    <PaletteContext.Provider value={() => setOpen(true)}>
      {children}
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Find a tool"
        overlayClassName="fixed inset-0 z-40 bg-bg/75"
        contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-box border border-rule bg-raised shadow-2xl"
      >
        <Command.Input
          placeholder="Find a tool…"
          className="w-full border-b border-rule bg-transparent px-4 py-3.5 outline-none placeholder:text-muted"
        />
        <Command.List className="max-h-[50vh] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
            No tool matches that yet.
          </Command.Empty>
          {groups.map((g) => (
            <Command.Group key={g.category} heading={g.category} className="palette-group">
              {g.tools.map((t) => (
                <Command.Item
                  key={t.slug}
                  value={`${t.name} ${t.keywords.join(" ")}`}
                  onSelect={() => go(t.slug)}
                  className="cursor-pointer rounded-lg px-3 py-2 data-[selected=true]:bg-surface"
                >
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="line-clamp-1 text-xs text-muted">{t.summary}</div>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command.Dialog>
    </PaletteContext.Provider>
  );
}
