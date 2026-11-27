import { SITE, type Tool, toolBySlug } from "../tools";

/** Head tags for a tool's route, from its registry entry. */
export function toolHead(slug: string) {
  const tool = toolBySlug(slug);
  const title = `${tool.name} · ${SITE.name}`;
  return {
    meta: [
      { title },
      { name: "description", content: tool.summary },
      { property: "og:title", content: title },
      { property: "og:description", content: tool.summary },
      { property: "og:url", content: `${SITE.url}/${tool.slug}` },
    ],
    links: [{ rel: "canonical", href: `${SITE.url}/${tool.slug}` }],
  };
}

interface ToolPageProps {
  tool: Tool;
  children: React.ReactNode;
  /** "How to use it": shown under the tool, for people and for search. */
  guide?: React.ReactNode;
}

export function ToolPage({ tool, children, guide }: ToolPageProps) {
  return (
    <main className="wrap pt-12 sm:pt-16">
      <div className="mb-8 max-w-3xl">
        <p className="kicker mb-3">{tool.category}</p>
        <h1 className="mb-3 text-3xl sm:text-5xl">{tool.name}</h1>
        <p className="text-lg text-muted">{tool.summary}</p>
      </div>
      {children}
      {guide && <section className="prose-tool mt-16 border-t border-rule pt-4">{guide}</section>}
    </main>
  );
}
