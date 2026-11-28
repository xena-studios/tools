// A skin drawn flat, front and back, from its PNG on a canvas, and the cape's
// outside. The PNG comes from /api/skin/<hash> on this origin, so the canvas
// isn't tainted and the CSP stays 'self'. Our own drawing: no 3D, no library.

import { useEffect, useRef, useState } from "react";
import {
  CAPE_OUTER,
  type Model,
  type Part,
  skinParts,
  VIEW_H,
  VIEW_W,
  type View,
} from "../lib/skin";

const SCALE = 8;

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't load the skin"));
    img.src = src;
  });
}

function drawPart(ctx: CanvasRenderingContext2D, img: HTMLImageElement, p: Part) {
  if (p.mirror) {
    ctx.save();
    ctx.translate(p.dx + p.w, p.dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, p.sx, p.sy, p.w, p.h, 0, 0, p.w, p.h);
    ctx.restore();
  } else {
    ctx.drawImage(img, p.sx, p.sy, p.w, p.h, p.dx, p.dy, p.w, p.h);
  }
}

/**
 * The game ignores a 64×32 skin's hat when that area is fully opaque (old
 * skins filled it with a solid colour), so this does too.
 */
function hatIsOpaque(img: HTMLImageElement, part: Part): boolean {
  const c = document.createElement("canvas");
  c.width = part.w;
  c.height = part.h;
  const ctx = c.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(img, part.sx, part.sy, part.w, part.h, 0, 0, part.w, part.h);
  const data = ctx.getImageData(0, 0, part.w, part.h).data;
  for (let i = 3; i < data.length; i += 4) if ((data[i] as number) < 255) return false;
  return true;
}

function drawView(canvas: HTMLCanvasElement, img: HTMLImageElement, view: View, model: Model) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const legacy = img.naturalHeight === 32;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  for (const p of skinParts(view, model, legacy)) {
    if (legacy && p.overlay && hatIsOpaque(img, p)) continue;
    drawPart(ctx, img, p);
  }
}

export function SkinViews({ hash, model, name }: { hash: string; model: Model; name: string }) {
  const front = useRef<HTMLCanvasElement>(null);
  const back = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    setError(false);
    load(`/api/skin/${hash}`)
      .then((img) => {
        if (!live) return;
        if (img.naturalWidth !== 64 || (img.naturalHeight !== 64 && img.naturalHeight !== 32)) {
          setError(true);
          return;
        }
        if (front.current) drawView(front.current, img, "front", model);
        if (back.current) drawView(back.current, img, "back", model);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [hash, model]);

  if (error)
    return (
      <p className="text-sm text-muted">The skin couldn't be loaded. Try again in a minute.</p>
    );

  return (
    <div className="flex flex-wrap gap-6">
      {(["front", "back"] as const).map((view) => (
        <figure key={view} className="m-0 flex flex-col items-center gap-2">
          <canvas
            ref={view === "front" ? front : back}
            width={VIEW_W}
            height={VIEW_H}
            className="skin-canvas"
            style={{ width: VIEW_W * SCALE, height: VIEW_H * SCALE }}
            role="img"
            aria-label={`${name}'s skin from the ${view}`}
          />
          <figcaption className="text-xs text-muted capitalize">{view}</figcaption>
        </figure>
      ))}
    </div>
  );
}

export function CapeView({ hash, name }: { hash: string; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    load(`/api/skin/${hash}`)
      .then((img) => {
        const ctx = canvas.current?.getContext("2d");
        if (!live || !ctx) return;
        ctx.imageSmoothingEnabled = false;
        const { sx, sy, w, h } = CAPE_OUTER;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, sx, sy, w, h, 0, 0, w, h);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [hash]);
  if (error) return null;
  return (
    <figure className="m-0 flex flex-col items-center gap-2">
      <canvas
        ref={canvas}
        width={CAPE_OUTER.w}
        height={CAPE_OUTER.h}
        className="skin-canvas"
        style={{ width: CAPE_OUTER.w * SCALE, height: CAPE_OUTER.h * SCALE }}
        role="img"
        aria-label={`${name}'s cape`}
      />
      <figcaption className="text-xs text-muted">Cape</figcaption>
    </figure>
  );
}
