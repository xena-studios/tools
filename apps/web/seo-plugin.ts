// Writes sitemap.xml and robots.txt into the client build, from the tool registry.
import type { Plugin } from "vite";
import { LIVE_TOOLS, SITE } from "./src/tools.ts";

export function seo(): Plugin {
  return {
    name: "xena-tools:seo",
    applyToEnvironment: (env) => env.name === "client",
    generateBundle() {
      const urls = ["/", ...LIVE_TOOLS.map((t) => `/${t.slug}`)];
      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((u) => `  <url><loc>${SITE.url}${u}</loc></url>`),
        "</urlset>",
        "",
      ].join("\n");
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`,
      });
    },
  };
}
