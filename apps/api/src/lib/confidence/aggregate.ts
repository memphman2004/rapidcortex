import type {
  AggregateConfidence,
  ConfidenceAnalysis,
  ConfidenceLevel,
  ConfidenceTrend,
  FieldConfidence,
  FieldWeight,
} from "rapid-cortex-shared";
import { FIELD_REGISTRY } from "rapid-cortex-shared";
import {
  applyFieldGrounding,
  type GroundingFlag,
} from "../validation/grounding-verifier.js";

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

const LEVEL_ORDER: Record<ConfidenceLevel, number> = {
  CONFLICT: 0,
  MISSING: 1,
  LOW: 2,
  MEDIUM: 3,
  HIGH: 4,
};

export function computeAggregate(
  fields: FieldConfidence[],
  audioQualityFactor: number,
  segmentCount: number,
): AggregateConfidence {
  const criticalFields = fields.filter((f) => f.weight === "CRITICAL");
  const highFields = fields.filter((f) => f.weight === "HIGH");

  const weightedSum = [
    ...criticalFields.map((f) => ({ score: f.score, w: 3 })),
    ...highFields.map((f) => ({ score: f.score, w: 2 })),
  ].reduce(
    (acc, { score, w }) => ({ sum: acc.sum + score * w, total: acc.total + w }),
    { sum: 0, total: 0 },
  );

  const rawScore = weightedSum.total > 0 ? Math.round(weightedSum.sum / weightedSum.total) : 0;
  const overallScore = Math.round(rawScore * audioQualityFactor);

  const criticalGaps = criticalFields.filter(
    (f) => f.level === "LOW" || f.level === "MISSING" || f.level === "CONFLICT",
  ).length;
  const hasConflicts = fields.some((f) => f.level === "CONFLICT");

  const attentionRequired = fields
    .filter(
      (f) =>
        (f.weight === "CRITICAL" || f.weight === "HIGH") &&
        (f.level === "LOW" || f.level === "MISSING" || f.level === "CONFLICT"),
    )
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
    .map((f) => f.field);

  let pictureStatus: AggregateConfidence["pictureStatus"];
  if (hasConflicts) pictureStatus = "CONFLICTED";
  else if (criticalGaps === 0 && overallScore >= 80) pictureStatus = "COMPLETE";
  else if (criticalGaps <= 1 && overallScore >= 55) pictureStatus = "PARTIAL";
  else pictureStatus = "INCOMPLETE";

  const topField = attentionRequired
    .map((fieldName) => fields.find((f) => f.field === fieldName))
    .find((f) => f?.suggestedQuestion != null);

  return {
    overallScore,
    pictureStatus,
    attentionRequired,
    criticalGaps,
    hasConflicts,
    audioQualityFactor,
    topSuggestedQuestion: topField?.suggestedQuestion ?? null,
    computedAt: new Date().toISOString(),
    segmentCount,
  };
}

type RawField = {
  value: string | null;
  sourceQuote?: string | null;
  score: number;
  reason: string;
  suggestedQuestion: string | null;
  conflictingValues: string[];
};

export function buildFieldsFromParsed(
  parsedFields: Record<string, RawField | undefined>,
  segmentCount: number,
  previous?: ConfidenceAnalysis,
  transcriptText?: string,
): { fields: FieldConfidence[]; groundingFlags: GroundingFlag[] } {
  const groundingFlags: GroundingFlag[] = [];

  const fields = Object.entries(FIELD_REGISTRY).map(([fieldKey, meta]) => {
    const raw = parsedFields[fieldKey];
    if (!raw) {
      return {
        field: fieldKey,
        label: meta.label,
        value: null,
        score: 0,
        level: "MISSING" as const,
        trend: "STABLE" as const,
        trendDelta: 0,
        reason: "Not mentioned in transcript.",
        suggestedQuestion:
          meta.weight === "CRITICAL" || meta.weight === "HIGH" ? meta.questionTemplate : null,
        weight: meta.weight as FieldWeight,
        lastUpdatedAtSegment: segmentCount,
        conflictingValues: [],
      };
    }

    let value = raw.value;
    let sourceQuote = raw.sourceQuote ?? null;
    let groundingDowngraded = false;
    let reason = (raw.reason ?? "").slice(0, 150);

    if (transcriptText && value?.trim()) {
      const grounded = applyFieldGrounding({
        field: fieldKey,
        value,
        sourceQuote,
        transcript: transcriptText,
      });
      if (grounded.flag) {
        groundingFlags.push(grounded.flag);
        groundingDowngraded = true;
        if (grounded.reasonSuffix) {
          reason = `${reason} ${grounded.reasonSuffix}`.slice(0, 150);
        }
      }
      value = grounded.value;
      sourceQuote = grounded.sourceQuote;
    } else if (value?.trim() && !sourceQuote?.trim()) {
      value = null;
      groundingDowngraded = true;
      reason = "Removed — no source citation in model output.".slice(0, 150);
      groundingFlags.push({
        field: fieldKey,
        originalValue: raw.value ?? "",
        reason: "Missing sourceQuote",
        gate: "source_citation",
      });
    }

    const hasConflict = (raw.conflictingValues?.length ?? 0) > 1;
    let score = Math.min(100, Math.max(0, Math.round(raw.score)));
    if (groundingDowngraded && value === null) score = 0;
    const prevField = previous?.fields.find((f) => f.field === fieldKey);
    const { trend, delta } = toTrend(score, prevField?.score);

    return {
      field: fieldKey,
      label: meta.label,
      value,
      score,
      level: toLevel(score, hasConflict),
      trend,
      trendDelta: delta,
      reason,
      suggestedQuestion: value ? raw.suggestedQuestion : meta.weight !== "LOW" ? meta.questionTemplate : raw.suggestedQuestion,
      weight: meta.weight as FieldWeight,
      lastUpdatedAtSegment: segmentCount,
      conflictingValues: raw.conflictingValues ?? [],
      ...(sourceQuote ? { sourceQuote } : {}),
      ...(groundingDowngraded ? { groundingDowngraded: true } : {}),
    };
  });

  return { fields, groundingFlags };
}

export function mockScoreConfidence(
  incidentId: string,
  agencyId: string,
  segmentCount: number,
  version: number,
  previous?: ConfidenceAnalysis,
): ConfidenceAnalysis {
  const progress = Math.min(1, segmentCount / 20);

  const fields: FieldConfidence[] = Object.entries(FIELD_REGISTRY).map(([fieldKey, meta]) => {
    const baseScore =
      fieldKey === "location"
        ? Math.round(40 + progress * 55)
        : fieldKey === "weapons"
          ? segmentCount > 8
            ? 45
            : 0
          : fieldKey === "injuries"
            ? Math.round(30 + progress * 60)
            : Math.round(20 + progress * 65);

    const prevField = previous?.fields.find((f) => f.field === fieldKey);
    const { trend, delta } = toTrend(baseScore, prevField?.score);

    const conflictingValues =
      fieldKey === "location" && segmentCount > 15
        ? ["123 Main St", "125 Main Street"]
        : [];

    const hasConflict = conflictingValues.length > 1;

    return {
      field: fieldKey,
      label: meta.label,
      value: baseScore > 30 ? `[Mock ${meta.label}]` : null,
      score: hasConflict ? 18 : baseScore,
      level: toLevel(hasConflict ? 18 : baseScore, hasConflict),
      trend,
      trendDelta: delta,
      reason: hasConflict
        ? "Caller gave two different addresses."
        : `[MOCK] Score ${baseScore} — ${progress < 0.5 ? "early in call" : "mid call"}`,
      suggestedQuestion:
        baseScore < 70 && meta.weight !== "LOW" ? meta.questionTemplate : null,
      weight: meta.weight as FieldWeight,
      lastUpdatedAtSegment: segmentCount,
      conflictingValues,
    };
  });

  const aggregate = computeAggregate(fields, 0.92, segmentCount);

  return {
    incidentId,
    agencyId,
    fields,
    aggregate,
    version,
    previousVersion: previous?.version,
  };
}
