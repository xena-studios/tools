// Writes dist/client/_headers after the build: security headers for every page,
// and a CSP per page that allows only that page's own inline scripts, by hash.
//
// TanStack Start inlines two small scripts for hydration, and their contents
// differ per page, so the hashes have to be read from the built HTML. Inline
// styles are allowed: the Minecraft text previews colour every span on the fly,
// and a style can't run code.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CLIENT = path.resolve(import.meta.dirname, "../dist/client");

const BASE = [
  "default-src 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
];

const COMMON = [
  "  Cross-Origin-Opener-Policy: same-origin",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  X-Content-Type-Options: nosniff",
  "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
  "  Strict-Transport-Security: max-age=31536000; includeSubDomains",
];

function pages(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "assets" ? [] : pages(p);
    return e.name.endsWith(".html") ? [p] : [];
  });
}

const blocks: string[] = [];
for (const file of pages(CLIENT)) {
  const html = fs.readFileSync(file, "utf8");
  const hashes = new Set<string>();
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const body = m[1] ?? "";
    if (body) hashes.add(`'sha256-${createHash("sha256").update(body).digest("base64")}'`);
  }
  const csp = [...BASE, `script-src 'self' ${[...hashes].join(" ")}`.trim()].join("; ");
  let route = `/${path.relative(CLIENT, file).replace(/\\/g, "/")}`;
  route = route.replace(/index\.html$/, "").replace(/\.html$/, "");
  // A page is reachable with and without its trailing slash.
  const routes =
    route === "/" ? ["/"] : [route.replace(/\/$/, ""), route.endsWith("/") ? route : `${route}/`];
  for (const r of routes)
    blocks.push([r, `  Content-Security-Policy: ${csp}`, ...COMMON].join("\n"));
}

blocks.push(["/assets/*", "  Cache-Control: public, max-age=31536000, immutable"].join("\n"));

fs.writeFileSync(path.join(CLIENT, "_headers"), `${blocks.join("\n\n")}\n`);
console.log(`_headers: CSP for ${pages(CLIENT).length} pages`);
