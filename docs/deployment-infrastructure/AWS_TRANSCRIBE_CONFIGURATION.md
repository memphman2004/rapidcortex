# Amazon Transcribe (batch STT) — backend configuration

Rapid Cortex uses **Amazon Transcribe batch jobs** (`StartTranscriptionJob` / `GetTranscriptionJob`) as an **`ISpeechToTextProvider`** implementation (`AwsTranscribeSttProvider`). Audio is staged on **S3** (`ASSETS_BUCKET` under `voice-stt/…`), then Transcribe reads the object via `MediaFileUri`.

**Auth:** IAM role attached to the Lambda (no static AWS keys). **Least privilege** in `infra/template.yaml`: `transcribe:StartTranscriptionJob`, `GetTranscriptionJob`, `DeleteTranscriptionJob` (delete is permitted for ops; the provider cleans up staging objects with `s3:DeleteObject`).

---

## 1. Where it sits in the STT chain

Order is entirely env-driven (`PRIMARY_STT_PROVIDER`, `SECONDARY_STT_PROVIDER`, `TERTIARY_STT_PROVIDER`). The **recommended pilot stack** is:

1. Azure Speech (short audio REST)  
2. Google Cloud Speech-to-Text  
3. **Amazon Transcribe** (tertiary)

SAM defaults for `staging` / `pilot` / `prod` map to **azure → google → aws** (`ApiLambdaDefaults` in `infra/template.yaml`).

Orchestration: `runSttChain` in `apps/api/src/voice/stt/sttOrchestrator.ts` (retries, timeouts, fallbacks, structured metrics).

---

## 2. Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TERTIARY_STT_PROVIDER` | `off` in `dev` | Set to `aws` to enable Transcribe as tertiary (or place `aws` on any tier). |
| `AWS_TRANSCRIBE_REGION` | `AWS_REGION` | Transcribe **and** staging S3 client region for this path. |
| `ASSETS_BUCKET` | _(required when `aws` in STT chain)_ | Staging prefix `voice-stt/*`; strict validation fails if empty. |
| `AWS_TRANSCRIBE_LANGUAGE_IDENTIFICATION` | `true` | When **true** and the chunk has **no** usable `hintLanguage`, start job with `IdentifyLanguage` + `LanguageOptions` (trimmed to **five** codes — AWS limit). |
| `AWS_TRANSCRIBE_LANGUAGE_OPTIONS` | _(see template default)_ | Comma-separated **full** pool of BCP-47 codes; merged with preferred list, then capped at five. |
| `AWS_TRANSCRIBE_PREFERRED_LANGUAGE_OPTIONS` | _(empty)_ | Comma-separated subset; listed **first** when building the five-code `LanguageOptions` set. |
| `AWS_TRANSCRIBE_TIMEOUT_MS` | `0` | Poll budget for job completion; **`0`** means use `min(PROVIDER_REQUEST_TIMEOUT_MS, 110000)`. If set, must be **≥ 5000** in strict validation. |
| `AWS_TRANSCRIBE_ENABLE_PARTIAL_RESULTS` | `false` | **Batch jobs return final transcripts only.** When `true`, the provider emits a metric noting partial streaming is not used (`aws_transcribe_partial_results_unavailable`). |
| `AWS_TRANSCRIBE_MODEL` | _(via `STT_MODEL_TERTIARY`)_ | Label stored on segments as `sttModelUsed` for the tier’s model metadata (`sttModelPrimary` / `Secondary` / `Tertiary` depending on slot). |
| `PROVIDER_REQUEST_TIMEOUT_MS` | `55000` | Outer `withTimeout` around each provider attempt in `runSttChain`. |
| `PROVIDER_MAX_RETRIES` | `2` | Retries **per tier** for retryable errors (`STT_TIMEOUT`, rate limits, 5xx). |

Globals in SAM also set the `AWS_TRANSCRIBE_*` defaults so Lambdas inherit them without per-function duplication.

---

## 3. Language mapping (internal ↔ AWS)

Canonical internal codes (`en`, `es`, `zh`, …) map to Transcribe `LanguageCode` values in `apps/api/src/voice/aws/transcribeLanguageMapping.ts` (`toAwsTranscribeLanguageCode`).

`IdentifyLanguage` **LanguageOptions** are built by `buildAwsTranscribeIdentifyLanguageOptions`, which:

1. Applies **`AWS_TRANSCRIBE_PREFERRED_LANGUAGE_OPTIONS`** order for codes present in the pool.  
2. Fills remaining slots from **`AWS_TRANSCRIBE_LANGUAGE_OPTIONS`** until **five** unique codes.  
3. If `AWS_TRANSCRIBE_LANGUAGE_OPTIONS` is empty, uses the built-in pilot default CSV (same ten locales as the template).

**Strict validation** (`MULTILINGUAL_STRICT_VALIDATION=true`, default on `staging` / `pilot` / `prod`): fewer than **two** resolved options fails validation (AWS requires at least two languages for identification jobs).

---

## 4. Normalized output and persistence

`SttChunkResult` (see `apps/api/src/voice/interfaces.ts`) may include:

- `transcript`, `languageCode`, `confidence`, `isPartial` (always `false` for batch)  
- `sttModelUsed` (tier-specific label from factory)  
- `sttProviderLatencyMs` (wall time inside the Transcribe provider)  
- `providerRequestId` (Transcribe **`TranscriptionJobName`**, prefix `rcstt…`)

`MultilingualCallService` persists `sttProviderRequestId` on `TranscriptSegment` when present (`packages/shared` schema + types).

**Confidence:** taken from `language_identification[0].score` when present, else first segment alternative `confidence`, else **0.82** (documented heuristic for batch JSON without scores).

---

## 5. Metrics (structured logs)

JSON lines with `"type":"voice.metric"`:

| `metric` | When |
|----------|------|
| `aws_transcribe_attempt_started` | Before S3 upload + job start |
| `aws_transcribe_attempt_succeeded` | After transcript JSON parsed |
| `aws_transcribe_attempt_failed` | Start/poll/job failure |
| `aws_transcribe_unsupported_language_hint` | AWS-returned language not in tenant allowlist |
| `aws_transcribe_partial_results_unavailable` | `AWS_TRANSCRIBE_ENABLE_PARTIAL_RESULTS=true` (informational) |
| `stt_fallback_next_tier` | Prior STT tier exhausted, advancing chain |
| `stt_success_after_fallback` | Success on tier index > 0 |

---

## 6. IAM and S3

- Lambda **execution role** must allow Transcribe actions (see template) and **S3 read/write** on `ASSETS_BUCKET` for staging keys.  
- **Bucket policy:** allow the Transcribe service principal to `s3:GetObject` on the staging prefix (AWS requirement for `MediaFileUri`). If jobs fail with access errors, confirm bucket policy and KMS rules (not automated in this repo’s SAM).

---

## 7. Verification

1. Deploy with `PRIMARY_STT_PROVIDER=azure`, `SECONDARY_STT_PROVIDER=google`, `TERTIARY_STT_PROVIDER=aws`, secrets populated, `ASSETS_BUCKET` set.  
2. `GET /api/integration/status` (admin) should show `multilingualIssueCount: 0` when strict validation passes.  
3. Force tertiary: temporarily set primary/secondary to `mock` that throws, or block Azure/Google egress in a sandbox, and confirm **third** tier returns text and `sttFallbackUsed` / `sttProviderRequestId` on segments.  
4. CloudWatch: filter `voice.metric` for `aws_transcribe_attempt_succeeded`.

---

## 8. Troubleshooting

| Symptom | Checks |
|---------|--------|
| `MULTILINGUAL_CONFIG_INVALID` / IdentifyLanguage | Ensure **≥ 2** languages after merge, or provide **session `detectedLanguage`** / `preferredLanguageHint` so fixed `LanguageCode` path runs. |
| `STT_AUTH_ERROR` from Transcribe | IAM role missing `transcribe:*` or S3 permissions. |
| Job `FAILED` in metrics | `FailureReason` in AWS console for the `TranscriptionJobName` (`providerRequestId` on segment). |
| Very high latency | Batch polling — increase `AWS_TRANSCRIBE_TIMEOUT_MS` / Lambda timeout only after measuring p95; prefer smaller audio chunks where possible. |

---

## Related

- [MULTILINGUAL_CALL_PIPELINE.md](./MULTILINGUAL_CALL_PIPELINE.md)  
- [LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)  
- [RUNBOOK_MULTILINGUAL_CALLS.md](./RUNBOOK_MULTILINGUAL_CALLS.md)  
- [DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md)  
