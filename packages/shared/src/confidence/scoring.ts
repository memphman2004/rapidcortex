/**
 * Robust field-confidence scoring.
 *
 * Goals vs the prior CRITICAL/HIGH-only mean:
 * 1. All weights contribute (CRITICAL…LOW) so MEDIUM gaps still move the picture.
 * 2. Temporal decay so stale extractions fade unless reconfirmed.
 * 3. Conflict / grounding / STT evidence softens scores instead of ignoring them.
 * 4. Picture status requires filled criticals — high averages alone cannot look COMPLETE.
 */

import type {
  AggregateConfidence,
  ConfidenceLevel,
  ConfidenceTrend,
  FieldConfidence,
  FieldWeight,
} from "./types.js";

/** Relative importance in the weighted mean. */
export const FIELD_WEIGHT_MULTIPLIER: Record<FieldWeight, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const LEVEL_ORDER: Record<ConfidenceLevel, number> = {
  CONFLICT: 0,
  MISSING: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
};

/** Soft ceiling when lexical grounding is weak but citation exists. */
export const LEXICAL_GROUNDING_SCORE_CAP = 45;

/** Conflicted fields still contribute a small residual, never full score. */
export const CONFLICT_SCORE_CAP = 25;

export type AggregateScoringOptions = {
  /** Mean STT confidence 0–1 across recent segments; omitted → no STT discount. */
  meanSttConfidence?: number;
  /**
   * Segments since a field was last confirmed before decay starts.
   * Default 2 (grace for rapid re-scores).
   */
  decayGraceSegments?: number;
  /** Per-segment decay after grace (CRITICAL/HIGH). Default 0.04. */
  decayRateCritical?: number;
  /** Per-segment decay after grace (MEDIUM/LOW). Default 0.025. */
  decayRateSecondary?: number;
  /** Floor on decay multiplier. Default 0.55. */
  decayFloor?: number;
};

export function toLevel(score: number, hasConflict: boolean): ConfidenceLevel {
  if (hasConflict) return "CONFLICT";
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  if (score > 0) return "LOW";
  return "MISSING";
}

export function toTrend(
  current: number,
  previous: number | undefined,
): { trend: ConfidenceTrend; delta: number } {
  if (previous === undefined) return { trend: "STABLE", delta: 0 };
  const delta = current - previous;
  if (delta > 5) return { trend: "IMPROVING", delta };
  if (delta < -5) return { trend: "DEGRADING", delta };
  return { trend: "STABLE", delta };
}

/**
 * How much a field's score should fade when it has not been reconfirmed.
 * Age 0–grace → 1.0; then linear decay to `decayFloor`.
 */
export function temporalDecayFactor(
  field: Pick<FieldConfidence, "weight" | "lastUpdatedAtSegment" | "level">,
  segmentCount: number,
  options: AggregateScoringOptions = {},
): number {
  const grace = options.decayGraceSegments ?? 2;
  const floor = options.decayFloor ?? 0.55;
  const rateCritical = options.decayRateCritical ?? 0.04;
  const rateSecondary = options.decayRateSecondary ?? 0.025;

  // Missing never "ages" — already zero contribution via score.
  if (field.level === "MISSING") return 1;

  const age = Math.max(0, segmentCount - field.lastUpdatedAtSegment);
  if (age <= grace) return 1;

  const overdue = age - grace;
  const rate =
    field.weight === "CRITICAL" || field.weight === "HIGH" ? rateCritical : rateSecondary;
  return Math.max(floor, 1 - overdue * rate);
}

/**
 * Effective per-field score for aggregation (after conflict cap + decay).
 * MISSING contributes 0 but still consumes weight (pulls overall down).
 */
export function effectiveFieldScore(
  field: FieldConfidence,
  segmentCount: number,
  options: AggregateScoringOptions = {},
): number {
  if (field.level === "MISSING" || !Number.isFinite(field.score)) return 0;

  let score = Math.min(100, Math.max(0, field.score));
  if (field.level === "CONFLICT") {
    score = Math.min(score, CONFLICT_SCORE_CAP);
  }

  const decay = temporalDecayFactor(field, segmentCount, options);
  return Math.round(score * decay);
}

/**
 * Map mean STT (0–1) into a gentle overall multiplier.
 * Poor audio already lives in audioQualityFactor; STT is an independent evidence channel.
 * Range ≈ [0.75, 1.0] so STT never dominates the model score.
 */
export function sttEvidenceFactor(meanSttConfidence: number | undefined): number {
  if (meanSttConfidence === undefined || !Number.isFinite(meanSttConfidence)) return 1;
  const stt = Math.min(1, Math.max(0, meanSttConfidence));
  return Math.round((0.75 + 0.25 * stt) * 1000) / 1000;
}

/**
 * Clamp / fuse raw model score with optional grounding soft-cap.
 */
export function applyScoreAdjustments(params: {
  rawScore: number;
  groundingDowngraded?: boolean;
  scoreCap?: number;
  valueNullified?: boolean;
}): number {
  if (params.valueNullified) return 0;
  let score = params.rawScore;
  if (params.scoreCap != null) {
    score = Math.min(score, params.scoreCap);
  }
  // Soft citation issues that kept a value still get a mild discount.
  if (params.groundingDowngraded && params.scoreCap == null) {
    score = Math.round(score * 0.85);
  }
  return Math.min(100, Math.max(0, score));
}

/**
 * Only advance lastUpdated when evidence meaningfully changed — enables decay.
 */
export function resolveLastUpdatedSegment(params: {
  segmentCount: number;
  previous?: Pick<FieldConfidence, "value" | "score" | "lastUpdatedAtSegment" | "conflictingValues">;
  value: string | null;
  score: number;
  conflictingValues: string[];
}): number {
  const { segmentCount, previous, value, score, conflictingValues } = params;
  if (!previous) return segmentCount;

  const prevConflicts = previous.conflictingValues?.length ?? 0;
  const nextConflicts = conflictingValues.length;
  const valueChanged = (previous.value ?? null) !== (value ?? null);
  const scoreChanged = Math.abs(previous.score - score) > 3;
  const conflictChanged = prevConflicts !== nextConflicts;

  if (valueChanged || scoreChanged || conflictChanged) return segmentCount;
  return previous.lastUpdatedAtSegment;
}

export function computeAggregate(
  fields: FieldConfidence[],
  audioQualityFactor: number,
  segmentCount: number,
  options: AggregateScoringOptions = {},
): AggregateConfidence {
  const audio = Math.min(1, Math.max(0.1, audioQualityFactor));
  const sttFactor = sttEvidenceFactor(options.meanSttConfidence);

  const weighted = fields.reduce(
    (acc, field) => {
      const w = FIELD_WEIGHT_MULTIPLIER[field.weight] ?? 1;
      const score = effectiveFieldScore(field, segmentCount, options);
      return { sum: acc.sum + score * w, total: acc.total + w };
    },
    { sum: 0, total: 0 },
  );

  const rawScore = weighted.total > 0 ? weighted.sum / weighted.total : 0;
  const overallScore = Math.round(Math.min(100, Math.max(0, rawScore * audio * sttFactor)));

  const criticalFields = fields.filter((f) => f.weight === "CRITICAL");
  const criticalGaps = criticalFields.filter(
    (f) => f.level === "LOW" || f.level === "MISSING" || f.level === "CONFLICT",
  ).length;
  const hasConflicts = fields.some((f) => f.level === "CONFLICT");
  const criticalMissing = criticalFields.some((f) => f.level === "MISSING");

  const attentionRequired = fields
    .filter(
      (f) =>
        (f.weight === "CRITICAL" || f.weight === "HIGH") &&
        (f.level === "LOW" || f.level === "MISSING" || f.level === "CONFLICT"),
    )
    .sort((a, b) => {
      const levelDiff = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
      if (levelDiff !== 0) return levelDiff;
      return (
        (FIELD_WEIGHT_MULTIPLIER[b.weight] ?? 0) - (FIELD_WEIGHT_MULTIPLIER[a.weight] ?? 0)
      );
    })
    .map((f) => f.field);

  let pictureStatus: AggregateConfidence["pictureStatus"];
  if (hasConflicts) {
    pictureStatus = "CONFLICTED";
  } else if (!criticalMissing && criticalGaps === 0 && overallScore >= 80) {
    pictureStatus = "COMPLETE";
  } else if (criticalGaps <= 1 && overallScore >= 55) {
    pictureStatus = "PARTIAL";
  } else {
    pictureStatus = "INCOMPLETE";
  }

  const topField = attentionRequired
    .map((fieldName) => fields.find((f) => f.field === fieldName))
    .find((f) => f?.suggestedQuestion != null);

  return {
    overallScore,
    pictureStatus,
    attentionRequired,
    criticalGaps,
    hasConflicts,
    audioQualityFactor: audio,
    topSuggestedQuestion: topField?.suggestedQuestion ?? null,
    computedAt: new Date().toISOString(),
    segmentCount,
  };
}
