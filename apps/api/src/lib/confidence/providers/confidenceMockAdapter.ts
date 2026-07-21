import { FIELD_REGISTRY } from "rapid-cortex-shared";
import type { ConfidenceInput, IConfidenceAiProvider } from "../confidenceProvider.js";

/**
 * In-chain mock tier (used when a provider kind resolves to "mock", e.g. dev/test
 * configs). Distinct from `mockScoreConfidence()` in aggregate.ts, which is the
 * heuristic used when the whole orchestrator chain fails or CONFIDENCE_SCORING_MOCK
 * is set — this one just reports every field as unscored so it round-trips cleanly
 * through the same schema/aggregation path as a real provider response.
 */
export class ConfidenceMockAdapter implements IConfidenceAiProvider {
  readonly adapterName: string;
  readonly providerKind = "mock" as const;
  readonly model = "mock-heuristic" as const;

  constructor(opts?: { adapterName?: string }) {
    this.adapterName = opts?.adapterName ?? "mock";
  }

  async score(_input: ConfidenceInput, _options?: { signal?: AbortSignal }): Promise<unknown> {
    const fields = Object.fromEntries(
      Object.keys(FIELD_REGISTRY).map((fieldKey) => [
        fieldKey,
        {
          value: null,
          sourceQuote: null,
          score: 0,
          reason: "Mock provider — no scoring performed.",
          suggestedQuestion: null,
          conflictingValues: [] as string[],
        },
      ]),
    );
    return Promise.resolve({ fields, audioQualityFactor: 1 });
  }
}
