"use client";

/**
 * Live Caller Location overlay for Amazon Location Maps V2 / MapLibre.
 * Pulsing canvas image (not a static PNG), accuracy radius, optional trail.
 * Restored after style.load from app state — not baked into the basemap.
 */

import type maplibregl from "maplibre-gl";
import { EMPTY_OVERLAY_FC } from "./runtime-overlays";
import { addOverlayLayer } from "./overlay-slot";
import type { RCLiveCaller, RCMapLayerVisibility } from "./map-types";
import {
  buildLiveCallerHoverHTML,
  liveCallersToAccuracyCollection,
  liveCallersToPointCollection,
  liveCallersToTrailCollection,
  resolveLiveCaller,
  type LiveCallerResolved,
} from "@/lib/live-caller";

export const LIVE_CALLER_PULSE_LIVE_ID = "rc-live-caller-pulse-live";
export const LIVE_CALLER_PULSE_STALE_ID = "rc-live-caller-pulse-stale";
export const LIVE_CALLER_PULSE_LOST_ID = "rc-live-caller-pulse-lost";
export const LIVE_CALLER_HEADING_ID = "rc-live-caller-heading";

export const LIVE_CALLER_SOURCE = "rc-live-caller";
export const LIVE_CALLER_ACCURACY_SOURCE = "rc-live-caller-accuracy";
export const LIVE_CALLER_TRAIL_SOURCE = "rc-live-caller-trail";

export const LIVE_CALLER_ACCURACY_FILL = "rc-live-caller-accuracy-fill";
export const LIVE_CALLER_ACCURACY_LINE = "rc-live-caller-accuracy-line";
export const LIVE_CALLER_TRAIL_LAYER = "rc-live-caller-trail-line";
export const LIVE_CALLER_PULSE_LAYER = "rc-live-caller-pulse";
export const LIVE_CALLER_HEADING_LAYER = "rc-live-caller-heading";
export const LIVE_CALLER_HIT_LAYER = "rc-live-caller-hit";

export const LIVE_CALLER_LAYER_IDS = [
  LIVE_CALLER_ACCURACY_FILL,
  LIVE_CALLER_ACCURACY_LINE,
  LIVE_CALLER_TRAIL_LAYER,
  LIVE_CALLER_PULSE_LAYER,
  LIVE_CALLER_HEADING_LAYER,
  LIVE_CALLER_HIT_LAYER,
] as const;

type StyleImageLike = {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
  onAdd?: () => void;
  onRemove?: () => void;
  render?: () => boolean;
  context?: CanvasRenderingContext2D | null;
};

type PulseImage = StyleImageLike;

function drawRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  alpha: number,
  rgb: [number, number, number],
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, alpha) * 0.35})`;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${Math.max(0, alpha)})`;
  ctx.stroke();
}

function createPulseImage(
  map: maplibregl.Map,
  opts: { animated: boolean; rgb: [number, number, number]; coreAlpha: number },
): PulseImage {
  const size = 128;
  const image: PulseImage = {
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
      const coreR = 13;

      if (opts.animated) {
        const duration = 2000;
        const t = (performance.now() % duration) / duration;
        const t2 = ((performance.now() + duration / 2) % duration) / duration;
        drawRing(ctx, cx, cy, coreR + t * 42, 1 - t, opts.rgb);
        drawRing(ctx, cx, cy, coreR + t2 * 42, 1 - t2, opts.rgb);
      }

      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${opts.rgb[0]}, ${opts.rgb[1]}, ${opts.rgb[2]}, ${opts.coreAlpha})`;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();

      this.data = ctx.getImageData(0, 0, size, size).data;
      if (opts.animated) {
        map.triggerRepaint();
        return true;
      }
      return false;
    },
  };
  return image;
}

function createHeadingImage(): StyleImageLike {
  const size = 64;
  if (typeof document === "undefined") {
    return { width: size, height: size, data: new Uint8Array(size * size * 4) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(10, 10);
    ctx.lineTo(0, 4);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fillStyle = "#e0f2fe";
    ctx.fill();
    ctx.strokeStyle = "#0369a1";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  return {
    width: size,
    height: size,
    data: ctx ? ctx.getImageData(0, 0, size, size).data : new Uint8Array(size * size * 4),
  };
}

function ensureLiveCallerImages(map: maplibregl.Map): void {
  if (!map.hasImage(LIVE_CALLER_PULSE_LIVE_ID)) {
    map.addImage(
      LIVE_CALLER_PULSE_LIVE_ID,
      createPulseImage(map, { animated: true, rgb: [14, 165, 233], coreAlpha: 1 }),
      { pixelRatio: 2 },
    );
  }
  if (!map.hasImage(LIVE_CALLER_PULSE_STALE_ID)) {
    map.addImage(
      LIVE_CALLER_PULSE_STALE_ID,
      createPulseImage(map, { animated: false, rgb: [125, 211, 252], coreAlpha: 0.72 }),
      { pixelRatio: 2 },
    );
  }
  if (!map.hasImage(LIVE_CALLER_PULSE_LOST_ID)) {
    map.addImage(
      LIVE_CALLER_PULSE_LOST_ID,
      createPulseImage(map, { animated: false, rgb: [100, 116, 139], coreAlpha: 0.85 }),
      { pixelRatio: 2 },
    );
  }
  if (!map.hasImage(LIVE_CALLER_HEADING_ID)) {
    map.addImage(LIVE_CALLER_HEADING_ID, createHeadingImage(), { pixelRatio: 2 });
  }
}

export function ensureLiveCallerOverlayLayers(map: maplibregl.Map): void {
  ensureLiveCallerImages(map);

  if (!map.getSource(LIVE_CALLER_ACCURACY_SOURCE)) {
    map.addSource(LIVE_CALLER_ACCURACY_SOURCE, { type: "geojson", data: EMPTY_OVERLAY_FC });
  }
  if (!map.getSource(LIVE_CALLER_TRAIL_SOURCE)) {
    map.addSource(LIVE_CALLER_TRAIL_SOURCE, { type: "geojson", data: EMPTY_OVERLAY_FC });
  }
  if (!map.getSource(LIVE_CALLER_SOURCE)) {
    map.addSource(LIVE_CALLER_SOURCE, { type: "geojson", data: EMPTY_OVERLAY_FC });
  }

  if (!map.getLayer(LIVE_CALLER_ACCURACY_FILL)) {
    addOverlayLayer(map, {
      id: LIVE_CALLER_ACCURACY_FILL,
      type: "fill",
      source: LIVE_CALLER_ACCURACY_SOURCE,
      paint: {
        "fill-color": [
          "match",
          ["get", "freshness"],
          "live",
          "rgba(14, 165, 233, 0.16)",
          "stale",
          "rgba(148, 163, 184, 0.12)",
          "rgba(100, 116, 139, 0.08)",
        ],
        "fill-opacity": 1,
      },
    });
  }

  if (!map.getLayer(LIVE_CALLER_ACCURACY_LINE)) {
    addOverlayLayer(map, {
      id: LIVE_CALLER_ACCURACY_LINE,
      type: "line",
      source: LIVE_CALLER_ACCURACY_SOURCE,
      paint: {
        "line-color": [
          "match",
          ["get", "freshness"],
          "live",
          "#38bdf8",
          "stale",
          "#94a3b8",
          "#64748b",
        ],
        "line-width": 1.5,
        "line-opacity": 0.85,
      },
    });
  }

  if (!map.getLayer(LIVE_CALLER_TRAIL_LAYER)) {
    addOverlayLayer(map, {
      id: LIVE_CALLER_TRAIL_LAYER,
      type: "line",
      source: LIVE_CALLER_TRAIL_SOURCE,
      paint: {
        "line-color": "#38bdf8",
        "line-width": 3,
        "line-opacity": 0.65,
        "line-dasharray": [1.2, 1.4],
      },
      layout: { visibility: "none" },
    });
  }

  if (!map.getLayer(LIVE_CALLER_PULSE_LAYER)) {
    addOverlayLayer(map, {
      id: LIVE_CALLER_PULSE_LAYER,
      type: "symbol",
      source: LIVE_CALLER_SOURCE,
      layout: {
        "icon-image": [
          "match",
          ["get", "freshness"],
          "live",
          LIVE_CALLER_PULSE_LIVE_ID,
          "stale",
          LIVE_CALLER_PULSE_STALE_ID,
          LIVE_CALLER_PULSE_LOST_ID,
        ],
        "icon-size": 0.55,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  }

  if (!map.getLayer(LIVE_CALLER_HEADING_LAYER)) {
    addOverlayLayer(map, {
      id: LIVE_CALLER_HEADING_LAYER,
      type: "symbol",
      source: LIVE_CALLER_SOURCE,
      filter: [">=", ["to-number", ["get", "headingDeg"]], 0],
      layout: {
        "icon-image": LIVE_CALLER_HEADING_ID,
        "icon-size": 0.55,
        "icon-rotate": ["to-number", ["get", "headingDeg"]],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-offset": [0, -18],
      },
    });
  }

  if (!map.getLayer(LIVE_CALLER_HIT_LAYER)) {
    addOverlayLayer(map, {
      id: LIVE_CALLER_HIT_LAYER,
      type: "circle",
      source: LIVE_CALLER_SOURCE,
      paint: {
        "circle-radius": 18,
        "circle-color": "#0ea5e9",
        "circle-opacity": 0,
      },
    });
  }
}

export function applyLiveCallerOverlayVisibility(
  map: maplibregl.Map,
  layers: Pick<RCMapLayerVisibility, "callerPin" | "callerTrail">,
): void {
  const live = layers.callerPin ? "visible" : "none";
  for (const id of LIVE_CALLER_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    const value = id === LIVE_CALLER_TRAIL_LAYER
      ? (layers.callerPin && layers.callerTrail ? "visible" : "none")
      : live;
    map.setLayoutProperty(id, "visibility", value);
  }
}

const resolvedByMap = new WeakMap<maplibregl.Map, Map<string, LiveCallerResolved>>();

export function setLiveCallerOverlayData(map: maplibregl.Map, callers: RCLiveCaller[], now = Date.now()): void {
  const resolved = callers.map((caller) => resolveLiveCaller(caller, now));
  resolvedByMap.set(map, new Map(resolved.map((item) => [item.id, item])));

  const points = map.getSource(LIVE_CALLER_SOURCE) as maplibregl.GeoJSONSource | undefined;
  const accuracy = map.getSource(LIVE_CALLER_ACCURACY_SOURCE) as maplibregl.GeoJSONSource | undefined;
  const trail = map.getSource(LIVE_CALLER_TRAIL_SOURCE) as maplibregl.GeoJSONSource | undefined;
  points?.setData(liveCallersToPointCollection(resolved));
  accuracy?.setData(liveCallersToAccuracyCollection(resolved));
  trail?.setData(liveCallersToTrailCollection(resolved));
}

export function restoreLiveCallerOverlay(
  map: maplibregl.Map,
  layers: Pick<RCMapLayerVisibility, "callerPin" | "callerTrail">,
  callers: RCLiveCaller[],
): void {
  ensureLiveCallerOverlayLayers(map);
  setLiveCallerOverlayData(map, callers);
  applyLiveCallerOverlayVisibility(map, layers);
}

type MapLayerMouseEvent = maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] };

const hoverPopupByMap = new WeakMap<maplibregl.Map, maplibregl.Popup>();
const enterByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const leaveByMap = new WeakMap<maplibregl.Map, () => void>();
const clickByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();

export function bindLiveCallerOverlayInteractions(
  map: maplibregl.Map,
  maplib: typeof maplibregl,
  onSelect: (caller: RCLiveCaller) => void,
): void {
  const prevEnter = enterByMap.get(map);
  const prevLeave = leaveByMap.get(map);
  const prevClick = clickByMap.get(map);
  if (prevEnter) map.off("mouseenter", LIVE_CALLER_HIT_LAYER, prevEnter);
  if (prevLeave) map.off("mouseleave", LIVE_CALLER_HIT_LAYER, prevLeave);
  if (prevClick) map.off("click", LIVE_CALLER_HIT_LAYER, prevClick);

  const lookup = (event: MapLayerMouseEvent): LiveCallerResolved | null => {
    const id = String(event.features?.[0]?.properties?.id ?? "");
    if (!id) return null;
    return resolvedByMap.get(map)?.get(id) ?? null;
  };

  const onEnter = (event: MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = "pointer";
    const caller = lookup(event);
    const feature = event.features?.[0];
    if (!caller || !feature || feature.geometry.type !== "Point") return;
    const coords = feature.geometry.coordinates as [number, number];
    hoverPopupByMap.get(map)?.remove();
    const popup = new maplib.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 22,
      maxWidth: "320px",
      className: "rc-map-popup",
    })
      .setLngLat(coords)
      .setHTML(buildLiveCallerHoverHTML(caller))
      .addTo(map);
    hoverPopupByMap.set(map, popup);
  };

  const onLeave = () => {
    map.getCanvas().style.cursor = "";
    hoverPopupByMap.get(map)?.remove();
    hoverPopupByMap.delete(map);
  };

  const onClick = (event: MapLayerMouseEvent) => {
    const caller = lookup(event);
    if (caller) onSelect(caller);
  };

  enterByMap.set(map, onEnter);
  leaveByMap.set(map, onLeave);
  clickByMap.set(map, onClick);
  map.on("mouseenter", LIVE_CALLER_HIT_LAYER, onEnter);
  map.on("mouseleave", LIVE_CALLER_HIT_LAYER, onLeave);
  map.on("click", LIVE_CALLER_HIT_LAYER, onClick);
}
