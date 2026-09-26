"use client";

/**
 * Dynamic hospital overlay — Amazon Location Places V2 SearchNearby.
 * Results are not stored; each viewport query uses IntendedUse SingleUse.
 */

import type * as maplibregl from "maplibre-gl";
import {
  filterHospitalFeatures,
  isHospitalMapFeatureCollection,
  type AlsHospitalFeatureProperties,
  type AlsHospitalMapFeatureCollection,
} from "rapid-cortex-shared";
import { EMPTY_OVERLAY_FC } from "./runtime-overlays";
import { addOverlayLayer, firstSymbolFont } from "./overlay-slot";

export const HOSPITAL_ICON_ID = "hospital-icon";
export const HOSPITAL_ICON_URL = "/map-icons/hospital.png";

export const OVERLAY_HOSPITALS_SOURCE = "rc-overlay-hospitals";
export const OVERLAY_HOSPITALS_POINTS = "rc-overlay-hospitals-points";
export const OVERLAY_HOSPITALS_CLUSTERS = "rc-overlay-hospitals-clusters";
export const OVERLAY_HOSPITALS_CLUSTER_COUNT = "rc-overlay-hospitals-cluster-count";

export const HOSPITAL_OVERLAY_LAYER_IDS = [
  OVERLAY_HOSPITALS_CLUSTERS,
  OVERLAY_HOSPITALS_CLUSTER_COUNT,
  OVERLAY_HOSPITALS_POINTS,
] as const;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function hospitalPropsFromFeature(
  properties: GeoJSON.GeoJsonProperties | null | undefined,
): AlsHospitalFeatureProperties {
  const rec = properties ?? {};
  const emergency = rec.emergencyRoom;
  return {
    id: typeof rec.id === "string" ? rec.id : "",
    name: typeof rec.name === "string" ? rec.name : "Medical",
    category: typeof rec.category === "string" ? rec.category : "hospital",
    emergencyRoom: emergency === true || emergency === "true" || emergency === 1,
    address: typeof rec.address === "string" ? rec.address : "",
    phone: typeof rec.phone === "string" ? rec.phone : "",
    distance: typeof rec.distance === "string" ? rec.distance : "",
    distanceMiles: typeof rec.distanceMiles === "number" ? rec.distanceMiles : Number(rec.distanceMiles) || 0,
  };
}

export function buildHospitalHoverHTML(props: AlsHospitalFeatureProperties): string {
  const name = escapeHtml(props.name || "Medical");
  const address = escapeHtml(props.address);
  const phone = escapeHtml(props.phone);
  const distance = escapeHtml(props.distance);
  return `
    <div class="hospital-hover-card" style="
      background:#0f0d1c;
      border:1px solid #1e1a30;
      border-top:3px solid #60a5fa;
      border-radius:6px;
      padding:10px 12px;
      min-width:200px;
      max-width:280px;
      font-family:system-ui,-apple-system,sans-serif;
    ">
      <div class="hospital-hover-title" style="font-size:13px;font-weight:700;color:#e4dff5;margin-bottom:2px">${name}</div>
      ${address ? `<div class="hospital-hover-address" style="font-size:11px;color:#94a3b8">${address}</div>` : ""}
      ${
        props.emergencyRoom
          ? `<div class="hospital-hover-er" style="font-size:11px;font-weight:600;color:#93c5fd;margin-top:6px">Emergency Department</div>`
          : ""
      }
      ${phone ? `<div class="hospital-hover-phone" style="font-size:11px;color:#9ca3af;margin-top:4px">${phone}</div>` : ""}
      ${distance ? `<div class="hospital-hover-distance" style="font-size:11px;color:#67e8f9;margin-top:4px">${distance}</div>` : ""}
    </div>
  `;
}

async function ensureHospitalIcon(map: maplibregl.Map): Promise<boolean> {
  if (map.hasImage(HOSPITAL_ICON_ID)) return true;
  try {
    const image = await map.loadImage(HOSPITAL_ICON_URL);
    if (map.hasImage(HOSPITAL_ICON_ID)) return true;
    map.addImage(HOSPITAL_ICON_ID, image.data, { pixelRatio: 2 });
    return true;
  } catch {
    return false;
  }
}

export async function ensureHospitalOverlayLayers(map: maplibregl.Map): Promise<void> {
  const hasIcon = await ensureHospitalIcon(map);

  if (!map.getSource(OVERLAY_HOSPITALS_SOURCE)) {
    map.addSource(OVERLAY_HOSPITALS_SOURCE, {
      type: "geojson",
      data: EMPTY_OVERLAY_FC,
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 45,
    });
  }

  if (!map.getLayer(OVERLAY_HOSPITALS_CLUSTERS)) {
    addOverlayLayer(map, {
      id: OVERLAY_HOSPITALS_CLUSTERS,
      type: "circle",
      source: OVERLAY_HOSPITALS_SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#2563eb",
        "circle-radius": ["step", ["get", "point_count"], 11, 10, 14, 50, 18],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#1e3a8a",
        "circle-opacity": 0.92,
      },
    });
  }

  if (!map.getLayer(OVERLAY_HOSPITALS_CLUSTER_COUNT)) {
    try {
      addOverlayLayer(map, {
        id: OVERLAY_HOSPITALS_CLUSTER_COUNT,
        type: "symbol",
        source: OVERLAY_HOSPITALS_SOURCE,
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

  if (!map.getLayer(OVERLAY_HOSPITALS_POINTS)) {
    if (hasIcon) {
      addOverlayLayer(map, {
        id: OVERLAY_HOSPITALS_POINTS,
        type: "symbol",
        source: OVERLAY_HOSPITALS_SOURCE,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": HOSPITAL_ICON_ID,
          "icon-size": ["interpolate", ["linear"], ["zoom"], 8, 0.18, 12, 0.28, 16, 0.38],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
    } else {
      addOverlayLayer(map, {
        id: OVERLAY_HOSPITALS_POINTS,
        type: "circle",
        source: OVERLAY_HOSPITALS_SOURCE,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#2563eb",
          "circle-radius": 7,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#eff6ff",
        },
      });
    }
  }
}

export function applyHospitalOverlayVisibility(map: maplibregl.Map, visible: boolean): void {
  const value = visible ? "visible" : "none";
  for (const id of HOSPITAL_OVERLAY_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", value);
  }
}

export function setHospitalOverlayData(map: maplibregl.Map, data: GeoJSON.FeatureCollection): void {
  const source = map.getSource(OVERLAY_HOSPITALS_SOURCE) as maplibregl.GeoJSONSource | undefined;
  source?.setData(data);
}

export function radiusMetersFromMap(map: maplibregl.Map): number {
  const bounds = map.getBounds();
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const dLat = ne.lat - sw.lat;
  const dLng = ne.lng - sw.lng;
  const miles = Math.sqrt(dLat * dLat + dLng * dLng) * 69;
  const meters = (miles / 2) * 1609.34;
  return Math.min(50_000, Math.max(5_000, Math.round(meters)));
}

export async function loadHospitalOverlay(opts: {
  lat: number;
  lng: number;
  radius: number;
  fromLat?: number;
  fromLng?: number;
}): Promise<AlsHospitalMapFeatureCollection> {
  const qs = new URLSearchParams({
    lat: String(opts.lat),
    lng: String(opts.lng),
    radius: String(opts.radius),
  });
  if (opts.fromLat != null && opts.fromLng != null) {
    qs.set("fromLat", String(opts.fromLat));
    qs.set("fromLng", String(opts.fromLng));
  }
  try {
    const res = await fetch(`/api/map/hospitals?${qs.toString()}`, { credentials: "include" });
    if (!res.ok) return { type: "FeatureCollection", features: [] };
    const body: unknown = await res.json();
    if (!isHospitalMapFeatureCollection(body)) return { type: "FeatureCollection", features: [] };
    return body;
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

export function visibleHospitalCollection(
  data: AlsHospitalMapFeatureCollection,
  layers: { hospitals: boolean; emergencyRooms: boolean },
): AlsHospitalMapFeatureCollection {
  return filterHospitalFeatures(data, layers);
}

type MapLayerMouseEvent = maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] };

export type HospitalSelectHandler = (
  props: AlsHospitalFeatureProperties,
  coordinates: [number, number],
) => void;

const hoverPopupByMap = new WeakMap<maplibregl.Map, maplibregl.Popup>();
const selectHandlerByMap = new WeakMap<maplibregl.Map, HospitalSelectHandler>();
const pointEnterByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const pointLeaveByMap = new WeakMap<maplibregl.Map, () => void>();
const pointClickByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const clusterClickByMap = new WeakMap<maplibregl.Map, (event: MapLayerMouseEvent) => void>();
const clusterEnterByMap = new WeakMap<maplibregl.Map, () => void>();
const clusterLeaveByMap = new WeakMap<maplibregl.Map, () => void>();

export function hospitalFacilityLabel(category: string, emergencyRoom: boolean): string {
  if (emergencyRoom || category === "hospital_emergency_room") return "Hospital";
  return "Medical";
}

export function hospitalDirectionsUrl(lng: number, lat: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function hospitalDetailsUrl(props: AlsHospitalFeatureProperties): string {
  const query = [props.name, props.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || props.name)}`;
}

export function hospitalTelHref(phone: string): string {
  const trimmed = phone.replace(/[^\d+]/g, "");
  return trimmed ? `tel:${trimmed}` : "";
}

export function bindHospitalOverlayInteractions(
  map: maplibregl.Map,
  maplib: typeof maplibregl,
  onSelect?: HospitalSelectHandler,
): void {
  if (onSelect) selectHandlerByMap.set(map, onSelect);

  const prevEnter = pointEnterByMap.get(map);
  const prevLeave = pointLeaveByMap.get(map);
  const prevClick = pointClickByMap.get(map);
  const prevClusterClick = clusterClickByMap.get(map);
  const prevClusterEnter = clusterEnterByMap.get(map);
  const prevClusterLeave = clusterLeaveByMap.get(map);
  if (prevEnter) map.off("mouseenter", OVERLAY_HOSPITALS_POINTS, prevEnter);
  if (prevLeave) map.off("mouseleave", OVERLAY_HOSPITALS_POINTS, prevLeave);
  if (prevClick) map.off("click", OVERLAY_HOSPITALS_POINTS, prevClick);
  if (prevClusterClick) map.off("click", OVERLAY_HOSPITALS_CLUSTERS, prevClusterClick);
  if (prevClusterEnter) map.off("mouseenter", OVERLAY_HOSPITALS_CLUSTERS, prevClusterEnter);
  if (prevClusterLeave) map.off("mouseleave", OVERLAY_HOSPITALS_CLUSTERS, prevClusterLeave);

  const onPointEnter = (event: MapLayerMouseEvent) => {
    map.getCanvas().style.cursor = "pointer";
    const feature = event.features?.[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const coords = feature.geometry.coordinates as [number, number];
    const props = hospitalPropsFromFeature(feature.properties);
    hoverPopupByMap.get(map)?.remove();
    const popup = new maplib.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: "300px",
      className: "rc-map-popup hospital-hover-popup",
    })
      .setLngLat(coords)
      .setHTML(buildHospitalHoverHTML(props))
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
    hoverPopupByMap.get(map)?.remove();
    hoverPopupByMap.delete(map);
    const coords = feature.geometry.coordinates as [number, number];
    selectHandlerByMap.get(map)?.(hospitalPropsFromFeature(feature.properties), coords);
  };

  const onClusterClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id as number | undefined;
    if (clusterId == null || feature?.geometry.type !== "Point") return;
    const source = map.getSource(OVERLAY_HOSPITALS_SOURCE) as maplibregl.GeoJSONSource | undefined;
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

  map.on("mouseenter", OVERLAY_HOSPITALS_POINTS, onPointEnter);
  map.on("mouseleave", OVERLAY_HOSPITALS_POINTS, onPointLeave);
  map.on("click", OVERLAY_HOSPITALS_POINTS, onPointClick);
  map.on("click", OVERLAY_HOSPITALS_CLUSTERS, onClusterClick);
  map.on("mouseenter", OVERLAY_HOSPITALS_CLUSTERS, onClusterEnter);
  map.on("mouseleave", OVERLAY_HOSPITALS_CLUSTERS, onClusterLeave);
}
