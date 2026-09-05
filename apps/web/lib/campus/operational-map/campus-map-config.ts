import type { CampusBuildingSummary } from "rapid-cortex-shared";
import type { CampusOsmConfig } from "./campus-osm-registry";
import { CAMPUS_MAPBOX_ISO, resolveCampusOsmConfig } from "./campus-osm-registry";

export type CampusMapRenderer = "svg" | "mapbox2d" | "mapbox3d";

export interface CampusMapConfig {
  campusId: string;
  campusName: string;
  mapType: "campus";
  renderer: CampusMapRenderer;
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  geojsonBase: string;
  levels: Array<{ id: string; label: string; order: number }>;
  source: "osm" | "none";
  hasOsmCoverage: boolean;
}

export function buildCampusMapConfig(campusCode: string, campusName?: string): CampusMapConfig {
  const osm = resolveCampusOsmConfig(campusCode);
  const id = (osm?.campusId ?? campusCode.trim().toUpperCase()) || "CAMPUS";
  return {
    campusId: id,
    campusName: campusName?.trim() || osm?.campusName || id,
    mapType: "campus",
    renderer: osm ? "mapbox3d" : "mapbox2d",
    center: osm?.center ?? [-84.387982, 33.748995],
    zoom: osm?.zoom ?? CAMPUS_MAPBOX_ISO.zoom,
    bearing: osm?.bearing ?? CAMPUS_MAPBOX_ISO.bearing,
    pitch: osm?.pitch ?? CAMPUS_MAPBOX_ISO.pitch,
    geojsonBase: `/api/campus/code/${encodeURIComponent(id)}/map`,
    levels: [{ id: "exterior", label: "Campus", order: 0 }],
    source: osm ? "osm" : "none",
    hasOsmCoverage: Boolean(osm),
  };
}

export function mapCampusBuildingStatus(
  building: Pick<CampusBuildingSummary, "status" | "activeIncidents">,
): "clear" | "elevated" | "incident" | "closed" {
  if (building.status === "closed") return "closed";
  if (building.activeIncidents >= 2) return "incident";
  if (building.activeIncidents >= 1 || building.status === "alert") return "elevated";
  return "clear";
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function mergeCampusBuildingStatus(
  geojson: GeoJSON.FeatureCollection,
  buildings: CampusBuildingSummary[],
): GeoJSON.FeatureCollection {
  if (buildings.length === 0) return geojson;
  const byName = new Map<string, CampusBuildingSummary>();
  for (const building of buildings) {
    byName.set(normalizeName(building.buildingName), building);
  }
  return {
    ...geojson,
    features: geojson.features.map((feature) => {
      const label = String(feature.properties?.label ?? "");
      const match = byName.get(normalizeName(label));
      if (!match) return feature;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          status: mapCampusBuildingStatus(match),
          incidentCount: match.activeIncidents,
          rcBuildingId: match.buildingId,
        },
      };
    }),
  };
}

export function polygonCentroid(geometry: GeoJSON.Geometry | undefined): { lat: number; lng: number } | null {
  if (!geometry) return null;
  const rings =
    geometry.type === "Polygon"
      ? geometry.coordinates[0]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates[0]?.[0]
        : null;
  if (!rings?.length) return null;
  let lng = 0;
  let lat = 0;
  let n = 0;
  for (const pair of rings) {
    const x = pair[0];
    const y = pair[1];
    if (typeof x !== "number" || typeof y !== "number") continue;
    lng += x;
    lat += y;
    n += 1;
  }
  if (!n) return null;
  return { lng: lng / n, lat: lat / n };
}

export function osmConfigOrThrow(campusCode: string): CampusOsmConfig {
  const osm = resolveCampusOsmConfig(campusCode);
  if (!osm) {
    throw new Error(`No OSM registry entry for campus ${campusCode}`);
  }
  return osm;
}

export function mergeCampusMapPolygons(
  base: GeoJSON.FeatureCollection | null,
  overlay: GeoJSON.FeatureCollection | null,
): GeoJSON.FeatureCollection | null {
  const polygons = (fc: GeoJSON.FeatureCollection | null): GeoJSON.Feature[] => {
    if (!fc) return [];
    return fc.features.filter(
      (feature) => feature.geometry?.type === "Polygon" || feature.geometry?.type === "MultiPolygon",
    );
  };
  const features = [...polygons(base), ...polygons(overlay)];
  if (features.length === 0) return base ?? overlay;
  return { type: "FeatureCollection", features };
}
