# Runbook — AI analysis

## Quick triage

| Symptom | Likely cause | What to check |
|---------|--------------|----------------|
| HTTP **503** + `AI_CONFIG_ERROR` | Mock-only or missing secrets in **staging / pilot / prod** | `DEPLOYMENT_STAGE`, provider chain, `OPENAI_*` / `ANTHROPIC_*` secrets, or `AI_ALLOW_MOCK_ONLY_IN_PROD=true`. |
| HTTP **503** + `AI_ALL_PROVIDERS_FAILED` | Every tier failed validation or HTTP | CloudWatch logs for `ai.provider.failure` and `ai.metric` `chain_all_failed`. |
| HTTP **429** “Another analysis is already running” | Overlapping POSTs | Wait for lease (`AI_ANALYSIS_IN_FLIGHT_LEASE_SECONDS`) or inspect incident `analysisInFlightUntil`. |
| HTTP **429** hourly cap | Too many runs | Lower `AI_MAX_ANALYZE_REQUESTS_PER_INCIDENT_PER_HOUR` or investigate automation loops. |
| HTTP **409** transcript unchanged | Skip guard | Expected when transcript fingerprint matches last success; add transcript or adjust `AI_SKIP_IF_TRANSCRIPT_UNCHANGED`. |
| **Bedrock** access denied | IAM | Lambda role must allow `bedrock:Converse` on the model / inference profile ARN you configured. |

## Logs and metrics

- Search log group for **`"type":"ai.metric"`** — includes `provider_attempt_failed`, `fallback_invoked`, `chain_all_failed`, `analysis_succeeded`.
- Search for **`ai.provider.failure`** — raw provider errors (messages are sanitized; never log API keys).
- **CloudWatch alarms** (SAM): `AnalyzeIncidentErrorsAlarm`, `AnalyzeIncidentDurationP95Alarm`.

## Rotating API keys

1. Create a new **Secrets Manager** secret version (or new secret) with the key material.
2. Update stack parameter **`OpenAiApiKeySecretArn`** / **`AnthropicApiKeySecretArn`** (or env in non-SAM deploys).
3. `sam deploy` (or equivalent). Runtime caches secrets for **5 minutes** (`runtimeSecrets.ts`); wait or redeploy Lambdas to flush sooner.

## Disabling a provider

Set that tier’s env to **`off`**. Example: tertiary off — `TERTIARY_PROVIDER=off`. To run **mock only**: `PRIMARY_PROVIDER=mock` and `AI_ENABLE_FALLBACKS=false` (or set secondary/tertiary `off`).

## Forcing mock mode in dev

```
PRIMARY_PROVIDER=mock
SECONDARY_PROVIDER=off
TERTIARY_PROVIDER=off
AI_ENABLE_FALLBACKS=false
```

## Schema failures

If logs show **`AI_SCHEMA_VALIDATION_FAILED`** or **`AI_INVALID_RESPONSE`** across all tiers, inspect whether the model ignores the JSON-only system prompt. Mitigations: switch model, lower temperature (requires code change today), or tighten prompts in `apps/api/src/ai/prompts.ts` with a new `AI_PROMPT_VERSION` value.

## Timeouts

Raise **`AI_REQUEST_TIMEOUT_MS`** (or Lambda **Timeout**, max 15 minutes on AWS) if legitimate runs exceed the window. If **p95 duration** alarm fires, check provider status pages, region choice for Bedrock, and transcript size.
