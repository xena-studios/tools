// Copies the site's brand files from a checkout of xena-studios/brand, the single
// source of truth for logos and colours. The copies are committed, so builds
// never fetch the brand repo and the site only changes when someone syncs on purpose.
//
//   pnpm brand:sync                    # expects ../brand
//   BRAND_DIR=/path/to/brand pnpm brand:sync
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const WEB = path.join(ROOT, "apps/web");
const BRAND = path.resolve(process.env.BRAND_DIR ?? path.join(ROOT, "../brand"));

if (!fs.existsSync(path.join(BRAND, "tokens/colors.css"))) {
  console.error(`No brand checkout at ${BRAND}. Clone xena-studios/brand there or set BRAND_DIR.`);
  process.exit(1);
}

// [from (in brand), to (in apps/web)]
const files: [string, string][] = [
  ["tokens/colors.css", "src/brand/colors.css"],
  ["tokens/tools.css", "src/brand/tools.css"],
  ["tokens/tools.json", "src/brand/tools.json"],
  // The studio's endorsement, in the footer only.
  ["logo/xena.svg", "src/brand/logo/xena.svg"],
  ["tools/logo-dark.svg", "src/brand/tools/logo-dark.svg"],
  ["tools/mark.svg", "src/brand/tools/mark.svg"],
  ["tools/icon.svg", "src/brand/tools/icon.svg"],
  ["tools/favicon.svg", "public/favicon.svg"],
  ["tools/apple-touch-icon.png", "public/apple-touch-icon.png"],
  ["tools/og.png", "public/og.png"],
];

const missing = files.filter(([from]) => !fs.existsSync(path.join(BRAND, from)));
if (missing.length > 0) {
  console.error(`Missing in ${BRAND}:\n${missing.map(([f]) => `  ${f}`).join("\n")}`);
  process.exit(1);
}

for (const [from, to] of files) {
  const dest = path.join(WEB, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(BRAND, from), dest);
}

const git = (...args: string[]) =>
  execFileSync("git", ["-C", BRAND, ...args], { encoding: "utf8" }).trim();
const source = {
  repo: "xena-studios/brand",
  commit: git("rev-parse", "HEAD"),
  dirty: git("status", "--porcelain") !== "",
};
fs.writeFileSync(path.join(WEB, "src/brand/SOURCE.json"), `${JSON.stringify(source, null, 2)}\n`);

console.log(
  `synced ${files.length} files from brand@${source.commit.slice(0, 7)}${source.dirty ? " (dirty)" : ""}`,
);
