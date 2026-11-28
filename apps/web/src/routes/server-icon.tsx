import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PhoneBar, useOffscreen } from "../components/Copy";
import { type FormatOption, FormatPicker } from "../components/FormatPicker";
import { ImageDrop, type LoadedImage, useImageFile } from "../components/ImageDrop";
import { ServerList } from "../components/ServerList";
import { ToolPage, toolHead } from "../components/ToolPage";
import {
  CENTRED,
  type Crop,
  clampCrop,
  clampZoom,
  cropRect,
  downscaleSteps,
  ICON_SIZE,
  MAX_ZOOM,
  panBy,
  viewTransform,
} from "../lib/icon-crop";
import { useUrlState } from "../lib/url-state";
import { toolBySlug } from "../tools";

export const Route = createFileRoute("/server-icon")({
  head: () => toolHead("server-icon"),
  component: ServerIconTool,
});

const tool = toolBySlug("server-icon");

type Scaling = "smooth" | "pixel";

const SCALINGS: FormatOption<Scaling>[] = [
  { id: "smooth", label: "Smooth", usedBy: "Logos and pictures" },
  { id: "pixel", label: "Pixel art", usedBy: "Art drawn at a small size" },
];

interface State {
  scaling: Scaling;
}

const DEFAULTS: State = { scaling: "smooth" };

const codec = {
  decode: (p: URLSearchParams, d: State): State => ({
    scaling: p.get("s") === "pixel" ? "pixel" : p.get("s") === "smooth" ? "smooth" : d.scaling,
  }),
  encode: (v: State) => new URLSearchParams({ s: v.scaling }),
};

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

/**
 * Draws the crop at 64×64. Pixel art samples the nearest pixel from a crop
 * snapped to whole pixels; smooth halves step by step with the browser's
 * high-quality filter, so a large image doesn't alias on the way down.
 */
function renderIcon(img: LoadedImage, crop: Crop, scaling: Scaling): HTMLCanvasElement {
  const r = cropRect(img.width, img.height, crop);
  if (scaling === "pixel") {
    const out = canvas(ICON_SIZE);
    const ctx = out.getContext("2d");
    if (!ctx) return out;
    ctx.imageSmoothingEnabled = false;
    const size = Math.max(1, Math.round(r.size));
    const x = Math.min(Math.round(r.x), img.width - size);
    const y = Math.min(Math.round(r.y), img.height - size);
    ctx.drawImage(img.image, x, y, size, size, 0, 0, ICON_SIZE, ICON_SIZE);
    return out;
  }
  let source: CanvasImageSource = img.image;
  let sx = r.x;
  let sy = r.y;
  let ss = r.size;
  let out = canvas(ICON_SIZE);
  for (const size of downscaleSteps(r.size)) {
    out = canvas(size);
    const ctx = out.getContext("2d");
    if (!ctx) return out;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, sx, sy, ss, ss, 0, 0, size, size);
    source = out;
    sx = 0;
    sy = 0;
    ss = size;
  }
  return out;
}

/** Renders the icon after changes settle into a frame, as a blob: URL for previews and the download. */
function useIcon(img: LoadedImage | null, crop: Crop, scaling: Scaling) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!img) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let made: string | null = null;
    const frame = requestAnimationFrame(() => {
      renderIcon(img, crop, scaling).toBlob((blob) => {
        if (!blob) return;
        made = URL.createObjectURL(blob);
        if (cancelled) URL.revokeObjectURL(made);
        else setUrl(made);
      }, "image/png");
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      // Revoke once the next render has replaced it, so previews never flash empty.
      if (made) {
        const old = made;
        window.setTimeout(() => URL.revokeObjectURL(old), 1000);
      }
    };
  }, [img, crop, scaling]);
  return url;
}

function ServerIconTool() {
  const { value: state, update } = useUrlState(DEFAULTS, codec);
  const file = useImageFile();
  const img = file.image;
  const [crop, setCrop] = useState<Crop>(CENTRED);
  const icon = useIcon(img, crop, state.scaling);

  // A new image starts centred and fully zoomed out.
  const imgUrl = img?.url;
  useEffect(() => {
    if (imgUrl) setCrop(CENTRED);
  }, [imgUrl]);

  const output = useRef<HTMLDivElement>(null);
  const offscreen = useOffscreen(output);

  const download = icon ? (
    <a href={icon} download="server-icon.png" className="button primary compact shrink-0">
      Download
    </a>
  ) : (
    <button type="button" className="button primary compact shrink-0" disabled>
      Download
    </button>
  );

  return (
    <ToolPage tool={tool} guide={<Guide />}>
      <ServerList
        name="Minecraft Server"
        motd={[{ text: "A Minecraft Server", style: {} }]}
        online={0}
        max={20}
        icon={icon ?? undefined}
        className="mb-6"
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <ImageDrop
            paste
            label={img ? "Choose another image" : "Choose an image"}
            onFile={file.load}
            error={file.error}
          />

          {img ? (
            <CropEditor img={img} crop={crop} onCrop={setCrop} scaling={state.scaling} />
          ) : (
            <p className="text-sm text-muted">
              Any PNG, JPEG, WebP or GIF works. It's cropped and scaled here, in your browser, and
              never uploaded.
            </p>
          )}

          <div>
            <FormatPicker
              label="Scaling"
              options={SCALINGS}
              value={state.scaling}
              onChange={(scaling) => update({ scaling })}
            />
            <p className="mt-2 text-xs text-muted">
              {state.scaling === "smooth"
                ? "For logos and pictures: scaled down in halves, so edges stay clean."
                : "For pixel art: every icon pixel takes the nearest image pixel, so nothing blurs."}{" "}
              The link saves this choice; images can't go in a link, so it doesn't hold the picture.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 self-start lg:sticky lg:top-24">
          <div ref={output} className="panel p-4">
            <PhoneBar show={offscreen} label="server-icon.png">
              {download}
            </PhoneBar>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold tracking-normal">server-icon.png</h2>
                <p className="text-xs text-muted">64×64 PNG, next to server.properties</p>
              </div>
              {download}
            </div>
            <div className="flex flex-wrap items-end gap-6 rounded-lg bg-bg p-4">
              <IconPreview url={icon} size={64} label="1×" />
              <IconPreview url={icon} size={128} label="2×" />
            </div>
            {!img && (
              <p className="mt-2 text-xs text-muted">Choose an image and the icon appears here.</p>
            )}
          </div>
        </div>
      </div>
    </ToolPage>
  );
}

function IconPreview({ url, size, label }: { url: string | null; size: number; label: string }) {
  return (
    <figure className="m-0 flex flex-col items-start gap-2">
      <div
        className="pixelated overflow-hidden rounded-[4px] border border-rule"
        style={{ width: size + 2, height: size + 2 }}
      >
        {url ? (
          <img
            src={url}
            alt={`The icon at ${label}`}
            width={size}
            height={size}
            className="pixelated block"
          />
        ) : (
          <div className="size-full bg-raised" />
        )}
      </div>
      <figcaption className="label">{label}</figcaption>
    </figure>
  );
}

function CropEditor({
  img,
  crop,
  onCrop,
  scaling,
}: {
  img: LoadedImage;
  crop: Crop;
  onCrop: (c: Crop) => void;
  scaling: Scaling;
}) {
  const view = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(320);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize(entry.contentRect.width || 320);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const t = viewTransform(img.width, img.height, crop, size);
  const pan = (dx: number, dy: number) => onCrop(panBy(img.width, img.height, crop, dx, dy, size));
  const zoomTo = (zoom: number) =>
    onCrop(clampCrop(img.width, img.height, { ...crop, zoom: clampZoom(zoom) }));
  const fill = `${((crop.zoom - 1) / (MAX_ZOOM - 1)) * 100}%`;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={view}
        className="crop-view w-full max-w-[20rem]"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the crop moves with the arrow keys, so it takes focus
        tabIndex={0}
        role="application"
        aria-roledescription="crop"
        aria-label="Crop. Drag, or use the arrow keys, to move it; plus and minus zoom."
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          pan(e.clientX - drag.current.x, e.clientY - drag.current.y);
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 8;
          const moves: Record<string, [number, number]> = {
            ArrowLeft: [step, 0],
            ArrowRight: [-step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
          };
          const move = moves[e.key];
          if (move) {
            e.preventDefault();
            pan(...move);
          } else if (e.key === "+" || e.key === "=") {
            e.preventDefault();
            zoomTo(crop.zoom * 1.1);
          } else if (e.key === "-" || e.key === "_") {
            e.preventDefault();
            zoomTo(crop.zoom / 1.1);
          }
        }}
      >
        <img
          src={img.url}
          alt=""
          draggable={false}
          className={scaling === "pixel" ? "pixelated" : ""}
          style={{ left: t.left, top: t.top, width: t.width, height: t.height }}
        />
      </div>
      <p className="text-xs text-muted">
        {img.name}, {img.width}×{img.height}. The square is the icon: drag to move it.
      </p>
      <div className="flex max-w-[20rem] items-center gap-3">
        <label htmlFor="icon-zoom" className="label shrink-0">
          Zoom
        </label>
        <input
          id="icon-zoom"
          type="range"
          className="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          aria-valuetext={`${crop.zoom.toFixed(1)} times`}
          style={{ "--fill": fill } as React.CSSProperties}
          onChange={(e) => zoomTo(Number(e.target.value))}
        />
        <button type="button" className="button compact shrink-0" onClick={() => onCrop(CENTRED)}>
          Centre
        </button>
      </div>
    </div>
  );
}

function Guide() {
  return (
    <>
      <h2>Where it goes</h2>
      <ul>
        <li>
          Save it as <code>server-icon.png</code>, exactly that name, in your server's main folder:
          the one with <code>server.properties</code> in it. On BungeeCord or Velocity it goes in
          the proxy's folder instead.
        </li>
        <li>
          It must be a PNG of exactly 64×64 pixels. The game logs "Invalid world icon size" and
          shows no icon for any other size, which is why this tool always makes 64×64.
        </li>
        <li>
          The server reads it once, when it starts. Restart the server after adding or changing it;
          players see the new icon the next time their server list refreshes.
        </li>
      </ul>
      <h2>Good to know</h2>
      <ul>
        <li>
          Pick <strong>Smooth</strong> for logos and pictures, and <strong>Pixel art</strong> for
          art drawn at a small size, so every pixel stays sharp.
        </li>
        <li>
          Bold shapes and a few colours read best at 64 pixels. Fine text won't survive the shrink.
          Transparent backgrounds are kept.
        </li>
        <li>
          Everything happens in your browser: the image is never uploaded. Images can't go in a
          link, so the link only remembers the scaling.
        </li>
        <li>
          Writing the server list message too? The{" "}
          <Link to="/motd" className="more">
            MOTD Generator
          </Link>{" "}
          previews the two together.
        </li>
      </ul>
    </>
  );
}
