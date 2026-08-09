import type { Jurisdiction } from "./jurisdiction-registry.js";

const TIER_INTERVALS: Record<number, number> = { 0: 12, 1: 24, 2: 48, 3: 120 };
const TIER_WEIGHTS: Record<number, number> = { 0: 4.0, 1: 3.0, 2: 2.0, 3: 1.0 };
export const MAX_JURISDICTIONS_PER_RUN = 30;
export const NEVER_SCANNED_PRIORITY = 999;
/** Eligible when ≥80% through the tier interval. */
export const ELIGIBILITY_THRESHOLD = 0.8;

export function computePriorityScore(j: Jurisdiction, nowMs = Date.now()): number {
  const lastScanned = j.lastScannedAt ? new Date(j.lastScannedAt).getTime() : 0;
  if (!Number.isFinite(lastScanned) || lastScanned <= 0) return NEVER_SCANNED_PRIORITY;
  const hoursSinceScan = (nowMs - lastScanned) / (1000 * 60 * 60);
  const interval = TIER_INTERVALS[j.tier] ?? 120;
  const weight = TIER_WEIGHTS[j.tier] ?? 1.0;
  const overdueFactor = hoursSinceScan / interval;
  return overdueFactor * weight + (j.priorityBoost ?? 0);
}

export function selectJurisdictionsForRun(
  all: Jurisdiction[],
  maxCount = MAX_JURISDICTIONS_PER_RUN,
  nowMs = Date.now(),
): Jurisdiction[] {
  return all
    .filter((j) => j.isActive)
    .map((j) => ({ j, score: computePriorityScore(j, nowMs) }))
    .filter(({ score }) => score >= ELIGIBILITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(({ j }) => j);
}
