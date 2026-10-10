/** Ray-cast point-in-polygon for GeoJSON Polygon / MultiPolygon (EPSG:4326). */

function ringContains(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!;
    const yi = ring[i]![1]!;
    const xj = ring[j]![0]!;
    const yj = ring[j]![1]!;
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonContains(lng: number, lat: number, coords: number[][][]): boolean {
  if (!coords[0] || !ringContains(lng, lat, coords[0])) return false;
  for (let h = 1; h < coords.length; h++) {
    if (ringContains(lng, lat, coords[h]!)) return false;
  }
  return true;
}

export function featureContainsPoint(
  feature: GeoJSON.Feature,
  lng: number,
  lat: number,
): boolean {
  const g = feature.geometry;
  if (!g) return false;
  if (g.type === "Polygon") return polygonContains(lng, lat, g.coordinates);
  if (g.type === "MultiPolygon") {
    return g.coordinates.some((poly: number[][][]) => polygonContains(lng, lat, poly));
  }
  if (g.type === "Point") {
    const [x, y] = g.coordinates;
    return Math.abs((x ?? 0) - lng) < 1e-7 && Math.abs((y ?? 0) - lat) < 1e-7;
  }
  return false;
}

export function findContainingFeatures(
  fc: GeoJSON.FeatureCollection,
  lng: number,
  lat: number,
  limit = 25,
): GeoJSON.Feature[] {
  const hits: GeoJSON.Feature[] = [];
  for (const f of fc.features ?? []) {
    if (!f || f.type !== "Feature") continue;
    if (featureContainsPoint(f, lng, lat)) {
      hits.push(f);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}
