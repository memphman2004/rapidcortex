import type { RapidIqIntelRecommendation } from "rapid-cortex-shared";

/**
 * Map fit / stage / value into PURSUE | PARTNER | WATCH | IGNORE.
 * Used by heuristics and as a guardrail when model output is missing.
 */
export function recommendPursuit(input: {
  fitScore: number;
  procurementStage: number;
  preRfpSignal: boolean;
  estimatedValue?: number | null;
  partnerLikely?: boolean;
}): RapidIqIntelRecommendation {
  const fit = input.fitScore;
  if (fit < 5) return "IGNORE";
  const large = (input.estimatedValue ?? 0) >= 1_000_000;
  if (input.partnerLikely || (fit >= 7 && large && input.procurementStage >= 8)) {
    return "PARTNER";
  }
  if (fit >= 7 && input.procurementStage >= 6) return "PURSUE";
  if (fit >= 7 || input.preRfpSignal) return "WATCH";
  return "WATCH";
}
