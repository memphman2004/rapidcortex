import type { CampusOsmConfig } from "./campus-osm-registry";
import {
  buildCampusOverpassQuery,
  campusOsmToBuildingGeoJSON,
  emptyCampusGeoJSON,
  extractCampusOsmMarkers,
  type CampusMapMarker,
  type OverpassResponse,
} from "./overpass-to-campus-geojson";

const CACHE_TTL_MS = 30 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  markers: CampusMapMarker[];
};

const cache = new Map<string, CacheEntry>();

function overpassUrl(): string {
  return (process.env.OVERPASS_API_URL ?? "https://overpass-api.de/api/interpreter").trim();
}

function mockEnabled(): boolean {
  const raw = process.env.CAMPUS_OSM_MOCK ?? process.env.ENABLE_OSM_CAMPUS_MOCK ?? "";
  return raw === "1" || raw.toLowerCase() === "true";
}

export async function loadCampusOsmMapData(config: CampusOsmConfig): Promise<{
  geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>;
  markers: CampusMapMarker[];
  fromCache: boolean;
  source: "overpass" | "mock" | "empty";
}> {
  const cached = cache.get(config.campusId);
  if (cached && cached.expiresAt > Date.now()) {
    return { geojson: cached.geojson, markers: cached.markers, fromCache: true, source: "overpass" };
  }

  if (mockEnabled()) {
    return { geojson: emptyCampusGeoJSON(), markers: [], fromCache: false, source: "mock" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const resp = await fetch(overpassUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(buildCampusOverpassQuery(config))}`,
      signal: controller.signal,
    });
    if (!resp.ok) {
      return { geojson: emptyCampusGeoJSON(), markers: [], fromCache: false, source: "empty" };
    }
    const osm = (await resp.json()) as OverpassResponse;
    const geojson = campusOsmToBuildingGeoJSON(osm, config);
    const markers = extractCampusOsmMarkers(osm);
    cache.set(config.campusId, { expiresAt: Date.now() + CACHE_TTL_MS, geojson, markers });
    return { geojson, markers, fromCache: false, source: "overpass" };
  } catch {
    return { geojson: emptyCampusGeoJSON(), markers: [], fromCache: false, source: "empty" };
  } finally {
    clearTimeout(timer);
  }
}
