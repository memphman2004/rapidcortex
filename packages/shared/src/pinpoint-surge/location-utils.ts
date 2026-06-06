export type MovementDirection =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW"
  | "stationary";

export function calculateLocationConfidence(accuracyM: number): "high" | "medium" | "low" {
  if (accuracyM <= 25) return "high";
  if (accuracyM <= 100) return "medium";
  return "low";
}

export function calculateMovementDirection(heading: number | null | undefined): MovementDirection {
  if (heading == null || !Number.isFinite(heading)) return "stationary";
  const directions: MovementDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(heading / 45) % 8;
  return directions[index] ?? "stationary";
}

export function metersPerSecondToMph(mps: number): number {
  return mps * 2.23694;
}

/** Haversine distance in meters. */
export function calculateDistanceBetweenPoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
