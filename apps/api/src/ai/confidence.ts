/** Clamp model confidence to persisted 0–1 range (defensive against future providers). */
export function normalizeConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
