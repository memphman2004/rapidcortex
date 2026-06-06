# AI analysis architecture

Rapid Cortex turns **incident transcripts** into a **single validated triage JSON object** (category, urgency, confidence, dispatcher-facing strings, escalation flag), then enriches it with **protocol-backed coaching** (`buildProtocolGuidance` + phrase humanizer). The LLM never invents protocol wording; packs supply that layer.

## Production path (staging / pilot / prod)

- **`assertProductionAiConfigHealthy`** (`aiConfig.ts`) runs before orchestration when `DEPLOYMENT_STAGE` is **`staging`**, **`pilot`**, or **`prod`**: the enabled provider chain must not be **mock/off-only** unless `AI_ALLOW_MOCK_ONLY_IN_PROD=true`.
- **SAM Globals** set `PRIMARY_PROVIDER`, `SECONDARY_PROVIDER`, `TERTIARY_PROVIDER` (plus legacy `FALLBACK_*` aliases) per stage — see `infra/template.yaml` `Mappings.ApiLambdaDefaults`.
- **Metadata**: `AI_STORE_PROVIDER_METADATA` defaults **true** — successful analyses persist provider/model, `AI_PROMPT_VERSION`, latency, fallback count, and `providerAttemptChain`.

## High-level flow

1. **Auth + tenancy** — `AnalysisService` loads the incident and enforces `incident.agencyId === user.agencyId` (same as before).
2. **Guards** — optional skip if transcript fingerprint unchanged, debounce window, hourly cap per incident, and a short-lived **Dynamo mutex** (`analysisInFlightUntil`) to reduce duplicate concurrent runs.
3. **Orchestration** — `runAiAnalysisOrchestrator` walks an ordered list of **`IAIProvider` adapters** (primary → secondary → tertiary when `AI_ENABLE_FALLBACKS=true`). `off` removes a tier; `mock` is for dev/tests.
4. **Per attempt** — each adapter gets `AI_REQUEST_TIMEOUT_MS` (AbortController), up to `AI_MAX_RETRIES_PER_PROVIDER` **retryable** failures with exponential backoff + jitter. Non-retryable failures (invalid JSON, schema validation) advance to the next provider immediately.
5. **Validation** — all providers return **text or JSON** parsed by `parseAndValidateAnalysisOutput` (Zod + one bounded JSON repair pass).
6. **Persistence** — successful runs write `AIAnalysis` to DynamoDB (with optional extended metadata), update incident summary fields, and emit **`analysis.created`** audit. Failures emit **`analysis.failed`** (no analysis row). Skips emit **`analysis.skipped`**.

## Components (code)

| Piece | Role |
|-------|------|
| `iaiProvider.ts` | `IAIProvider` contract (`adapterName`, `providerKind`, `model`, `analyze(input, { signal })`). |
| `providers/openaiAdapter.ts` | OpenAI Chat Completions, `response_format: json_object`. |
| `providers/anthropicAdapter.ts` | Anthropic Messages API. |
| `providers/bedrockAdapter.ts` | Amazon Bedrock `Converse` API. |
| `providers/mockAdapter.ts` | Deterministic heuristic output for local/tests. |
| `aiProviderFactory.ts` | Resolves API keys (env + Secrets Manager cache) and builds the chain. |
| `aiOrchestrator.ts` | Timeout, retries, validation, metrics logs. |
| `aiConfig.ts` | Typed env surface + legacy mapping (`FALLBACK_PROVIDER` → secondary, etc.). |
| `mapUnknownToAiError.ts` | Normalized `AI_*` error codes for APIs and audits. |

## Observability

- Structured **`ai.metric`** JSON lines (CloudWatch Logs) for attempt start/success/failure, fallback, chain failure, and analysis success.
- SAM adds **Lambda Errors** and **Duration p95** alarms for `AnalyzeIncidentFunction`.

## Related docs

- [AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md) — env vars, secrets, models.
- [RUNBOOK_AI_ANALYSIS.md](./RUNBOOK_AI_ANALYSIS.md) — operations and troubleshooting.
- [API_SURFACE.md](./API_SURFACE.md) — `POST /api/incidents/{id}/analyze` contract.
