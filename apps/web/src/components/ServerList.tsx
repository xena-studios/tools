// One entry of the game's multiplayer screen, laid out in game pixels: the 32px
// icon (64 on screen at 2×), the name, two lines of MOTD in the 267px the game
// gives them, the player count and the signal bars. Everything here is drawn by
// us: no game textures, font or sprites.
//
// The whole entry scales with its container, so it keeps the game's proportions
// on a phone. Monocraft is monospaced and the game's font isn't, so the MOTD's
// width and where it wraps are close, not exact.

import type { Span } from "@xena-tools/mc-text";
import { McLine } from "./McText";

/** The colours the game draws the server list in. */
export const SERVER_LIST_COLORS = {
  /** The name. */
  name: "#FFFFFF",
  /** Uncoloured MOTD text: the list draws it in 0x808080, a step darker than chat's gray. */
  motd: "#808080",
  /** The player count's numbers, and the slash between them. */
  count: "#AAAAAA",
  slash: "#555555",
} as const;

interface ServerListProps {
  name: string;
  /** The MOTD, both lines, joined by a newline. Only the first two lines show, as in the game. */
  motd: Span[];
  online?: number;
  max?: number;
  /** An image URL (a blob: or same-origin file). Without one, a placeholder is drawn. */
  icon?: string;
  className?: string;
}

const plain = (text: string, color: string): Span => ({ text, style: { color } });

export function ServerList({ name, motd, online, max, icon, className = "" }: ServerListProps) {
  const hasCount = online !== undefined && max !== undefined;
  return (
    <figure className={`server-list m-0 ${className}`} aria-label="Server list preview">
      <div className="server-entry">
        <div className="server-icon">
          {icon ? <img src={icon} alt="Server icon" width={64} height={64} /> : <IconPlaceholder />}
        </div>
        <div className="server-text mc mc-shadow">
          <div className="server-top">
            <span className="server-name">
              <McLine spans={[plain(name, SERVER_LIST_COLORS.name)]} />
            </span>
            <span className="server-status">
              {hasCount && (
                <span className="server-count">
                  <McLine
                    spans={[
                      plain(String(online), SERVER_LIST_COLORS.count),
                      plain("/", SERVER_LIST_COLORS.slash),
                      plain(String(max), SERVER_LIST_COLORS.count),
                    ]}
                  />
                </span>
              )}
              <SignalBars />
            </span>
          </div>
          <p className="server-motd">
            <McLine spans={motd} fallback={SERVER_LIST_COLORS.motd} />
          </p>
        </div>
      </div>
    </figure>
  );
}

/** Five bars, full signal. */
function SignalBars() {
  const heights = [2, 3.5, 5, 6.5, 8];
  return (
    <svg
      className="server-bars"
      viewBox="0 0 10 8"
      role="img"
      aria-label="Full signal"
      shapeRendering="crispEdges"
    >
      {heights.map((h, i) => (
        <rect key={h} x={i * 2} y={8 - h} width={1.25} height={h} fill="#55FF55" />
      ))}
    </svg>
  );
}

/** What the list shows with no icon: our own drawing, a framed landscape. */
function IconPlaceholder() {
  return (
    <svg className="server-icon-empty" viewBox="0 0 32 32" role="img" aria-label="No icon">
      <rect x="0.5" y="0.5" width="31" height="31" fill="#1B1B1B" stroke="#3A3A3A" />
      <path d="M6 23 12.5 15l4.5 5 3-3.5L26 23Z" fill="#4A4A4A" />
      <rect x="20" y="8" width="4" height="4" fill="#4A4A4A" />
    </svg>
  );
}
