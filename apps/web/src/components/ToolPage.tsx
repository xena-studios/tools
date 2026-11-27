import { SITE, type Tool, toolBySlug } from "../tools";
import { Horizon } from "./Brand";

/** Head tags for a tool's route, from its registry entry: "Gradient Text: Xena Studios tools". */
export function toolHead(slug: string) {
  const tool = toolBySlug(slug);
  const title = `${tool.name}: ${SITE.name}`;
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

/**
 * A tool's page. The header stays compact so the preview, the controls and the
 * copy button are in the first screen: on a tool, the task comes before the title.
 */
export function ToolPage({ tool, children, guide }: ToolPageProps) {
  return (
    <>
      <main id="main" className="wrap pt-10 pb-20 sm:pt-14 lg:pb-4">
        <header className="mb-8 sm:mb-10">
          <p className="kicker mb-4">{`// ${tool.category}`}</p>
          <h1 className="text-[length:var(--t-tool)] leading-[1.05]">{tool.name}</h1>
          <p className="lead mt-3">{tool.summary}</p>
        </header>
        {children}
        {guide && (
          <section aria-label="How to use it" className="mt-16 border-t border-rule pt-10">
            <div className="prose-tool">{guide}</div>
          </section>
        )}
      </main>
      {/* The studio's horizon closes every page, as on xenastudios.co; on a tool it
          sits below the work, so it never pushes the output down. */}
      <div
        aria-hidden="true"
        className="relative isolate mt-4 h-[clamp(5rem,22vw,17rem)] overflow-hidden"
      >
        <Horizon
          className="absolute inset-x-0 bottom-0 h-full w-full"
          idPrefix={`${tool.slug}-horizon`}
        />
      </div>
    </>
  );
}
