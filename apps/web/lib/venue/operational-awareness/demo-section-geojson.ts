import type { VenueOperationalMap } from "rapid-cortex-shared";
import { STADIUM_VIEWBOX } from "./demo-stadium-geometry";
import { statusForMapbox } from "./venue-map-config";

const METERS_PER_DEG_LAT = 111_320;
const STADIUM_WIDTH_M = 280;
const STADIUM_HEIGHT_M = 174;

export type LngLat = [number, number];

const EXTRUSION: Record<string, { base: number; height: number }> = {
  exterior: { base: 0, height: 2 },
  field: { base: 0, height: 2 },
  "level-1": { base: 0, height: 6 },
  "level-2": { base: 6, height: 10 },
  club: { base: 10, height: 14 },
  suites: { base: 12, height: 16 },
  upper: { base: 14, height: 20 },
};

function offsetLngLat(center: LngLat, eastM: number, northM: number): LngLat {
  const [lng, lat] = center;
  const dLat = northM / METERS_PER_DEG_LAT;
  const dLng = eastM / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [lng + dLng, lat + dLat];
}

function svgToLngLat(x: number, y: number, center: LngLat): LngLat {
  const east = ((x - STADIUM_VIEWBOX.cx) / STADIUM_VIEWBOX.width) * STADIUM_WIDTH_M;
  const north = -((y - STADIUM_VIEWBOX.cy) / STADIUM_VIEWBOX.height) * STADIUM_HEIGHT_M;
  return offsetLngLat(center, east, north);
}

function ellipsePointMeters(rx: number, ry: number, angle: number): { x: number; y: number } {
  return {
    x: STADIUM_VIEWBOX.cx + rx * Math.cos(angle),
    y: STADIUM_VIEWBOX.cy + ry * Math.sin(angle),
  };
}

function wedgeRing(
  center: LngLat,
  innerRx: number,
  innerRy: number,
  outerRx: number,
  outerRy: number,
  a0: number,
  a1: number,
  steps = 8,
): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    const p = ellipsePointMeters(innerRx, innerRy, t);
    ring.push(svgToLngLat(p.x, p.y, center));
  }
  for (let i = steps; i >= 0; i--) {
    const t = a0 + ((a1 - a0) * i) / steps;
    const p = ellipsePointMeters(outerRx, outerRy, t);
    ring.push(svgToLngLat(p.x, p.y, center));
  }
  ring.push(ring[0]!);
  return ring;
}

function ellipseRing(center: LngLat, rx: number, ry: number, steps = 48): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const p = ellipsePointMeters(rx, ry, t);
    ring.push(svgToLngLat(p.x, p.y, center));
  }
  return ring;
}

function feature(
  id: string,
  label: string,
  level: string,
  coordinates: LngLat[],
  status: string,
  extra?: Record<string, string | number>,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const extrusion = EXTRUSION[level] ?? EXTRUSION["level-1"]!;
  return {
    type: "Feature",
    id,
    geometry: { type: "Polygon", coordinates: [coordinates] },
    properties: {
      sectionId: id,
      label,
      level,
      status,
      extrusionBase: extrusion.base,
      extrusionHeight: extrusion.height,
      ...extra,
    },
  };
}

/**
 * Illustrative WGS84 section polygons around the venue centroid.
 * Not a surveyed floor plan — used for Mapbox fill-extrusion until CAD GeoJSON exists.
 */
export function buildDemoVenueSectionGeoJSON(
  map: VenueOperationalMap,
  levelId?: string,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const center = map.exterior.center;
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];

  const field = map.zones.find((zone) => zone.id === "field");
  if (field && (!levelId || levelId === field.levelId || levelId === "exterior")) {
    features.push(
      feature("field", "Field", field.levelId, ellipseRing(center, 118, 72), statusForMapbox(field.status), {
        zone: "Field",
      }),
    );
  }

  const sectionZones = map.zones.filter((zone) => zone.type === "section" || zone.id.startsWith("gate"));
  const start = -Math.PI / 2 - 0.18;
  const sweep = (Math.PI * 2) / Math.max(sectionZones.length, 1);

  sectionZones.forEach((zone, i) => {
    if (levelId && zone.levelId !== levelId && levelId !== "exterior") return;
    const a0 = start + i * sweep;
    const a1 = a0 + sweep * 0.92;
    const inner = zone.levelId === "upper" ? [148, 92, 188, 122] : [128, 80, 168, 108];
    features.push(
      feature(
        zone.id,
        zone.section ?? zone.name,
        zone.levelId,
        wedgeRing(center, inner[0]!, inner[1]!, inner[2]!, inner[3]!, a0, a1),
        statusForMapbox(zone.status),
        { zone: zone.name },
      ),
    );
  });

  return { type: "FeatureCollection", features };
}

export function emptySectionGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return { type: "FeatureCollection", features: [] };
}
