/**
 * Clamp / normalize AI confidence scales.
 * Models often return 0–100 when the persisted field is 0–1 (and vice versa for field scores).
 */

/** Persist as 0–1. Accepts model output in 0–1 or 0–100. */
export function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  const as01 = value > 1 && value <= 100 ? value / 100 : value;
  return Math.min(1, Math.max(0, as01));
}

/**
 * Persist as integer 0–100.
 * Values in (0, 1] are treated as fractions (0.85 → 85).
 */
export function normalizeConfidencePercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  const as100 = value > 0 && value <= 1 ? value * 100 : value;
  return Math.min(100, Math.max(0, Math.round(as100)));
}
