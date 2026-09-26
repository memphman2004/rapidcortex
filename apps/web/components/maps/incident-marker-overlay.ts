"use client";

/**
 * Pulsing red marker for active incidents on Amazon Location Maps V2.
 * Canvas image (same technique as live-caller) so ALS paints it in the top slot.
 */

import type * as maplibregl from "maplibre-gl";

export const INCIDENT_PULSE_IMAGE_ID = "rc-incident-pulse-active";

type StyleImageLike = {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
  onAdd?: () => void;
  onRemove?: () => void;
  render?: () => boolean;
  context?: CanvasRenderingContext2D | null;
};

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  alpha: number,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(239, 68, 68, ${Math.max(0, alpha) * 0.28})`;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0, alpha)})`;
  ctx.stroke();
}

function createIncidentPulseImage(map: maplibregl.Map): StyleImageLike {
  const size = 128;
  const image: StyleImageLike = {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),
    onAdd() {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      this.context = canvas.getContext("2d", { willReadFrequently: true });
    },
    render() {
      const ctx = this.context;
      if (!ctx) return false;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const coreR = 12;
      const duration = 1800;
      const t = (performance.now() % duration) / duration;
      const t2 = ((performance.now() + duration / 2) % duration) / duration;
      drawRing(ctx, cx, cy, coreR + t * 40, 1 - t);
      drawRing(ctx, cx, cy, coreR + t2 * 40, 1 - t2);

      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      this.data = ctx.getImageData(0, 0, size, size).data;
      map.triggerRepaint();
      return true;
    },
  };
  return image;
}

export function ensureIncidentPulseImage(map: maplibregl.Map): void {
  if (map.hasImage(INCIDENT_PULSE_IMAGE_ID)) return;
  map.addImage(INCIDENT_PULSE_IMAGE_ID, createIncidentPulseImage(map), { pixelRatio: 2 });
}
