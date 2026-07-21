import { calculateDistanceMeters } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";

/** Great-circle distance in meters (WGS84 haversine). Thin wrapper for RCS-local call sites/tests. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return calculateDistanceMeters(lat1, lon1, lat2, lon2);
}

/**
 * True when a unit's reported position is within `radiusMeters` of the call location.
 * Defaults to `env.rcsArrivalRadiusMeters` (150m) when no per-call radius is set.
 */
export function isUnitOnScene(
  unitLat: number,
  unitLon: number,
  targetLat: number,
  targetLon: number,
  radiusMeters?: number,
): boolean {
  const radius = radiusMeters && radiusMeters > 0 ? radiusMeters : env.rcsArrivalRadiusMeters;
  return haversineMeters(unitLat, unitLon, targetLat, targetLon) <= radius;
}
