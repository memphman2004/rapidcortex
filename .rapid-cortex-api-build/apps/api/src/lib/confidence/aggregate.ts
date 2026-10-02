import type {
  AggregateConfidence,
  ConfidenceAnalysis,
  ConfidenceLevel,
  ConfidenceTrend,
  FieldConfidence,
  FieldWeight,
} from "rapid-cortex-shared";
import {
  FIELD_REGISTRY,
  applyScoreAdjustments,
  computeAggregate,
  resolveLastUpdatedSegment,
  toLevel,
  toTrend,
  LEXICAL_GROUNDING_SCORE_CAP,
} from "rapid-cortex-shared";
import { normalizeConfidencePercent } from "../../ai/confidence.js";
import {
  applyFieldGrounding,
  type GroundingFlag,
} from "../validation/grounding-verifier.js";

export { toLevel, toTrend, computeAggregate };

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
      const prevField = previous?.fields.find((f) => f.field === fieldKey);
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
        lastUpdatedAtSegment: resolveLastUpdatedSegment({
          segmentCount,
          previous: prevField,
          value: null,
          score: 0,
          conflictingValues: [],
        }),
        conflictingValues: [],
      };
    }

    let value = raw.value;
    let sourceQuote = raw.sourceQuote ?? null;
    let groundingDowngraded = false;
    let scoreCap: number | undefined;
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
      if (grounded.scoreCap != null) {
        scoreCap = grounded.scoreCap;
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

    const conflictingValues = raw.conflictingValues ?? [];
    const hasConflict = conflictingValues.length > 1;
    // Models often return 0–1 despite the 0–100 prompt; Math.round(0.85) → 1% without normalize.
    let score = normalizeConfidencePercent(raw.score);
    score = applyScoreAdjustments({
      rawScore: score,
      groundingDowngraded,
      scoreCap: scoreCap ?? (groundingDowngraded && value ? LEXICAL_GROUNDING_SCORE_CAP : undefined),
      valueNullified: groundingDowngraded && value === null,
    });

    const prevField = previous?.fields.find((f) => f.field === fieldKey);
    const { trend, delta } = toTrend(score, prevField?.score);
    const lastUpdatedAtSegment = resolveLastUpdatedSegment({
      segmentCount,
      previous: prevField,
      value,
      score,
      conflictingValues,
    });

    return {
      field: fieldKey,
      label: meta.label,
      value,
      score,
      level: toLevel(score, hasConflict),
      trend,
      trendDelta: delta,
      reason,
      suggestedQuestion: value
        ? raw.suggestedQuestion
        : meta.weight !== "LOW"
          ? meta.questionTemplate
          : raw.suggestedQuestion,
      weight: meta.weight as FieldWeight,
      lastUpdatedAtSegment,
      conflictingValues,
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
    const score = hasConflict ? 18 : baseScore;
    const value = baseScore > 30 ? `[Mock ${meta.label}]` : null;

    return {
      field: fieldKey,
      label: meta.label,
      value,
      score,
      level: toLevel(score, hasConflict),
      trend,
      trendDelta: delta,
      reason: hasConflict
        ? "Caller gave two different addresses."
        : `[MOCK] Score ${baseScore} — ${progress < 0.5 ? "early in call" : "mid call"}`,
      suggestedQuestion:
        baseScore < 70 && meta.weight !== "LOW" ? meta.questionTemplate : null,
      weight: meta.weight as FieldWeight,
      lastUpdatedAtSegment: resolveLastUpdatedSegment({
        segmentCount,
        previous: prevField,
        value,
        score,
        conflictingValues,
      }),
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

// Re-export types used by tests / callers that imported from aggregate before.
export type { AggregateConfidence, ConfidenceLevel, ConfidenceTrend };
