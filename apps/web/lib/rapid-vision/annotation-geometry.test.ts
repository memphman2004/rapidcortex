import { describe, expect, it } from "vitest";
import {
  boxFromDrag,
  clampStudioBox,
  fittedImageSize,
  inspectPreviewPixels,
  moveStudioBox,
  resizeStudioBox,
} from "./annotation-geometry";

describe("annotation geometry", () => {
  it("keeps a moved box inside the image", () => {
    const moved = moveStudioBox({ x: 0.8, y: 0.1, width: 0.3, height: 0.2 }, 0.5, 0);
    expect(moved.x + moved.width).toBeLessThanOrEqual(1);
    expect(moved.width).toBeCloseTo(0.3);
  });

  it("resizes from the east edge and clamps", () => {
    const resized = resizeStudioBox({ x: 0.2, y: 0.2, width: 0.2, height: 0.2 }, "e", 0.9, 0);
    expect(resized.x).toBeCloseTo(0.2);
    expect(resized.width).toBeCloseTo(0.8);
  });

  it("ignores a drag that is too small to be an object", () => {
    expect(boxFromDrag({ x: 0.4, y: 0.4 }, { x: 0.401, y: 0.402 })).toBeNull();
  });

  it("fits the image inside the viewport without cropping", () => {
    const size = fittedImageSize(800, 400, 1000, 1000);
    expect(size.width).toBe(400);
    expect(size.height).toBe(400);
  });

  it("flags a nearly black preview and accepts a visible one", () => {
    const black = new Uint8ClampedArray(16);
    expect(inspectPreviewPixels(black)).toBe("black");
    const visible = new Uint8ClampedArray([180, 40, 40, 255, 20, 20, 20, 255]);
    expect(inspectPreviewPixels(visible)).toBe("ready");
  });

  it("clamps a box that starts outside the frame", () => {
    const box = clampStudioBox({ x: -0.2, y: 0.5, width: 0.4, height: 0.4 });
    expect(box.x).toBe(0);
    expect(box.y + box.height).toBeLessThanOrEqual(1);
  });
});
