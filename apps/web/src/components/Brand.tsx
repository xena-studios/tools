// The site's brand pieces: the studio logo (footer only), the outbound-link
// arrow, and the product wordmark.

import xenaRaw from "../brand/logo/xena.svg?raw";
import toolsLogoRaw from "../brand/tools/logo-dark.svg?raw";

/** Inlines a brand SVG in currentColor, cropped to its ink (exports carry half a cap height of clear space). */
function inlineLogo(raw: string, label: string, className: string, pad: number, recolor = true) {
  const [, w = "0", h = "0"] = raw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? [];
  return raw
    .replace(/ width="[^"]*" height="[^"]*"/, "")
    .replace(
      /viewBox="[^"]*"/,
      `viewBox="${pad} ${pad} ${+w - pad * 2} ${+h - pad * 2}" class="${className}" role="img" aria-label="${label}"`,
    )
    .replace(/fill="#[0-9A-Fa-f]{6}"/g, (m) => (recolor ? 'fill="currentColor"' : m));
}

export function XenaLogo({ className = "" }: { className?: string }) {
  // Our own committed SVG from the brand repo, not user input.
  return (
    <span
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted brand asset
      dangerouslySetInnerHTML={{ __html: inlineLogo(xenaRaw, "Xena Studios", className, 50) }}
    />
  );
}

/** The outbound arrow. Wraps a link's last word so it never wraps alone. */
export function External({ children }: { children: React.ReactNode }) {
  return (
    <span className="group/ext whitespace-nowrap">
      {children}
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        focusable="false"
        className="ml-[0.4em] inline-block size-[0.62em] align-[0.05em] opacity-70 transition duration-200 ease-out-expo group-hover/ext:translate-x-[0.08em] group-hover/ext:-translate-y-[0.08em] group-hover/ext:opacity-100"
      >
        <path
          d="M3.5 2.75h5.75v5.75M9.25 2.75 2.75 9.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="square"
        />
      </svg>
    </span>
  );
}

/** The Xena Tools logo (tile and wordmark), in its own colours. */
export function ToolsLogo({ className = "" }: { className?: string }) {
  return (
    <span
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted brand asset
      dangerouslySetInnerHTML={{
        __html: inlineLogo(toolsLogoRaw, "Xena Tools", className, 50, false),
      }}
    />
  );
}
