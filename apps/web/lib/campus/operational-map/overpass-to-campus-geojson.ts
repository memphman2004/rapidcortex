import type { CampusOsmConfig } from "./campus-osm-registry";

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

export interface OverpassResponse {
  elements?: OverpassElement[];
}

export interface CampusMapMarker {
  id: string;
  type: "aed" | "emergencyPhone" | "parking";
  label: string;
  lat: number;
  lng: number;
}

export function classifyBuilding(tags: Record<string, string>): string {
  const b = (tags.building ?? "").toLowerCase();
  const amenity = (tags.amenity ?? "").toLowerCase();
  const leisure = (tags.leisure ?? "").toLowerCase();
  if (["university", "college", "school", "kindergarten"].some((t) => b.includes(t))) return "academic";
  if (b === "dormitory" || b === "residential" || b === "apartments") return "residential";
  if (b === "hospital" || amenity === "hospital" || amenity === "clinic") return "medical";
  if (b === "garage" || b === "parking" || amenity === "parking") return "parking";
  if (leisure === "stadium" || leisure === "sports_centre") return "athletic";
  if (b === "library" || amenity === "library") return "academic";
  if (b === "government" || b === "public" || b === "yes" || b === "commercial" || b === "office") return "admin";
  return "other";
}

export function estimateFloors(tags: Record<string, string>): number {
  const b = (tags.building ?? "").toLowerCase();
  if (b === "dormitory" || b === "residential") return 4;
  if (b === "hospital") return 6;
  if (b === "parking" || b === "garage") return 5;
  if (b === "library") return 3;
  if (b === "stadium") return 4;
  return 2;
}

function deriveZone(tags: Record<string, string>, buildingType: string): string {
  const name = (tags.name ?? "").toLowerCase();
  if (name.includes("north")) return "North Campus";
  if (name.includes("south")) return "South Campus";
  if (name.includes("east")) return "East Campus";
  if (name.includes("west")) return "West Campus";
  if (buildingType === "residential") return "Residential";
  if (buildingType === "parking") return "Parking";
  if (buildingType === "athletic") return "Athletic";
  if (buildingType === "medical") return "Medical";
  if (buildingType === "academic") return "Academic";
  return "Campus";
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

function wayToPolygon(el: OverpassElement): [number, number][] | null {
  const geom = el.geometry;
  if (!geom || geom.length < 3) return null;
  const ring = closeRing(geom.map((p) => [p.lon, p.lat] as [number, number]));
  return ring.length >= 4 ? ring : null;
}

export function buildCampusOverpassQuery(config: CampusOsmConfig): string {
  const [s, w, n, e] = config.bbox;
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:25];
(
  way["building"](${bbox});
  way["amenity"="parking"](${bbox});
  node["amenity"="defibrillator"](${bbox});
  node["amenity"="first_aid"](${bbox});
  node["emergency"="phone"](${bbox});
  node["highway"="emergency_access_point"](${bbox});
  node["amenity"="parking_entrance"](${bbox});
);
out body geom;`;
}

export function summarizeCampusOsm(osm: OverpassResponse): {
  buildings: number;
  named: number;
  withLevels: number;
  aeds: number;
  phones: number;
} {
  const elements = osm.elements ?? [];
  const buildings = elements.filter((el) => el.type === "way" && el.tags?.building);
  const named = buildings.filter((el) => Boolean(el.tags?.name));
  const withLevels = buildings.filter((el) => Boolean(el.tags?.["building:levels"]));
  const aeds = elements.filter((el) => el.tags?.amenity === "defibrillator");
  const phones = elements.filter(
    (el) => el.tags?.emergency === "phone" || el.tags?.highway === "emergency_access_point",
  );
  return {
    buildings: buildings.length,
    named: named.length,
    withLevels: withLevels.length,
    aeds: aeds.length,
    phones: phones.length,
  };
}

/**
 * Convert Overpass `out body geom` ways into RC building polygons.
 * Does not use osmtogeojson — keeps the web bundle free of that dependency.
 */
export function campusOsmToBuildingGeoJSON(
  osm: OverpassResponse,
  config: CampusOsmConfig,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  let unnamed = 0;
  for (const el of osm.elements ?? []) {
    if (el.type !== "way") continue;
    const tags = el.tags ?? {};
    if (!tags.building && tags.amenity !== "parking") continue;
    const ring = wayToPolygon(el);
    if (!ring) continue;
    unnamed += 1;
    const osmId = `way/${el.id}`;
    const buildingId = `${config.campusId.toLowerCase()}-${osmId.replace("/", "-")}`;
    const floors = parseInt(tags["building:levels"] ?? "", 10) || estimateFloors(tags);
    const parsedHeight = parseFloat(tags.height ?? "");
    const height = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : floors * config.metersPerFloor;
    const buildingType = classifyBuilding(tags);
    const label = (tags.name || tags["name:en"] || tags.ref || tags.amenity || tags.building || `Building ${unnamed}`).slice(
      0,
      60,
    );
    features.push({
      type: "Feature",
      id: buildingId,
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: {
        buildingId,
        sectionId: buildingId,
        label,
        zone: deriveZone(tags, buildingType),
        buildingType,
        floors,
        capacity: parseInt(tags.capacity ?? "", 10) || 0,
        extrusionBase: 0,
        extrusionHeight: Math.max(height, 4),
        status: "clear",
        osmId,
        level: "exterior",
      },
    });
  }
  return { type: "FeatureCollection", features };
}

export function extractCampusOsmMarkers(osm: OverpassResponse): CampusMapMarker[] {
  const markers: CampusMapMarker[] = [];
  for (const el of osm.elements ?? []) {
    if (el.type !== "node" || el.lat == null || el.lon == null) continue;
    const tags = el.tags ?? {};
    const id = `node-${el.id}`;
    if (tags.amenity === "defibrillator") {
      markers.push({
        id,
        type: "aed",
        label: tags.name ?? tags["ref:defibrillator"] ?? "AED",
        lat: el.lat,
        lng: el.lon,
      });
    }
    if (tags.emergency === "phone" || tags.highway === "emergency_access_point") {
      markers.push({
        id,
        type: "emergencyPhone",
        label: tags.name ?? tags.ref ?? "Emergency Phone",
        lat: el.lat,
        lng: el.lon,
      });
    }
    if (tags.amenity === "parking_entrance") {
      markers.push({
        id,
        type: "parking",
        label: tags.name ?? "Parking",
        lat: el.lat,
        lng: el.lon,
      });
    }
  }
  return markers;
}

export function emptyCampusGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return { type: "FeatureCollection", features: [] };
}
