import { PINPOINT_CONFIG } from "rapid-cortex-shared";

export type LocationConfidence = "high" | "medium" | "low";

export function classifyLocationConfidence(accuracyM?: number): LocationConfidence {
  if (accuracyM == null || !Number.isFinite(accuracyM)) return "medium";
  if (accuracyM <= PINPOINT_CONFIG.HIGH_CONFIDENCE_THRESHOLD_METERS) return "high";
  if (accuracyM <= PINPOINT_CONFIG.MEDIUM_CONFIDENCE_THRESHOLD_METERS) return "medium";
  return "low";
}
