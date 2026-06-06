# Phase 5 — AI provider architecture

## Implemented

- **Provider contract** — `apps/api/src/ai/provider.ts` (`AIProvider`, `AnalysisInput`).
- **Primary / fallback / secondary** — `primaryProvider.ts`, `fallbackProvider.ts`, `secondaryFallbackProvider.ts` (`SECONDARY_FALLBACK_PROVIDER=mock|openai|off`).
- **Pipeline** — `apps/api/src/ai/analysisPipeline.ts` (`runTranscriptAnalysisPipeline`): ordered attempts, structured logging on success (`ai.provider.chain.success`) and failure (`ai.provider.failure`).
- **Strict Zod** — `analysisOutputSchema.ts` + `parseAndValidateAnalysisOutput`; failures log `ai.output.validation_failed` then throw `AnalysisOutputValidationError`.
- **Confidence** — `apps/api/src/ai/confidence.ts` clamps persisted confidence to **0–1** after validation.
- **Prompts** — `prompts.ts` expanded: non-authoritative stance, uncertainty, JSON-only, enum lock, no invented procedures.
- **Phrase humanizer (stub)** — `phraseHumanizer.ts` pass-through on protocol `recommendedPhrase` (hook for future LLM tone pass with validators).
- **Persistence** — unchanged `AnalysisService` path; audit now includes `usedSecondaryFallback`.

## Environment

| Variable | Purpose |
|----------|---------|
| `PRIMARY_PROVIDER` | `mock` \| `openai` |
| `FALLBACK_PROVIDER` | `mock` \| `openai` |
| `SECONDARY_FALLBACK_PROVIDER` | `mock` \| `openai` \| `off` |

## Exit criteria

- Mock and OpenAI providers are **swappable** via env.
- Malformed model JSON is **rejected** before persistence.
- Analysis flow remains **stable** with up to three provider attempts.
