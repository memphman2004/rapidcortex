import { calculateDistanceMeters } from "./distance.js";

export type LngLat = [number, number];

const METERS_PER_MILE = 1609.344;

/** Ray-casting point-in-polygon (WGS84 lng/lat). */
export function pointInPolygon(lng: number, lat: number, polygon: LngLat[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export type PointGeofenceZone = "inside_boundary" | "within_one_mile_ring" | "outside";

/** Classify a point against campus/venue boundary and its 1-mile outer ring. */
export function classifyPointAgainstEnsBoundary(
  lng: number,
  lat: number,
  boundary: LngLat[],
  outerRingOneMile: LngLat[],
): PointGeofenceZone {
  if (boundary.length >= 3 && pointInPolygon(lng, lat, boundary)) {
    return "inside_boundary";
  }
  if (outerRingOneMile.length >= 3 && pointInPolygon(lng, lat, outerRingOneMile)) {
    return "within_one_mile_ring";
  }
  return "outside";
}

function polygonCentroid(polygon: LngLat[]): { lng: number; lat: number } {
  let lng = 0;
  let lat = 0;
  for (const [x, y] of polygon) {
    lng += x;
    lat += y;
  }
  const n = polygon.length || 1;
  return { lng: lng / n, lat: lat / n };
}

function bearingDegrees(fromLng: number, fromLat: number, toLng: number, toLat: number): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function destinationPoint(
  lng: number,
  lat: number,
  bearingDeg: number,
  distanceM: number,
): { lng: number; lat: number } {
  const R = 6_371_000;
  const δ = distanceM / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return { lng: (λ2 * 180) / Math.PI, lat: (φ2 * 180) / Math.PI };
}

/**
 * Approximate outward buffer by pushing each vertex away from the centroid.
 * Suitable for ENS 1-mile alerting rings around campus/venue boundaries.
 */
export function bufferPolygonMeters(polygon: LngLat[], bufferMeters: number): LngLat[] {
  if (polygon.length < 3 || bufferMeters <= 0) return [...polygon];
  const c = polygonCentroid(polygon);
  const out: LngLat[] = [];
  for (const [lng, lat] of polygon) {
    const dist = calculateDistanceMeters(c.lat, c.lng, lat, lng);
    const bearing = bearingDegrees(c.lng, c.lat, lng, lat);
    const push = dist > 1 ? bufferMeters : bufferMeters;
    const dest = destinationPoint(lng, lat, bearing, push);
    out.push([dest.lng, dest.lat]);
  }
  return out;
}

export function bufferPolygonOneMile(polygon: LngLat[]): LngLat[] {
  return bufferPolygonMeters(polygon, METERS_PER_MILE);
}

export function closePolygonRing(polygon: LngLat[]): LngLat[] {
  if (polygon.length === 0) return polygon;
  const first = polygon[0]!;
  const last = polygon[polygon.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) return polygon;
  return [...polygon, first];
}
