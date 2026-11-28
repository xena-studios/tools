// The ⌘K dialog itself, with cmdk. Loaded the first time the palette opens (or
// when the browser is idle), so cmdk isn't on any page's critical path.

import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import { CATEGORIES, LIVE_TOOLS } from "../tools";

const GROUPS = CATEGORIES.map((c) => ({
  category: c,
  tools: LIVE_TOOLS.filter((t) => t.category === c),
})).filter((g) => g.tools.length > 0);

/**
 * Every word typed must appear in the tool's name, keywords or summary. A match in
 * the name ranks first, so "uuid" finds Player Lookup, not a fuzzy hit elsewhere.
 */
function filter(value: string, search: string, keywords: string[] = []): number {
  const name = value.toLowerCase();
  const rest = keywords.join(" ").toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.every((w) => name.includes(w) || rest.includes(w))) return 0;
  if (name.startsWith(words[0] ?? "")) return 1;
  return words.every((w) => name.includes(w)) ? 0.8 : 0.5;
}

export default function PaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const go = (slug: string) => {
    onOpenChange(false);
    void navigate({ to: `/${slug}` });
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Find a tool"
      filter={filter}
      overlayClassName="fixed inset-0 z-40 bg-bg/75"
      contentClassName="fixed left-1/2 top-[12vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-box border border-rule bg-raised shadow-2xl"
    >
      <Command.Input
        placeholder="Find a tool…"
        className="w-full border-b border-rule bg-transparent px-4 py-3.5 outline-none placeholder:text-muted"
      />
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
          No tool matches that. Try what it's for, like "uuid" or "crash".
        </Command.Empty>
        {GROUPS.map((g) => (
          <Command.Group key={g.category} heading={g.category} className="palette-group">
            {g.tools.map((t) => (
              <Command.Item
                key={t.slug}
                value={t.name}
                keywords={[...t.keywords, t.summary]}
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
  );
}
