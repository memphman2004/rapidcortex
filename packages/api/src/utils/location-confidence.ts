import { PINPOINT_CONFIG } from "rapid-cortex-shared";

export function calculateLocationConfidence(accuracy: number): "high" | "medium" | "low" {
  if (accuracy <= PINPOINT_CONFIG.HIGH_CONFIDENCE_THRESHOLD_METERS) return "high";
  if (accuracy <= PINPOINT_CONFIG.MEDIUM_CONFIDENCE_THRESHOLD_METERS) return "medium";
  return "low";
}

export function calculateMovementDirection(heading: number | undefined): string {
  if (heading === undefined || Number.isNaN(heading)) return "stationary";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(heading / 45) % 8;
  return directions[idx];
}

export function metersPerSecondToMph(mps: number): number {
  return mps * 2.23694;
}

export function isMoving(speedMps: number | undefined): boolean {
  return speedMps != null && speedMps > 1;
}
