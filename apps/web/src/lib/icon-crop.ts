// The maths behind the server icon: a square crop of an image, panned and zoomed,
// and the sizes a smooth downscale steps through. No DOM here, so it's tested alone.

/** The icon the game reads: server-icon.png, exactly this many pixels square. */
export const ICON_SIZE = 64;
export const MAX_ZOOM = 8;

export interface Crop {
  /** 1 shows the whole short side; 2 shows half of it. */
  zoom: number;
  /** The crop's centre, as a fraction of the image's width and height. */
  fx: number;
  fy: number;
}

export const CENTRED: Crop = { zoom: 1, fx: 0.5, fy: 0.5 };

export interface Rect {
  x: number;
  y: number;
  size: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const clampZoom = (zoom: number) => clamp(Number.isFinite(zoom) ? zoom : 1, 1, MAX_ZOOM);

/** The square, in image pixels, that a crop covers. It never leaves the image. */
export function cropRect(width: number, height: number, crop: Crop): Rect {
  const size = Math.min(width, height) / clampZoom(crop.zoom);
  return {
    x: clamp(crop.fx * width - size / 2, 0, width - size),
    y: clamp(crop.fy * height - size / 2, 0, height - size),
    size,
  };
}

/** Pulls the centre back so the crop stays inside the image. */
export function clampCrop(width: number, height: number, crop: Crop): Crop {
  const zoom = clampZoom(crop.zoom);
  const r = cropRect(width, height, { ...crop, zoom });
  return { zoom, fx: (r.x + r.size / 2) / width, fy: (r.y + r.size / 2) / height };
}

/**
 * Moves the crop as if the image were dragged by (dx, dy) screen pixels in a
 * square view `view` pixels wide: dragging right shows more of the left.
 */
export function panBy(
  width: number,
  height: number,
  crop: Crop,
  dx: number,
  dy: number,
  view: number,
): Crop {
  const r = cropRect(width, height, crop);
  const perPixel = r.size / view;
  const cx = r.x + r.size / 2 - dx * perPixel;
  const cy = r.y + r.size / 2 - dy * perPixel;
  return clampCrop(width, height, { ...crop, fx: cx / width, fy: cy / height });
}

/** Where to draw the whole image so the crop fills a square view `view` pixels wide. */
export function viewTransform(width: number, height: number, crop: Crop, view: number) {
  const r = cropRect(width, height, crop);
  const scale = view / r.size;
  return { left: -r.x * scale, top: -r.y * scale, width: width * scale, height: height * scale };
}

/**
 * The sizes a smooth downscale passes through: halving until the next halving
 * would go below the target, then the target. One step at most halves, which is
 * what keeps a browser's bilinear filter from skipping pixels.
 */
export function downscaleSteps(from: number, to: number = ICON_SIZE): number[] {
  const steps: number[] = [];
  let size = from;
  while (size / 2 >= to) {
    size = Math.round(size / 2);
    if (size !== to) steps.push(size);
  }
  steps.push(to);
  return steps;
}
