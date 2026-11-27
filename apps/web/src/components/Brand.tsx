// The studio's brand pieces, as on xenastudios.co and brand.xenastudios.co:
// the logo, the planet horizon, and the outbound-link arrow. The SVGs are our own
// committed brand files (src/brand), never user input, so inlining them is safe.

import xenaRaw from "../brand/logo/xena.svg?raw";
import xenaStudiosRaw from "../brand/logo/xena-studios.svg?raw";
import horizonRaw from "../brand/scene/horizon.svg?raw";

/** Inlines a logo in currentColor, cropped to its ink (the exports carry half a cap height of clear space). */
function inlineLogo(raw: string, className: string) {
  const [, w = "0", h = "0"] = raw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? [];
  const pad = 50;
  return raw
    .replace(/ width="[^"]*" height="[^"]*"/, "")
    .replace(
      /viewBox="[^"]*"/,
      `viewBox="${pad} ${pad} ${+w - pad * 2} ${+h - pad * 2}" class="${className}" role="img" aria-label="Xena Studios"`,
    )
    .replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="currentColor"');
}

export function Logo({
  name = "xena-studios",
  className = "",
}: {
  name?: "xena-studios" | "xena";
  className?: string;
}) {
  const html = inlineLogo(name === "xena" ? xenaRaw : xenaStudiosRaw, className);
  return (
    <span
      className="contents"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted brand asset
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** The brand's horizon scene, covering its box from the bottom edge so the planet limb sits low. */
export function Horizon({
  className = "",
  idPrefix = "horizon",
}: {
  className?: string;
  idPrefix?: string;
}) {
  const html = horizonRaw
    .replace(
      / width="[^"]*" height="[^"]*"/,
      ` preserveAspectRatio="xMidYMax slice" class="horizon ${className}" aria-hidden="true" focusable="false"`,
    )
    .replace(/ id="([^"]+)"/g, ` id="${idPrefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${idPrefix}-$1)`);
  return (
    <span
      className="contents"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted brand asset
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** The outbound arrow. Wraps a link's last word, so it never wraps onto a line alone. */
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
