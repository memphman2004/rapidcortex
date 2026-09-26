import { calculateDistanceMeters } from "rapid-cortex-shared";

/** Miles from the sharing agency HQ. Missing HQ or incident coordinates do not share. */
export function incidentWithinMiles(
  incidentLat: number | undefined,
  incidentLon: number | undefined,
  boundaryMiles: number,
  hqLat: number | undefined,
  hqLon: number | undefined,
): boolean {
  if (!Number.isFinite(boundaryMiles) || boundaryMiles <= 0) return true;
  if (
    hqLat == null || hqLon == null ||
    incidentLat == null || incidentLon == null ||
    !Number.isFinite(hqLat) || !Number.isFinite(hqLon) ||
    !Number.isFinite(incidentLat) || !Number.isFinite(incidentLon)
  ) {
    return false;
  }
  const meters = calculateDistanceMeters(hqLat, hqLon, incidentLat, incidentLon);
  return meters <= boundaryMiles * 1609.344;
}
