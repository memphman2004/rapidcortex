import { describe, expect, it } from "vitest";
import type { FieldConfidence } from "./types.js";
import {
  CONFLICT_SCORE_CAP,
  applyScoreAdjustments,
  computeAggregate,
  effectiveFieldScore,
  resolveLastUpdatedSegment,
  sttEvidenceFactor,
  temporalDecayFactor,
  toLevel,
} from "./scoring.js";

function field(partial: Partial<FieldConfidence> & Pick<FieldConfidence, "field" | "weight">): FieldConfidence {
  return {
    label: partial.field,
    value: partial.value ?? "x",
    score: partial.score ?? 80,
    level: partial.level ?? toLevel(partial.score ?? 80, false),
    trend: "STABLE",
    trendDelta: 0,
    reason: "test",
    suggestedQuestion: null,
    lastUpdatedAtSegment: partial.lastUpdatedAtSegment ?? 0,
    conflictingValues: partial.conflictingValues ?? [],
    ...partial,
  };
}

describe("toLevel", () => {
  it("maps bands and conflict", () => {
    expect(toLevel(90, false)).toBe("HIGH");
    expect(toLevel(65, false)).toBe("MEDIUM");
    expect(toLevel(20, false)).toBe("LOW");
    expect(toLevel(0, false)).toBe("MISSING");
    expect(toLevel(95, true)).toBe("CONFLICT");
  });
});

describe("temporalDecayFactor", () => {
  it("stays at 1 within grace window", () => {
    const f = field({
      field: "location",
      weight: "CRITICAL",
      lastUpdatedAtSegment: 10,
      level: "HIGH",
      score: 90,
    });
    expect(temporalDecayFactor(f, 12)).toBe(1);
  });

  it("decays critical fields after grace", () => {
    const f = field({
      field: "location",
      weight: "CRITICAL",
      lastUpdatedAtSegment: 10,
      level: "HIGH",
      score: 90,
    });
    // age=10, grace=2 → overdue=8 → 1 - 8*0.04 = 0.68
    expect(temporalDecayFactor(f, 20)).toBeCloseTo(0.68, 2);
  });

  it("floors decay", () => {
    const f = field({
      field: "location",
      weight: "CRITICAL",
      lastUpdatedAtSegment: 0,
      level: "HIGH",
      score: 90,
    });
    expect(temporalDecayFactor(f, 100)).toBe(0.55);
  });
});

describe("effectiveFieldScore", () => {
  it("caps conflicts", () => {
    const f = field({
      field: "location",
      weight: "CRITICAL",
      score: 90,
      level: "CONFLICT",
      lastUpdatedAtSegment: 5,
    });
    expect(effectiveFieldScore(f, 5)).toBe(CONFLICT_SCORE_CAP);
  });

  it("returns 0 for missing", () => {
    const f = field({
      field: "weapons",
      weight: "CRITICAL",
      score: 0,
      value: null,
      level: "MISSING",
      lastUpdatedAtSegment: 5,
    });
    expect(effectiveFieldScore(f, 5)).toBe(0);
  });
});

describe("sttEvidenceFactor", () => {
  it("maps STT into [0.75, 1]", () => {
    expect(sttEvidenceFactor(undefined)).toBe(1);
    expect(sttEvidenceFactor(1)).toBe(1);
    expect(sttEvidenceFactor(0)).toBe(0.75);
    expect(sttEvidenceFactor(0.5)).toBe(0.875);
  });
});

describe("applyScoreAdjustments", () => {
  it("nullifies and soft-caps", () => {
    expect(applyScoreAdjustments({ rawScore: 90, valueNullified: true })).toBe(0);
    expect(applyScoreAdjustments({ rawScore: 90, scoreCap: 45 })).toBe(45);
    expect(applyScoreAdjustments({ rawScore: 100, groundingDowngraded: true })).toBe(85);
  });
});

describe("resolveLastUpdatedSegment", () => {
  it("preserves segment when unchanged", () => {
    expect(
      resolveLastUpdatedSegment({
        segmentCount: 20,
        previous: {
          value: "847 Elm",
          score: 80,
          lastUpdatedAtSegment: 8,
          conflictingValues: [],
        },
        value: "847 Elm",
        score: 81,
        conflictingValues: [],
      }),
    ).toBe(8);
  });

  it("advances when value changes", () => {
    expect(
      resolveLastUpdatedSegment({
        segmentCount: 20,
        previous: {
          value: "847 Elm",
          score: 80,
          lastUpdatedAtSegment: 8,
          conflictingValues: [],
        },
        value: "850 Elm",
        score: 80,
        conflictingValues: [],
      }),
    ).toBe(20);
  });
});

describe("computeAggregate", () => {
  it("includes MEDIUM weight and cannot COMPLETE with missing critical", () => {
    const fields: FieldConfidence[] = [
      field({ field: "location", weight: "CRITICAL", score: 95, level: "HIGH", lastUpdatedAtSegment: 10 }),
      field({ field: "incidentType", weight: "CRITICAL", score: 90, level: "HIGH", lastUpdatedAtSegment: 10 }),
      field({
        field: "weapons",
        weight: "CRITICAL",
        score: 0,
        value: null,
        level: "MISSING",
        lastUpdatedAtSegment: 10,
      }),
      field({ field: "injuries", weight: "CRITICAL", score: 85, level: "HIGH", lastUpdatedAtSegment: 10 }),
      field({ field: "numberOfPersons", weight: "MEDIUM", score: 40, level: "LOW", lastUpdatedAtSegment: 10 }),
    ];

    const agg = computeAggregate(fields, 1, 10);
    expect(agg.pictureStatus).not.toBe("COMPLETE");
    expect(agg.criticalGaps).toBeGreaterThan(0);
    expect(agg.attentionRequired).toContain("weapons");
    // Missing critical pulls score well below a CRITICAL-only high mean
    expect(agg.overallScore).toBeLessThan(80);
  });

  it("marks CONFLICTED when any field conflicts", () => {
    const fields: FieldConfidence[] = [
      field({
        field: "location",
        weight: "CRITICAL",
        score: 90,
        level: "CONFLICT",
        conflictingValues: ["a", "b"],
        lastUpdatedAtSegment: 3,
      }),
      field({ field: "incidentType", weight: "CRITICAL", score: 90, level: "HIGH", lastUpdatedAtSegment: 3 }),
    ];
    const agg = computeAggregate(fields, 1, 3);
    expect(agg.pictureStatus).toBe("CONFLICTED");
    expect(agg.hasConflicts).toBe(true);
    expect(agg.overallScore).toBeLessThan(60);
  });

  it("applies audio and STT discounts", () => {
    const fields: FieldConfidence[] = [
      field({ field: "location", weight: "CRITICAL", score: 100, level: "HIGH", lastUpdatedAtSegment: 5 }),
      field({ field: "incidentType", weight: "CRITICAL", score: 100, level: "HIGH", lastUpdatedAtSegment: 5 }),
      field({ field: "weapons", weight: "CRITICAL", score: 100, level: "HIGH", lastUpdatedAtSegment: 5 }),
      field({ field: "injuries", weight: "CRITICAL", score: 100, level: "HIGH", lastUpdatedAtSegment: 5 }),
    ];
    const full = computeAggregate(fields, 1, 5);
    const audio = computeAggregate(fields, 0.8, 5);
    const stt = computeAggregate(fields, 1, 5, { meanSttConfidence: 0 });
    expect(audio.overallScore).toBe(Math.round(full.overallScore * 0.8));
    expect(stt.overallScore).toBe(Math.round(full.overallScore * 0.75));
  });

  it("decays stale fields in the overall score", () => {
    const fresh = field({
      field: "location",
      weight: "CRITICAL",
      score: 100,
      level: "HIGH",
      lastUpdatedAtSegment: 50,
    });
    const stale = field({
      field: "location",
      weight: "CRITICAL",
      score: 100,
      level: "HIGH",
      lastUpdatedAtSegment: 0,
    });
    const freshAgg = computeAggregate([fresh], 1, 50);
    const staleAgg = computeAggregate([stale], 1, 50);
    expect(staleAgg.overallScore).toBeLessThan(freshAgg.overallScore);
  });
});
