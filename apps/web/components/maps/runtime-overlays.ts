/**
 * Runtime GeoJSON overlays for Amazon Location Esri/HERE base styles.
 * ALS map resources do not include the former Studio layer IDs, so counties,
 * states, airports, and agency zones are added as MapLibre sources at runtime.
 */

import type { AlsGeofenceListItem } from "rapid-cortex-shared";
import { airportsToGeoJSON } from "@/lib/maps/us-airports";
import type { RCIncident, RCMapLayerVisibility } from "./map-types";

export const EMPTY_OVERLAY_FC: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export const OVERLAY_STATES_SOURCE = "rc-overlay-states";
export const OVERLAY_STATES_LINE = "rc-overlay-states-line";
export const OVERLAY_COUNTIES_SOURCE = "rc-overlay-counties";
export const OVERLAY_COUNTIES_LINE = "rc-overlay-counties-line";
export const OVERLAY_AIRPORTS_SOURCE = "rc-overlay-airports";
export const OVERLAY_AIRPORTS_CIRCLE = "rc-overlay-airports-circle";
export const OVERLAY_AIRPORTS_LABEL = "rc-overlay-airports-label";
export const OVERLAY_ZONES_SOURCE = "rc-overlay-agency-zones";
export const OVERLAY_ZONES_FILL = "rc-overlay-agency-zones-fill";
export const OVERLAY_ZONES_LINE = "rc-overlay-agency-zones-line";

export const OVERLAY_ZONE_LAYER_IDS = [OVERLAY_ZONES_FILL, OVERLAY_ZONES_LINE] as const;

const overlayCache = new Map<string, GeoJSON.FeatureCollection>();

export function geofencesToGeoJSON(items: AlsGeofenceListItem[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items
      .filter((item) => item.polygon.length >= 3)
      .map((item) => ({
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [item.polygon] },
        properties: { zoneId: item.zoneId, geofenceId: item.geofenceId, name: item.zoneId },
      })),
  };
}

export function parseGeofenceListPayload(body: unknown): AlsGeofenceListItem[] {
  if (!body || typeof body !== "object") return [];
  const rec = body as Record<string, unknown>;
  const raw = rec.geofences ?? (rec.data as Record<string, unknown> | undefined)?.geofences;
  if (!Array.isArray(raw)) return [];
  const out: AlsGeofenceListItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const zoneId = typeof item.zoneId === "string" ? item.zoneId : "";
    const geofenceId = typeof item.geofenceId === "string" ? item.geofenceId : zoneId;
    const polygon = Array.isArray(item.polygon)
      ? item.polygon.filter(
          (pair): pair is [number, number] =>
            Array.isArray(pair) &&
            typeof pair[0] === "number" &&
            typeof pair[1] === "number",
        )
      : [];
    if (!zoneId || polygon.length < 3) continue;
    out.push({ zoneId, geofenceId, polygon });
  }
  return out;
}

export async function loadStaticOverlay(
  kind: "states" | "counties",
): Promise<GeoJSON.FeatureCollection> {
  const hit = overlayCache.get(kind);
  if (hit) return hit;
  const path = kind === "states" ? "/maps/us-states.geojson" : "/maps/us-counties.geojson";
  try {
    const res = await fetch(path);
    if (!res.ok) return EMPTY_OVERLAY_FC;
    const data = (await res.json()) as GeoJSON.FeatureCollection;
    if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      return EMPTY_OVERLAY_FC;
    }
    overlayCache.set(kind, data);
    return data;
  } catch {
    return EMPTY_OVERLAY_FC;
  }
}

export async function loadAgencyZoneOverlay(): Promise<GeoJSON.FeatureCollection> {
  const cached = overlayCache.get("zones");
  if (cached) return cached;
  try {
    const res = await fetch("/api/location/geofences", { credentials: "include" });
    if (!res.ok) return EMPTY_OVERLAY_FC;
    const body: unknown = await res.json();
    const fc = geofencesToGeoJSON(parseGeofenceListPayload(body));
    overlayCache.set("zones", fc);
    return fc;
  } catch {
    return EMPTY_OVERLAY_FC;
  }
}

export function loadAirportOverlay(): GeoJSON.FeatureCollection {
  const cached = overlayCache.get("airports");
  if (cached) return cached;
  const fc = airportsToGeoJSON();
  overlayCache.set("airports", fc);
  return fc;
}

/** Test helper — clears in-memory overlay fetches. */
export function clearOverlayCache(): void {
  overlayCache.clear();
}

export type LngLatBoundsTuple = [[number, number], [number, number]];

export function lngLatBoundsOfPoints(
  points: Array<{ longitude: number; latitude: number }>,
): { center: [number, number]; bounds?: LngLatBoundsTuple } | null {
  const pts = points.filter(
    (p) =>
      Number.isFinite(p.latitude) &&
      Number.isFinite(p.longitude) &&
      Math.abs(p.latitude) <= 90 &&
      Math.abs(p.longitude) <= 180,
  );
  if (pts.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of pts) {
    minLng = Math.min(minLng, p.longitude);
    minLat = Math.min(minLat, p.latitude);
    maxLng = Math.max(maxLng, p.longitude);
    maxLat = Math.max(maxLat, p.latitude);
  }
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
  if (pts.length === 1) return { center };
  return { center, bounds: [[minLng, minLat], [maxLng, maxLat]] };
}

export function lngLatBoundsOfIncidents(incidents: RCIncident[]) {
  return lngLatBoundsOfPoints(
    incidents.flatMap((inc) =>
      typeof inc.latitude === "number" && typeof inc.longitude === "number"
        ? [{ latitude: inc.latitude, longitude: inc.longitude }]
        : [],
    ),
  );
}

export function lngLatBoundsOfPolygons(items: AlsGeofenceListItem[]) {
  const points: Array<{ longitude: number; latitude: number }> = [];
  for (const item of items) {
    for (const [lng, lat] of item.polygon) {
      points.push({ longitude: lng, latitude: lat });
    }
  }
  return lngLatBoundsOfPoints(points);
}

export function overlayZonesEnabled(layers: RCMapLayerVisibility): boolean {
  return layers.agencyZones || layers.campusZones || layers.venueZones;
}

export function discoverTrafficLayerIds(
  styleLayers: Array<{ id: string }> | undefined,
): { flow: string[]; closures: string[] } {
  const flow: string[] = [];
  const closures: string[] = [];
  for (const layer of styleLayers ?? []) {
    const id = layer.id.toLowerCase();
    if (id.includes("closure") || id.includes("incident") && id.includes("traffic")) {
      closures.push(layer.id);
    } else if (
      id.includes("traffic") ||
      id.includes("congestion") ||
      id.includes("flow-speed")
    ) {
      flow.push(layer.id);
    }
  }
  return { flow, closures };
}
