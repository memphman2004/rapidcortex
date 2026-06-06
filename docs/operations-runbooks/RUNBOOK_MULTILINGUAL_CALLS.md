# Runbook: multilingual calls

## AWS deploy / secrets / IAM

See **[DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md)** (managed vs external secrets, scoped IAM, outputs, checklist) and **[SECURITY_MODEL.md](./SECURITY_MODEL.md)** (secrets boundaries — not a compliance attestation).

## Idempotent `POST .../audio-chunks`

- **HTTP 201** — new chunk processed; new transcript segment.
- **HTTP 200** — same `sequence` as the last successful chunk: **replayed** response with the **existing** segment (no double STT billing).
- **HTTP 409** — duplicate or **out-of-order** `sequence` when not a recognized replay.

## Symptoms

### 503 from `POST /api/incidents/{id}/audio-chunks` or `POST .../transcript`

If the body includes **`code`: `MULTILINGUAL_CONFIG_INVALID`** and an **`issues`** array, the Lambda **fail-fast** check failed (strict validation). Fix env/secrets per [DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md), or set `MULTILINGUAL_STRICT_VALIDATION=false` only in non-production sandboxes.

If the body includes **`code`** such as `STT_ALL_PROVIDERS_FAILED`, `TRANSLATION_ALL_PROVIDERS_FAILED`, or `PROVIDER_CONFIG_ERROR`, see provider sections below.

1. Check **CloudWatch Logs** for the **`PostIncidentAudioChunkFunction`** log stream (structured lines with `"type":"voice.metric"`).
2. Map **`code`** using `apps/api/src/voice/voiceErrorCodes.ts`.
3. If **`STT_AUTH_ERROR`** / **`TRANSLATION_AUTH_ERROR`**: rotate or fix **Secrets Manager** payloads (Azure keys, Google service-account JSON).
4. If **`STT_ALL_PROVIDERS_FAILED`**: inspect the **last** inner error in logs; verify **network egress**, **regions**, and **ASSETS_BUCKET** when AWS Transcribe is in the chain. For Transcribe-specific env, IAM, and `LanguageOptions` limits, see [AWS_TRANSCRIBE_CONFIGURATION.md](./AWS_TRANSCRIBE_CONFIGURATION.md).

### High latency on audio chunks

AWS **Transcribe batch** polls until completion (up to **`PROVIDER_REQUEST_TIMEOUT_MS`**). Expect higher **p95** than Azure/Google short audio. Tune:

- Client **chunk size** (`CALL_STREAM_CHUNK_MS` guidance to integrators).
- **`PROVIDER_REQUEST_TIMEOUT_MS`** and **Lambda timeout** (default 120s on audio-chunk Lambda).

### Low confidence / interpreter review spikes

1. List transcript segments for the incident; inspect **`lowConfidence`**, **`needsInterpreterReview`**, **`languageAlternatives`**, **`sttFallbackUsed`**, **`translationFallbackUsed`**.
2. Lower thresholds only after operational review (avoid hiding ambiguity).

## Disable a provider tier

Set tier to **`off`** or reorder primaries, for example:

```bash
PRIMARY_STT_PROVIDER=azure
SECONDARY_STT_PROVIDER=off
TERTIARY_STT_PROVIDER=off
```

Or set **`PROVIDER_ENABLE_FALLBACKS=false`** to force **primary only** (still retries within primary).

## Secret rotation

1. Create a new Secrets Manager secret version (Azure key JSON or plain string; Google **full service account JSON**).
2. Update SAM parameter / Lambda env **`AZURE_SPEECH_KEY_SECRET_ARN`** (or Google ARN).
3. Redeploy or update Lambda configuration.
4. Wait for runtime secret cache TTL (**5 minutes** in `runtimeSecrets.ts`) or redeploy Lambdas to clear execution environment.

## DynamoDB

**No new GSIs required** for v1. `TranscriptSegment` gains optional multilingual metadata fields; older items remain valid.

## CloudWatch alarms

`infra/template.yaml` includes:

- **`PostIncidentAudioChunkErrorsAlarm`**
- **`PostIncidentAudioChunkDurationP95Alarm`**

Tune thresholds per environment after baseline metrics.

## Related

- [MULTILINGUAL_CALL_PIPELINE.md](./MULTILINGUAL_CALL_PIPELINE.md)
- [LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)
