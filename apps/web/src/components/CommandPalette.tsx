// ⌘K / Ctrl+K: jump to any tool by name or by what it's for.

import { createContext, lazy, Suspense, useContext, useEffect, useState } from "react";

const loadDialog = () => import("./PaletteDialog");
const PaletteDialog = lazy(loadDialog);

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
  // Mounted from the first open on, so closing keeps it (and its animation) in place.
  const [used, setUsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setUsed(true);
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    // Fetch the dialog once the page is idle, so the first ⌘K opens at once.
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void loadDialog(), { timeout: 4000 })
      : window.setTimeout(() => void loadDialog(), 2000);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  const openPalette = () => {
    setUsed(true);
    setOpen(true);
  };

  return (
    <PaletteContext.Provider value={openPalette}>
      {children}
      {used && (
        <Suspense fallback={null}>
          <PaletteDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </PaletteContext.Provider>
  );
}
