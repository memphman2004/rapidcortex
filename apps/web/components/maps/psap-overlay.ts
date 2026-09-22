"use client";

/**
 * National PSAP overlay for Amazon Location Maps V2 / MapLibre.
 * Custom icon + clustered GeoJSON — not baked into the basemap.
 */

import type maplibregl from "maplibre-gl";
import {
  isPsapMapFeatureCollection,
  type PsapMapFeatureCollection,
  type PsapMapFeatureProperties,
} from "rapid-cortex-shared";
import { EMPTY_OVERLAY_FC } from "./runtime-overlays";
import { addOverlayLayer, firstSymbolFont } from "./overlay-slot";

export const PSAP_ICON_ID = "psap-icon";
export const PSAP_ICON_URL = "/map-icons/psap.png";

export const OVERLAY_PSAPS_SOURCE = "rc-overlay-psaps";
export const OVERLAY_PSAPS_POINTS = "rc-overlay-psaps-points";
export const OVERLAY_PSAPS_CLUSTERS = "rc-overlay-psaps-clusters";
export const OVERLAY_PSAPS_CLUSTER_COUNT = "rc-overlay-psaps-cluster-count";

export const PSAP_OVERLAY_LAYER_IDS = [
  OVERLAY_PSAPS_CLUSTERS,
  OVERLAY_PSAPS_CLUSTER_COUNT,
  OVERLAY_PSAPS_POINTS,
] as const;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildPsapPopupHTML(
  props: Partial<PsapMapFeatureProperties> & { statusLabel?: string },
): string {
  const name = escapeHtml(props.name?.trim() || "PSAP");
  const city = props.city?.trim() ?? "";
  const state = props.state?.trim() ?? "";
  const county = props.county?.trim() ?? "";
  const cad = props.cadVendor?.trim() ?? "";
  const psapType = props.psapType?.trim() ?? "";
  const phone = props.phone?.trim() ?? "";
  const statusLabel = props.statusLabel?.trim() ?? "";
  const place = [city, state].filter(Boolean).join(", ");
  const meta: string[] = [];
  if (county) meta.push(`County: ${escapeHtml(county)}`);
  if (psapType) meta.push(escapeHtml(psapType));
  if (cad) meta.push(`CAD: ${escapeHtml(cad)}`);
  if (phone) meta.push(escapeHtml(phone));
  if (statusLabel) meta.push(escapeHtml(statusLabel));

  return `
    <div style="
      background:#0f0d1c;
      border:1px solid #1e1a30;
      border-top:3px solid #eab308;
      border-radius:6px;
      padding:10px 12px;
      min-width:200px;
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <div style="font-size:10px;font-weight:700;color:#eab308;letter-spacing:.06em;margin-bottom:4px">PSAP</div>
      <div style="font-size:13px;font-weight:700;color:#e4dff5;margin-bottom:2px">${name}</div>
      ${place ? `<div style="font-size:11px;color:#94a3b8">${escapeHtml(place)}</div>` : ""}
      ${meta.length ? `<div style="font-size:11px;color:#9ca3af;margin-top:6px;line-height:1.45">${meta.join("<br/>")}</div>` : ""}
    </div>
  `;
}

async function ensurePsapIcon(map: maplibregl.Map): Promise<boolean> {
  if (map.hasImage(PSAP_ICON_ID)) return true;
  try {
    const image = await map.loadImage(PSAP_ICON_URL);
    if (map.hasImage(PSAP_ICON_ID)) return true;
    map.addImage(PSAP_ICON_ID, image.data, { pixelRatio: 2 });
    return true;
  } catch {
    return false;
  }
}

export async function ensurePsapOverlayLayers(map: maplibregl.Map): Promise<void> {
  const hasIcon = await ensurePsapIcon(map);

  if (!map.getSource(OVERLAY_PSAPS_SOURCE)) {
    map.addSource(OVERLAY_PSAPS_SOURCE, {
      type: "geojson",
      data: EMPTY_OVERLAY_FC,
      cluster: true,
      clusterMaxZoom: 10,
      clusterRadius: 45,
    });
  }

  if (!map.getLayer(OVERLAY_PSAPS_CLUSTERS)) {
    addOverlayLayer(map, {
      id: OVERLAY_PSAPS_CLUSTERS,
      type: "circle",
      source: OVERLAY_PSAPS_SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#eab308",
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 25],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#422006",
        "circle-opacity": 0.92,
      },
    });
  }

  if (!map.getLayer(OVERLAY_PSAPS_CLUSTER_COUNT)) {
    try {
      addOverlayLayer(map, {
        id: OVERLAY_PSAPS_CLUSTER_COUNT,
        type: "symbol",
        source: OVERLAY_PSAPS_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": firstSymbolFont(map),
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#1c1917",
          "text-halo-color": "#facc15",
          "text-halo-width": 0.4,
        },
      });
    } catch {
      /* glyph set in the ALS style may not include the chosen font */
    }
  }

  if (!map.getLayer(OVERLAY_PSAPS_POINTS)) {
    let added = false;
    if (hasIcon) {
      try {
        addOverlayLayer(map, {
          id: OVERLAY_PSAPS_POINTS,
          type: "symbol",
          source: OVERLAY_PSAPS_SOURCE,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": PSAP_ICON_ID,
            "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.45, 10, 0.7, 15, 0.95],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
        added = true;
      } catch {
        /* ALS style may reject mixed icon+glyph specs */
      }
    }
    if (!added) {
      addOverlayLayer(map, {
        id: OVERLAY_PSAPS_POINTS,
        type: "circle",
        source: OVERLAY_PSAPS_SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#eab308",
          "circle-radius": 7,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0f1117",
        },
      });
    }
  }
}

export function applyPsapOverlayVisibility(map: maplibregl.Map, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of PSAP_OVERLAY_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", value);
  }
}

export function setPsapOverlayData(map: maplibregl.Map, data: GeoJSON.FeatureCollection): void {
  const source = map.getSource(OVERLAY_PSAPS_SOURCE) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data);
}

const overlayCache = new Map<string, PsapMapFeatureCollection>();

export async function loadPsapOverlay(): Promise<PsapMapFeatureCollection> {
  const cached = overlayCache.get("psaps");
  if (cached) return cached;
  const empty: PsapMapFeatureCollection = { type: "FeatureCollection", features: [] };
  try {
    const res = await fetch("/api/map/psaps", { credentials: "include" });
    if (!res.ok) return empty;
    const body: unknown = await res.json();
    if (!isPsapMapFeatureCollection(body)) return empty;
    overlayCache.set("psaps", body);
    return body;
  } catch {
    return empty;
  }
}

export function clearPsapOverlayCache(): void {
  overlayCache.clear();
}

type MapLayerMouseEvent = maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] };

const hoverPopupByMap = new WeakMap<maplibregl.Map, maplibregl.Popup>();
const pointEnterByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const pointLeaveByMap = new WeakMap<maplibregl.Map, () => void>();
const clusterClickByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const clusterEnterByMap = new WeakMap<maplibregl.Map, () => void>();
const clusterLeaveByMap = new WeakMap<maplibregl.Map, () => void>();

export function bindPsapOverlayInteractions(
  map: maplibregl.Map,
  maplib: typeof maplibregl,
): void {
  const prevEnter = pointEnterByMap.get(map);
  const prevLeave = pointLeaveByMap.get(map);
  const prevClusterClick = clusterClickByMap.get(map);
  const prevClusterEnter = clusterEnterByMap.get(map);
  const prevClusterLeave = clusterLeaveByMap.get(map);
  if (prevEnter) map.off("mouseenter", OVERLAY_PSAPS_POINTS, prevEnter);
  if (prevLeave) map.off("mouseleave", OVERLAY_PSAPS_POINTS, prevLeave);
  if (prevClusterClick) map.off("click", OVERLAY_PSAPS_CLUSTERS, prevClusterClick);
  if (prevClusterEnter) map.off("mouseenter", OVERLAY_PSAPS_CLUSTERS, prevClusterEnter);
  if (prevClusterLeave) map.off("mouseleave", OVERLAY_PSAPS_CLUSTERS, prevClusterLeave);

  const onPointEnter = (event: MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = "pointer";
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const coords = feature.geometry.coordinates as [number, number];
    const props = (feature.properties ?? {}) as Partial<PsapMapFeatureProperties>;
    hoverPopupByMap.get(map)?.remove();
    const popup = new maplib.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: "280px",
      className: "rc-map-popup",
    })
      .setLngLat(coords)
      .setHTML(buildPsapPopupHTML(props))
      .addTo(map);
    hoverPopupByMap.set(map, popup);
  };

  const onPointLeave = () => {
    map.getCanvas().style.cursor = "";
    hoverPopupByMap.get(map)?.remove();
    hoverPopupByMap.delete(map);
  };

  const onClusterClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id as number | undefined;
    if (clusterId == null || feature?.geometry.type !== "Point") return;
    const source = map.getSource(OVERLAY_PSAPS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source?.getClusterExpansionZoom) return;
    const coords = feature.geometry.coordinates as [number, number];
    void source.getClusterExpansionZoom(clusterId).then((zoom) => {
      if (zoom == null) return;
      map.easeTo({ center: coords, zoom });
    });
  };

  const onClusterEnter = () => {
    map.getCanvas().style.cursor = "pointer";
  };
  const onClusterLeave = () => {
    map.getCanvas().style.cursor = "";
  };

  pointEnterByMap.set(map, onPointEnter);
  pointLeaveByMap.set(map, onPointLeave);
  clusterClickByMap.set(map, onClusterClick);
  clusterEnterByMap.set(map, onClusterEnter);
  clusterLeaveByMap.set(map, onClusterLeave);

  map.on("mouseenter", OVERLAY_PSAPS_POINTS, onPointEnter);
  map.on("mouseleave", OVERLAY_PSAPS_POINTS, onPointLeave);
  map.on("click", OVERLAY_PSAPS_CLUSTERS, onClusterClick);
  map.on("mouseenter", OVERLAY_PSAPS_CLUSTERS, onClusterEnter);
  map.on("mouseleave", OVERLAY_PSAPS_CLUSTERS, onClusterLeave);
}
