import type { ConfidenceAnalysis } from "rapid-cortex-shared";
import { env } from "../env.js";
import {
  buildFieldsFromParsed,
  computeAggregate,
  mockScoreConfidence,
} from "./aggregate.js";
import type { GroundingFlag } from "../validation/grounding-verifier.js";
import { runConfidenceOrchestrator } from "./confidenceOrchestrator.js";

export type ConfidenceScoreResult = {
  analysis: ConfidenceAnalysis;
  groundingFlags: GroundingFlag[];
};

/**
 * Runs the tiered (primary → secondary → tertiary) AI provider chain — see
 * confidenceOrchestrator.ts — and shapes the winning result into a ConfidenceAnalysis.
 * Throws (via NormalizedAiError) if every configured tier fails; callers fall back to
 * the previous analysis or the mock heuristic (see scoreConfidence below).
 */
export type ScoreConfidenceOptions = {
  /** Mean STT confidence 0–1 from recent transcript segments. */
  meanSttConfidence?: number;
};

export async function scoreConfidenceWithProviderChain(
  incidentId: string,
  agencyId: string,
  transcriptText: string,
  segmentCount: number,
  version: number,
  previous?: ConfidenceAnalysis,
  options: ScoreConfidenceOptions = {},
): Promise<ConfidenceScoreResult> {
  const result = await runConfidenceOrchestrator({ incidentId, agencyId, transcriptText });
  if (!result.ok) {
    throw result.error;
  }

  const audioQualityFactor = Math.min(1, Math.max(0.1, result.output.audioQualityFactor));
  const { fields, groundingFlags } = buildFieldsFromParsed(
    result.output.fields,
    segmentCount,
    previous,
    transcriptText,
  );
  const aggregate = computeAggregate(fields, audioQualityFactor, segmentCount, {
    meanSttConfidence: options.meanSttConfidence,
  });

  return {
    analysis: {
      incidentId,
      agencyId,
      fields,
      aggregate,
      version,
      previousVersion: previous?.version,
    },
    groundingFlags,
  };
}

export async function scoreConfidence(
  incidentId: string,
  agencyId: string,
  transcriptText: string,
  segmentCount: number,
  version: number,
  previous?: ConfidenceAnalysis,
  options: ScoreConfidenceOptions = {},
): Promise<ConfidenceScoreResult> {
  if (env.confidenceScoringMock) {
    const analysis = mockScoreConfidence(incidentId, agencyId, segmentCount, version, previous);
    return { analysis, groundingFlags: [] };
  }

  try {
    return await scoreConfidenceWithProviderChain(
      incidentId,
      agencyId,
      transcriptText,
      segmentCount,
      version,
      previous,
      options,
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        type: "confidence.scorer_failed",
        incidentId,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    if (previous) {
      return {
        analysis: { ...previous, version, previousVersion: previous.version },
        groundingFlags: [],
      };
    }
    return {
      analysis: mockScoreConfidence(incidentId, agencyId, segmentCount, version),
      groundingFlags: [],
    };
  }
}
