import { describe, expect, it } from "vitest";
import {
  CENTRED,
  clampCrop,
  cropRect,
  downscaleSteps,
  MAX_ZOOM,
  panBy,
  viewTransform,
} from "./icon-crop";

describe("cropRect", () => {
  it("takes the centred short side at zoom 1", () => {
    expect(cropRect(400, 200, CENTRED)).toEqual({ x: 100, y: 0, size: 200 });
    expect(cropRect(200, 400, CENTRED)).toEqual({ x: 0, y: 100, size: 200 });
  });
  it("zooms into a smaller square", () => {
    expect(cropRect(400, 400, { zoom: 2, fx: 0.5, fy: 0.5 })).toEqual({
      x: 100,
      y: 100,
      size: 200,
    });
  });
  it("never leaves the image", () => {
    expect(cropRect(400, 200, { zoom: 1, fx: 0, fy: 1 })).toEqual({ x: 0, y: 0, size: 200 });
    expect(cropRect(400, 200, { zoom: 1, fx: 1, fy: 0 })).toEqual({ x: 200, y: 0, size: 200 });
  });
  it("keeps zoom between 1 and the maximum", () => {
    expect(cropRect(800, 800, { zoom: 0.2, fx: 0.5, fy: 0.5 }).size).toBe(800);
    expect(cropRect(800, 800, { zoom: 99, fx: 0.5, fy: 0.5 }).size).toBe(800 / MAX_ZOOM);
  });
});

describe("panBy", () => {
  it("moves the crop against the drag, in image pixels", () => {
    // A 200px crop in a 100px view: one screen pixel is two image pixels.
    const crop = panBy(400, 200, CENTRED, 10, 0, 100);
    expect(cropRect(400, 200, crop).x).toBe(80);
  });
  it("stops at the edge", () => {
    const crop = panBy(400, 200, CENTRED, 1000, 1000, 100);
    expect(cropRect(400, 200, crop)).toEqual({ x: 0, y: 0, size: 200 });
    expect(crop.fx).toBe(0.25);
  });
});

describe("clampCrop", () => {
  it("pulls an out-of-range centre back after zooming out", () => {
    expect(clampCrop(400, 400, { zoom: 1, fx: 0.9, fy: 0.1 })).toEqual(CENTRED);
  });
});

describe("viewTransform", () => {
  it("scales and offsets the image so the crop fills the view", () => {
    expect(viewTransform(400, 200, CENTRED, 100)).toEqual({
      left: -50,
      top: -0,
      width: 200,
      height: 100,
    });
  });
});

describe("downscaleSteps", () => {
  it("halves, then lands on 64", () => {
    expect(downscaleSteps(1000)).toEqual([500, 250, 125, 64]);
    expect(downscaleSteps(512)).toEqual([256, 128, 64]);
  });
  it("is one step when it's already close or smaller", () => {
    expect(downscaleSteps(100)).toEqual([64]);
    expect(downscaleSteps(128)).toEqual([64]);
    expect(downscaleSteps(16)).toEqual([64]);
  });
});
