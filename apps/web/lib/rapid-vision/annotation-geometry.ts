import type { StudioBox } from "./studio-dataset";

export type NormPoint = { x: number; y: number };

export type BoxHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

/** Keep a box inside the image. Values are fractions of width and height. */
export function clampStudioBox(box: StudioBox): StudioBox {
  const width = Math.min(Math.max(box.width, 0), 1);
  const height = Math.min(Math.max(box.height, 0), 1);
  const x = Math.min(Math.max(box.x, 0), 1 - width);
  const y = Math.min(Math.max(box.y, 0), 1 - height);
  return { x, y, width, height };
}

export function roundStudioBox(box: StudioBox): StudioBox {
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return clampStudioBox({ x: round(box.x), y: round(box.y), width: round(box.width), height: round(box.height) });
}

export function boxesMatch(left: StudioBox | null | undefined, right: StudioBox | null | undefined): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return (
    Math.abs(left.x - right.x) < 0.0001 &&
    Math.abs(left.y - right.y) < 0.0001 &&
    Math.abs(left.width - right.width) < 0.0001 &&
    Math.abs(left.height - right.height) < 0.0001
  );
}

/** Drag from one corner to the other. A tiny drag is not a box. */
export function boxFromDrag(start: NormPoint, current: NormPoint): StudioBox | null {
  const box = clampStudioBox({
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  });
  if (box.width < 0.005 || box.height < 0.005) return null;
  return roundStudioBox(box);
}

export function moveStudioBox(box: StudioBox, dx: number, dy: number): StudioBox {
  return roundStudioBox({ ...box, x: box.x + dx, y: box.y + dy });
}

export function resizeStudioBox(box: StudioBox, handle: BoxHandle, dx: number, dy: number): StudioBox {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.width;
  let bottom = box.y + box.height;
  if (handle.includes("w")) left += dx;
  if (handle.includes("e")) right += dx;
  if (handle.includes("n")) top += dy;
  if (handle.includes("s")) bottom += dy;
  left = Math.min(Math.max(left, 0), 1);
  right = Math.min(Math.max(right, 0), 1);
  top = Math.min(Math.max(top, 0), 1);
  bottom = Math.min(Math.max(bottom, 0), 1);
  return roundStudioBox({
    x: Math.min(left, right),
    y: Math.min(top, bottom),
    width: Math.abs(right - left),
    height: Math.abs(bottom - top),
  });
}

export function pointInsideBox(point: NormPoint, box: StudioBox): boolean {
  return point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height;
}

export function fittedImageSize(
  viewportWidth: number,
  viewportHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  if (viewportWidth <= 0 || viewportHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(viewportWidth / naturalWidth, viewportHeight / naturalHeight);
  return { width: Math.max(1, Math.floor(naturalWidth * scale)), height: Math.max(1, Math.floor(naturalHeight * scale)) };
}

/** Mean luminance on a raw preview. Brightness sliders must not feed this check. */
export function inspectPreviewPixels(data: Uint8ClampedArray): "ready" | "black" {
  const count = data.length / 4;
  if (count < 1) return "black";
  let sum = 0;
  let max = 0;
  for (let index = 0; index < data.length; index += 4) {
    const luma = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
    sum += luma;
    if (luma > max) max = luma;
  }
  if (sum / count < 14 && max < 32) return "black";
  return "ready";
}
