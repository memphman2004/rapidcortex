import type { GeoJSONPolygon } from "./engine.js";

export function polygonRings(polygon: GeoJSONPolygon): Array<Array<[number, number]>> {
  if (polygon.type === "Polygon") {
    return polygon.coordinates as Array<Array<[number, number]>>;
  }
  return (polygon.coordinates as unknown as Array<Array<Array<[number, number]>>>).flat();
}

export function isInBoundary(point: [number, number], polygon: GeoJSONPolygon): boolean {
  const [lon, lat] = point;
  const ring = polygonRings(polygon)[0];
  if (!ring) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    const intersect = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Approximate tri-county boxes for Charleston deployment demos (not survey-grade GIS). */
export const CHARLESTON_COUNTY_BOXES: Record<string, { minLat: number; maxLat: number; minLon: number; maxLon: number }> = {
  "BERK-SC": { minLat: 32.9, maxLat: 33.4, minLon: -80.4, maxLon: -79.7 },
  "DORCH-SC": { minLat: 32.85, maxLat: 33.25, minLon: -80.7, maxLon: -80.0 },
  "CHAS-SC": { minLat: 32.6, maxLat: 33.05, minLon: -80.3, maxLon: -79.6 },
};
