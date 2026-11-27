import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { seo } from "./seo-plugin.ts";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // No data: URLs: every font and image is a file, so the CSP stays 'self'.
  build: { assetsInlineLimit: 0 },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      // Every page is built to static HTML and served as a static asset: the
      // Worker only runs for the few tools that need a server.
      prerender: { enabled: true, crawlLinks: true, failOnError: true },
    }),
    viteReact(),
    seo(),
  ],
});
