/**
 * Confidence scale helpers.
 *
 * Products use two persisted scales:
 * - AIAnalysis / TriageResult.confidence → **0–1**
 * - Field confidence scores / TriageAiClassification → **0–100**
 *
 * Models often flip scales; these helpers accept either and normalize.
 */

/** Persist as 0–1. Accepts model output in 0–1 or 0–100. */
export function normalizeConfidence01(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  const as01 = value > 1 && value <= 100 ? value / 100 : value;
  return Math.min(1, Math.max(0, as01));
}

/**
 * Persist as integer 0–100.
 * Values in (0, 1] are treated as fractions (0.85 → 85), matching triage-badge display.
 * Exact `0` stays 0; values &gt; 1 are clamped as percentages.
 */
export function normalizeConfidencePercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  const as100 = value > 0 && value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(as100)));
}

/** UI display helper when the source scale may be 0–1 or 0–100. */
export function confidenceToDisplayPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (value <= 1) return Math.round(value * 100);
  return Math.min(100, Math.round(value));
}
