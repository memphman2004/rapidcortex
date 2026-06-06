# AI provider configuration

This document lists **environment variables** and **SAM parameters** for the multi-provider analysis pipeline. Runtime code reads `process.env` via `apps/api/src/ai/aiConfig.ts` (with caching). Lambda **plaintext keys** work for dev; **staging, pilot, and prod** should use **real providers** (Bedrock IAM and/or Secrets Manager ARNs for OpenAI/Anthropic) — see **`assertProductionAiConfigHealthy`** in `aiConfig.ts`.

## SAM parameters (infra/template.yaml)

| Parameter | Purpose |
|-----------|---------|
| `OpenAiApiKeySecretArn` | Optional ARN of a secret containing the OpenAI API key (plain string or JSON with `apiKey` / `OPENAI_API_KEY`). Wired to env `OPENAI_API_KEY_SECRET_ARN`. |
| `AnthropicApiKeySecretArn` | Same pattern for Anthropic. Env `ANTHROPIC_API_KEY_SECRET_ARN`. |

The template grants **`secretsmanager:GetSecretValue`** on `arn:aws:secretsmanager:${Region}:${Account}:secret:*` to **AnalyzeIncident** and **AddTranscriptChunk** Lambdas only. **Tighten** the `Resource` to explicit secret ARNs when your org requires least privilege.

Bedrock permissions (`bedrock:Converse`, `bedrock:InvokeModel` on `*`) are attached to the same two functions. Scope to inference profiles / foundation model ARNs for GA.

## Provider chain

| Variable | Values | Notes |
|----------|--------|--------|
| `PRIMARY_PROVIDER` | `openai` \| `anthropic` \| `bedrock` \| `mock` \| `off` | First tier in the chain. |
| `SECONDARY_PROVIDER` | same | Second tier when fallbacks enabled. If unset, **`FALLBACK_PROVIDER`** is used (legacy). |
| `TERTIARY_PROVIDER` | same | Third tier. If unset, **`SECONDARY_FALLBACK_PROVIDER`** is used (legacy). |
| `AI_ENABLE_FALLBACKS` | `true` / `false` | When `false`, only **primary** runs (no secondary/tertiary attempts). |

## Models

| Provider | Primary | Secondary | Tertiary |
|----------|---------|-----------|----------|
| OpenAI | `OPENAI_MODEL_PRIMARY` | `OPENAI_MODEL_SECONDARY` (falls back to `OPENAI_MODEL_FALLBACK`, then primary) | `OPENAI_MODEL_TERTIARY` |
| Anthropic | `ANTHROPIC_MODEL_PRIMARY` | `ANTHROPIC_MODEL_SECONDARY` | `ANTHROPIC_MODEL_TERTIARY` |
| Bedrock | `BEDROCK_MODEL_PRIMARY` | `BEDROCK_MODEL_SECONDARY` | `BEDROCK_MODEL_TERTIARY` |

Other OpenAI-related:

- `OPENAI_API_KEY` — dev convenience; overridden by secret resolution when `OPENAI_API_KEY_SECRET_ARN` resolves.
- `OPENAI_BASE_URL` — default `https://api.openai.com/v1`.

Anthropic:

- `ANTHROPIC_API_KEY` — dev convenience.
- `ANTHROPIC_BASE_URL` — default `https://api.anthropic.com`.

Bedrock:

- `BEDROCK_REGION` — defaults to `AWS_REGION`.

## Orchestrator / cost controls

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_REQUEST_TIMEOUT_MS` | `55000` | Per-attempt wall timeout. |
| `AI_MAX_RETRIES_PER_PROVIDER` | `1` | Extra attempts on **retryable** errors only. |
| `AI_PROMPT_VERSION` | `dispatch-triage-v1` | Stored on `AIAnalysis` when metadata enabled. |
| `AI_STORE_PROVIDER_METADATA` | `true` | Persist attempt chain, latency, models, etc. |
| `AI_ANALYSIS_DEBOUNCE_SECONDS` | `0` | Same transcript fingerprint cannot re-run within N seconds (429). |
| `AI_MAX_ANALYZE_REQUESTS_PER_INCIDENT_PER_HOUR` | `120` | Rolling hourly cap (429). |
| `AI_SKIP_IF_TRANSCRIPT_UNCHANGED` | `true` | 409 when fingerprint matches last successful analysis. |
| `AI_ANALYSIS_IN_FLIGHT_LEASE_SECONDS` | `90` | Dynamo lock TTL for concurrent POSTs. |
| `AUTO_ANALYZE_EVERY_N_SEGMENTS` | `0` | Still honored in `addTranscriptChunk` (auto trigger). |

## Production validation (fail-fast)

When `DEPLOYMENT_STAGE` is **`staging`**, **`pilot`**, **`prod`**, or **`production`**, `assertProductionAiConfigHealthy` requires at least one **non-mock** provider in the enabled chain. Enabling **OpenAI** or **Anthropic** without either an inline API key env var **or** the matching secret ARN also yields **`AI_CONFIG_ERROR`** (HTTP **503**) before any network call. Escape hatch: **`AI_ALLOW_MOCK_ONLY_IN_PROD=true`** for sandboxes only.

## Dev / staging / prod separation

Use **different stacks** (or at minimum different **Cognito pools**, **Dynamo tables**, and **Secrets Manager secrets**) per stage. Never share production API keys into developer laptops; use mock or dedicated dev keys.
