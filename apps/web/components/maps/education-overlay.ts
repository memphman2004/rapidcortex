"use client";

/**
 * Dynamic schools/campuses overlay — Amazon Location Places V2 SearchNearby.
 * Results are not stored; each viewport query uses IntendedUse SingleUse.
 */

import type maplibregl from "maplibre-gl";
import {
  isEducationMapFeatureCollection,
  type EducationGeoJsonProperties,
  type EducationMapFeatureCollection,
  type EducationType,
} from "rapid-cortex-shared";
import { MAP_TOKENS as T } from "./map-constants";
import { EMPTY_OVERLAY_FC } from "./runtime-overlays";
import { addOverlayLayer } from "./overlay-slot";

export const EDUCATION_ICON_ID = "education-icon";
export const EDUCATION_ICON_URL = "/map-icons/education.png";

export const EDUCATION_SOURCE_ID = "education";
export const EDUCATION_CLUSTERS = "education-clusters";
export const EDUCATION_CLUSTER_COUNT = "education-cluster-count";
export const EDUCATION_POINTS = "education-points";

export const EDUCATION_OVERLAY_LAYER_IDS = [
  EDUCATION_CLUSTERS,
  EDUCATION_CLUSTER_COUNT,
  EDUCATION_POINTS,
] as const;

export const MIN_EDUCATION_ZOOM = 8;
export const EDUCATION_FETCH_DEBOUNCE_MS = 500;
export const EDUCATION_CACHE_TTL_MS = 5 * 60 * 1000;

export const EDUCATION_UNAVAILABLE_MESSAGE = "Schools / Campuses are temporarily unavailable.";
export const EDUCATION_ZOOM_HINT = "Zoom in to view schools and campuses.";

export type EducationLayerState = {
  visible: boolean;
  zoom: number;
};

type MapLayerMouseEvent = maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] };

export type EducationSelectHandler = (
  props: EducationGeoJsonProperties,
  coordinates: [number, number],
) => void;

export type EducationOverlayHint = "zoom" | "error" | null;

const hoverPopupByMap = new WeakMap<maplibregl.Map, maplibregl.Popup>();
const selectHandlerByMap = new WeakMap<maplibregl.Map, EducationSelectHandler>();
const lastDataByMap = new WeakMap<maplibregl.Map, EducationMapFeatureCollection>();
const pointEnterByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const pointLeaveByMap = new WeakMap<maplibregl.Map, () => void>();
const pointClickByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const clusterClickByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const clusterEnterByMap = new WeakMap<maplibregl.Map, () => void>();
const clusterLeaveByMap = new WeakMap<maplibregl.Map, () => void>();

type EducationCacheEntry = { expiresAt: number; data: EducationMapFeatureCollection };
const educationCache = new Map<string, EducationCacheEntry>();

function firstSymbolFont(map: maplibregl.Map): string[] {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== "symbol") continue;
    const font = (layer.layout as { "text-font"?: string[] } | undefined)?.["text-font"];
    if (Array.isArray(font) && font.length > 0) return font;
  }
  return ["Noto Sans Regular"];
}

export function shouldFetchEducationLayer(zoom: number): boolean {
  return zoom >= MIN_EDUCATION_ZOOM;
}

export function educationViewportCacheKey(opts: {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
  fromLat?: number;
  fromLng?: number;
}): string {
  const round = (value: number, digits = 3) => value.toFixed(digits);
  const origin =
    opts.fromLat != null && opts.fromLng != null
      ? `|${round(opts.fromLng)}|${round(opts.fromLat)}`
      : "";
  return `${round(opts.west)}:${round(opts.south)}:${round(opts.east)}:${round(opts.north)}:${Math.floor(opts.zoom)}${origin}`;
}

export function educationPropsFromFeature(
  properties: GeoJSON.GeoJsonProperties | null | undefined,
): EducationGeoJsonProperties {
  const rec = properties ?? {};
  const typeRaw = typeof rec.educationType === "string" ? rec.educationType : "school";
  const educationType: EducationType =
    typeRaw === "higher_education" ||
    typeRaw === "secondary_school" ||
    typeRaw === "primary_school" ||
    typeRaw === "school"
      ? typeRaw
      : "school";
  const distanceMetersRaw = rec.distanceMeters;
  const distanceMeters =
    typeof distanceMetersRaw === "number"
      ? distanceMetersRaw
      : typeof distanceMetersRaw === "string" && distanceMetersRaw.trim()
        ? Number(distanceMetersRaw)
        : null;
  return {
    id: typeof rec.id === "string" ? rec.id : "",
    name: typeof rec.name === "string" ? rec.name : "School",
    educationType,
    educationLabel: typeof rec.educationLabel === "string" ? rec.educationLabel : "School",
    address: typeof rec.address === "string" ? rec.address : "",
    city: typeof rec.city === "string" ? rec.city : "",
    state: typeof rec.state === "string" ? rec.state : "",
    phone: typeof rec.phone === "string" ? rec.phone : "",
    website: typeof rec.website === "string" ? rec.website : "",
    distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
    distance: typeof rec.distance === "string" ? rec.distance : "",
  };
}

export type EducationHoverContent = {
  title: string;
  type: string;
  addressLines: string[];
  distance: string;
};

export function educationHoverContent(props: EducationGeoJsonProperties): EducationHoverContent {
  const addressLines: string[] = [];
  if (props.address.trim()) addressLines.push(props.address.trim());
  const cityState = [props.city.trim(), props.state.trim()].filter(Boolean).join(", ");
  if (cityState && !props.address.toLowerCase().includes(cityState.toLowerCase())) {
    addressLines.push(cityState);
  }
  const distance = props.distance.trim() ? `${props.distance.trim()} away` : "";
  return {
    title: (props.name || "School").toUpperCase(),
    type: props.educationLabel.trim(),
    addressLines,
    distance,
  };
}

function applyHoverCardStyles(root: HTMLElement): void {
  root.style.background = T.popup_bg;
  root.style.border = `1px solid ${T.border}`;
  root.style.borderTop = "3px solid #dc2626";
  root.style.borderRadius = "6px";
  root.style.padding = "10px 12px";
  root.style.minWidth = "200px";
  root.style.maxWidth = "280px";
  root.style.fontFamily = "system-ui,-apple-system,sans-serif";
}

export function fillEducationHoverElement(
  root: HTMLElement,
  props: EducationGeoJsonProperties,
): HTMLElement {
  root.replaceChildren();
  applyHoverCardStyles(root);
  const content = educationHoverContent(props);

  const title = root.ownerDocument.createElement("div");
  title.style.fontSize = "13px";
  title.style.fontWeight = "700";
  title.style.color = T.text;
  title.style.marginBottom = "2px";
  title.textContent = content.title;
  root.appendChild(title);

  if (content.type) {
    const type = root.ownerDocument.createElement("div");
    type.style.fontSize = "11px";
    type.style.fontWeight = "600";
    type.style.color = "#93c5fd";
    type.style.marginBottom = "6px";
    type.textContent = content.type;
    root.appendChild(type);
  }

  for (const line of content.addressLines) {
    const row = root.ownerDocument.createElement("div");
    row.style.fontSize = "11px";
    row.style.color = "#94a3b8";
    row.style.lineHeight = "1.35";
    row.textContent = line;
    root.appendChild(row);
  }

  if (content.distance) {
    const distance = root.ownerDocument.createElement("div");
    distance.style.fontSize = "11px";
    distance.style.color = "#67e8f9";
    distance.style.marginTop = "6px";
    distance.textContent = content.distance;
    root.appendChild(distance);
  }

  return root;
}

async function ensureEducationIcon(map: maplibregl.Map): Promise<boolean> {
  if (map.hasImage(EDUCATION_ICON_ID)) return true;
  try {
    const image = await map.loadImage(EDUCATION_ICON_URL);
    if (map.hasImage(EDUCATION_ICON_ID)) return true;
    map.addImage(EDUCATION_ICON_ID, image.data, { pixelRatio: 2 });
    return true;
  } catch {
    return false;
  }
}

export async function ensureEducationOverlayLayers(map: maplibregl.Map): Promise<void> {
  const hasIcon = await ensureEducationIcon(map);

  if (!map.getSource(EDUCATION_SOURCE_ID)) {
    map.addSource(EDUCATION_SOURCE_ID, {
      type: "geojson",
      data: lastDataByMap.get(map) ?? EMPTY_OVERLAY_FC,
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 45,
    });
  }

  if (!map.getLayer(EDUCATION_CLUSTERS)) {
    addOverlayLayer(map, {
      id: EDUCATION_CLUSTERS,
      type: "circle",
      source: EDUCATION_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#1d4ed8",
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 25],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#1e3a8a",
        "circle-opacity": 0.92,
      },
    });
  }

  if (!map.getLayer(EDUCATION_CLUSTER_COUNT)) {
    try {
      addOverlayLayer(map, {
        id: EDUCATION_CLUSTER_COUNT,
        type: "symbol",
        source: EDUCATION_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 12,
          "text-font": firstSymbolFont(map),
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#eff6ff",
          "text-halo-color": "#1d4ed8",
          "text-halo-width": 0.4,
        },
      });
    } catch {
      /* glyph set in the ALS style may not include the chosen font */
    }
  }

  if (!map.getLayer(EDUCATION_POINTS)) {
    if (hasIcon) {
      addOverlayLayer(map, {
        id: EDUCATION_POINTS,
        type: "symbol",
        source: EDUCATION_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": EDUCATION_ICON_ID,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.32, 11, 0.45, 14, 0.6, 16, 0.72],
          "icon-allow-overlap": false,
          "icon-ignore-placement": false,
        },
      });
    } else {
      addOverlayLayer(map, {
        id: EDUCATION_POINTS,
        type: "circle",
        source: EDUCATION_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#1d4ed8",
          "circle-radius": 7,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#eff6ff",
        },
      });
    }
  }
}

export function applyEducationOverlayVisibility(map: maplibregl.Map, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of EDUCATION_OVERLAY_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", value);
  }
}

export function setEducationOverlayData(map: maplibregl.Map, data: GeoJSON.FeatureCollection): void {
  if (data.type === "FeatureCollection") {
    lastDataByMap.set(map, data as EducationMapFeatureCollection);
  }
  const source = map.getSource(EDUCATION_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data);
}

export function lastEducationOverlayData(map: maplibregl.Map): EducationMapFeatureCollection {
  return lastDataByMap.get(map) ?? { type: "FeatureCollection", features: [] };
}

export async function loadEducationOverlay(
  opts: {
    centerLat: number;
    centerLng: number;
    west?: number;
    south?: number;
    east?: number;
    north?: number;
    radiusMeters?: number;
    fromLat?: number;
    fromLng?: number;
    zoom?: number;
  },
  signal?: AbortSignal,
): Promise<{ ok: true; data: EducationMapFeatureCollection } | { ok: false; aborted: boolean }> {
  const cacheKey =
    opts.west != null && opts.south != null && opts.east != null && opts.north != null
      ? educationViewportCacheKey({
          west: opts.west,
          south: opts.south,
          east: opts.east,
          north: opts.north,
          zoom: opts.zoom ?? MIN_EDUCATION_ZOOM,
          fromLat: opts.fromLat,
          fromLng: opts.fromLng,
        })
      : `center:${opts.centerLng.toFixed(3)}:${opts.centerLat.toFixed(3)}:${opts.radiusMeters ?? ""}`;
  const cached = educationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, data: cached.data };
  }

  const qs = new URLSearchParams({
    centerLat: String(opts.centerLat),
    centerLng: String(opts.centerLng),
  });
  if (opts.west != null && opts.south != null && opts.east != null && opts.north != null) {
    qs.set("west", String(opts.west));
    qs.set("south", String(opts.south));
    qs.set("east", String(opts.east));
    qs.set("north", String(opts.north));
  } else if (opts.radiusMeters != null) {
    qs.set("radiusMeters", String(opts.radiusMeters));
  }
  if (opts.fromLat != null && opts.fromLng != null) {
    qs.set("fromLat", String(opts.fromLat));
    qs.set("fromLng", String(opts.fromLng));
  }

  try {
    const res = await fetch(`/api/map/education?${qs.toString()}`, {
      credentials: "include",
      signal,
    });
    if (!res.ok) return { ok: false, aborted: false };
    const body: unknown = await res.json();
    if (!isEducationMapFeatureCollection(body)) return { ok: false, aborted: false };
    educationCache.set(cacheKey, { expiresAt: Date.now() + EDUCATION_CACHE_TTL_MS, data: body });
    return { ok: true, data: body };
  } catch (err) {
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      return { ok: false, aborted: true };
    }
    return { ok: false, aborted: false };
  }
}

export function educationDirectionsUrl(lng: number, lat: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function educationWebsiteHref(website: string): string {
  const trimmed = website.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
}

export function educationTelHref(phone: string): string {
  const trimmed = phone.replace(/[^\d+]/g, "");
  return trimmed ? `tel:${trimmed}` : "";
}

export function bindEducationOverlayInteractions(
  map: maplibregl.Map,
  maplib: typeof maplibregl,
  onSelect?: EducationSelectHandler,
): void {
  if (onSelect) selectHandlerByMap.set(map, onSelect);

  const prevEnter = pointEnterByMap.get(map);
  const prevLeave = pointLeaveByMap.get(map);
  const prevClick = pointClickByMap.get(map);
  const prevClusterClick = clusterClickByMap.get(map);
  const prevClusterEnter = clusterEnterByMap.get(map);
  const prevClusterLeave = clusterLeaveByMap.get(map);
  if (prevEnter) map.off("mouseenter", EDUCATION_POINTS, prevEnter);
  if (prevLeave) map.off("mouseleave", EDUCATION_POINTS, prevLeave);
  if (prevClick) map.off("click", EDUCATION_POINTS, prevClick);
  if (prevClusterClick) map.off("click", EDUCATION_CLUSTERS, prevClusterClick);
  if (prevClusterEnter) map.off("mouseenter", EDUCATION_CLUSTERS, prevClusterEnter);
  if (prevClusterLeave) map.off("mouseleave", EDUCATION_CLUSTERS, prevClusterLeave);

  const onPointEnter = (event: MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = "pointer";
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const coords = feature.geometry.coordinates as [number, number];
    const props = educationPropsFromFeature(feature.properties);
    hoverPopupByMap.get(map)?.remove();
    const node = fillEducationHoverElement(document.createElement("div"), props);
    const popup = new maplib.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: "300px",
      className: "rc-map-popup education-hover-popup",
    })
      .setLngLat(coords)
      .setDOMContent(node)
      .addTo(map);
    hoverPopupByMap.set(map, popup);
  };

  const onPointLeave = () => {
    map.getCanvas().style.cursor = "";
    hoverPopupByMap.get(map)?.remove();
    hoverPopupByMap.delete(map);
  };

  const onPointClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const coords = feature.geometry.coordinates as [number, number];
    selectHandlerByMap.get(map)?.(educationPropsFromFeature(feature.properties), coords);
  };

  const onClusterClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id as number | undefined;
    if (clusterId == null || feature?.geometry.type !== "Point") return;
    const source = map.getSource(EDUCATION_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
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
  pointClickByMap.set(map, onPointClick);
  clusterClickByMap.set(map, onClusterClick);
  clusterEnterByMap.set(map, onClusterEnter);
  clusterLeaveByMap.set(map, onClusterLeave);

  map.on("mouseenter", EDUCATION_POINTS, onPointEnter);
  map.on("mouseleave", EDUCATION_POINTS, onPointLeave);
  map.on("click", EDUCATION_POINTS, onPointClick);
  map.on("click", EDUCATION_CLUSTERS, onClusterClick);
  map.on("mouseenter", EDUCATION_CLUSTERS, onClusterEnter);
  map.on("mouseleave", EDUCATION_CLUSTERS, onClusterLeave);
}

export function teardownEducationOverlay(map: maplibregl.Map): void {
  hoverPopupByMap.get(map)?.remove();
  hoverPopupByMap.delete(map);
  const prevEnter = pointEnterByMap.get(map);
  const prevLeave = pointLeaveByMap.get(map);
  const prevClick = pointClickByMap.get(map);
  const prevClusterClick = clusterClickByMap.get(map);
  const prevClusterEnter = clusterEnterByMap.get(map);
  const prevClusterLeave = clusterLeaveByMap.get(map);
  if (prevEnter) map.off("mouseenter", EDUCATION_POINTS, prevEnter);
  if (prevLeave) map.off("mouseleave", EDUCATION_POINTS, prevLeave);
  if (prevClick) map.off("click", EDUCATION_POINTS, prevClick);
  if (prevClusterClick) map.off("click", EDUCATION_CLUSTERS, prevClusterClick);
  if (prevClusterEnter) map.off("mouseenter", EDUCATION_CLUSTERS, prevClusterEnter);
  if (prevClusterLeave) map.off("mouseleave", EDUCATION_CLUSTERS, prevClusterLeave);
}
