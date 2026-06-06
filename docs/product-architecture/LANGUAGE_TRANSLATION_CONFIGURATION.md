# Language & translation configuration

Configure multilingual voice via **environment variables** on Lambdas that run **`postIncidentAudioChunk`** and **`addTranscriptChunk`** (SAM wires optional **Secrets Manager** ARNs in `infra/template.yaml`).

**AWS-first setup (secrets, IAM, stages, fail-fast):** [DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md).

## Provider selection (vendor slugs)

Each tier accepts: **`azure` | `google` | `aws` | `mock` | `off`**.

Legacy values **`aws_comprehend`** and **`aws_translate`** normalize to **`aws`**.

| Variable | Purpose |
| --- | --- |
| `PRIMARY_LANGUAGE_DETECTOR` / `SECONDARY_*` / `TERTIARY_*` | Text LID chain (after STT text exists, or transcript POST). |
| `PRIMARY_STT_PROVIDER` / `SECONDARY_*` / `TERTIARY_*` | STT chain for audio chunks. |
| `PRIMARY_TRANSLATION_PROVIDER` / `SECONDARY_*` / `TERTIARY_*` | English translation chain. |

## v1 language allowlist (top 10)

Default **`SUPPORTED_CALL_LANGUAGES`**: **`en,es,zh,tl,vi,ar,fr,ko,ru,pt`**.

- Outside this set, segments may flag **`needsInterpreterReview`** (see `transcriptEnglishPipeline` + `ENABLE_INTERPRETER_ESCALATION_FLAG`).
- **`zh`** routing: Mandarin-first; Cantonese normalized into the `zh` bucket with human-review expectations (see [MULTILINGUAL_CALL_PIPELINE.md](./MULTILINGUAL_CALL_PIPELINE.md)).

## General

| Variable | Default | Notes |
| --- | --- | --- |
| `SUPPORTED_CALL_LANGUAGES` | top-10 US list | Comma-separated allowlist. |
| `ENABLE_TRANSLATION_TO_ENGLISH` | `true` | When `false`, English pipeline skips translation. |
| `ENABLE_INTERPRETER_ESCALATION_FLAG` | `true` | Sets `needsInterpreterReview` from confidence / unsupported language. |
| `AUTO_FEED_TRANSLATED_TRANSCRIPTS_TO_ANALYSIS` | `true` | Gates periodic auto-analyze after segments. |
| `CALL_STREAM_CHUNK_MS` | `2000` | Operational tuning for clients. |
| `MAX_TRANSCRIPT_REORDER_WINDOW_MS` | `30000` | Ordering guard tuning. |
| `LANGUAGE_DETECTION_MIN_CONFIDENCE` | `0.65` | Below → low-confidence / interpreter review. |
| `STT_MIN_CONFIDENCE` | `0.55` | Below → session `needsInterpreterReview`. |
| `TRANSLATION_MIN_CONFIDENCE` | `0.6` | Below → low-confidence segment. |
| `PROVIDER_REQUEST_TIMEOUT_MS` | `55000` | Per-attempt wall clock for STT/translation/LID HTTP or batch poll budget (capped internally for Transcribe polling). |
| `PROVIDER_MAX_RETRIES` | `2` | Per-provider retry count for retryable errors. |
| `PROVIDER_ENABLE_FALLBACKS` | `true` | When `false`, only **primary** tier runs. |

## Azure

| Variable | Description |
| --- | --- |
| `AZURE_SPEECH_KEY` | Inline key (dev only). |
| `AZURE_SPEECH_KEY_SECRET_ARN` | Secrets Manager ARN (JSON may include `AZURE_SPEECH_KEY` or plain string). |
| `AZURE_SPEECH_REGION` | e.g. `eastus`. |
| `AZURE_SPEECH_ENDPOINT` | Optional STT base URL (trailing slash stripped). If unset, STT uses `https://<AZURE_SPEECH_REGION>.stt.speech.microsoft.com` (see `azureSpeechSttProvider`). Prefer that default or an explicit `*.stt.speech.microsoft.com` host—**not** `https://<region>.api.cognitive.microsoft.com/`, which is the generic Cognitive Services REST root and may not serve this STT path. |
| `AZURE_SPEECH_STT_MODEL` | Label stored on segments (`sttModelUsed`). |
| `AZURE_TRANSLATION_KEY` | Falls back to `AZURE_SPEECH_KEY` when unset. |
| `AZURE_TRANSLATION_KEY_SECRET_ARN` | Falls back to speech secret ARN when unset. |
| `AZURE_TRANSLATION_REGION` | Defaults to speech region. |
| `AZURE_TRANSLATION_MODEL` | Label stored on segments. |

## Google Cloud

| Variable | Description |
| --- | --- |
| `GOOGLE_CLOUD_PROJECT_ID` | GCP project for Speech + Translate APIs. |
| `GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN` | Secret string = **service account JSON** (production). |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Inline JSON (local dev only; do not commit). |
| `GOOGLE_STT_MODEL` | Passed to Speech `recognize` config (`default` if unset). |
| `GOOGLE_TRANSLATION_MODEL` | Metadata label for segments. |

OAuth scopes use **`https://www.googleapis.com/auth/cloud-platform`**.

## Text tool path (silent text, language-session metadata) — `LANGUAGE_PROVIDER`

Independent of the **per-tier** `PRIMARY_*` / `SECONDARY_*` / `TERTIARY_*` voice & transcript settings above, **text** translation (and optional **Google TTS** for stored audio) uses:

| Variable | Default | Description |
| --- | --- | --- |
| `LANGUAGE_PROVIDER` | `auto` | `aws` — AWS Comprehend/Translate + voice translation chain where applicable; `google` — Google Cloud Translation v2 (REST) + Google Text-to-Speech for TTS; `auto` — use Google when `GOOGLE_CLOUD_PROJECT_ID` and credentials (secret or inline) exist, else AWS. |
| `GOOGLE_TRANSLATE_LOCATION` | `global` | Passed to the Translation v2 base URL. |
| `GOOGLE_TTS_LOCATION` | `global` | Region segment for the Text-to-Speech v1 `text:synthesize` host. |
| `GOOGLE_TTS_OUTPUT_BUCKET` | empty | If set, synthesized MP3 is written under `multilingual-tts/…` in that bucket; otherwise `ASSETS_BUCKET` is used when TTS must persist. |
| `SILENT_TEXT_TRANSLATION_ENABLED` | `true` | Fills `translatedForDispatcher` / `translatedForCaller` on silent-text messages. |
| `SILENT_TEXT_TTS_ENABLED` | `false` | When `true` and the text backend is Google, dispatcher → caller messages may include `ttsObjectKey` (S3) for the translated line. **AWS Polly TTS** is not implemented for this path yet. |

**Secrets:** use the same **service account JSON** in Secrets Manager as live Google Speech/Translate; enable **Cloud Translation API** and **Cloud Text-to-Speech API** in GCP, and grant the principal `roles/translate.user` and Text-to-Speech access (e.g. `roles/serviceusage.serviceUsageConsumer` on the project plus TTS/Translate product enablement). Never commit raw JSON; prefer `GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN` (or `MultilingualSecretProvisioning=managed` placeholder → replace after deploy per [DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md)).

`infra/template.yaml` injects `GOOGLE_CLOUD_PROJECT_ID`, `LANGUAGE_PROVIDER`, `GOOGLE_*_LOCATION`, `GOOGLE_TTS_OUTPUT_BUCKET`, and `GOOGLE_APPLICATION_CREDENTIALS_SECRET_ARN` on **all** API Lambdas via **Globals**; **SilentText** functions include IAM for `translate:TranslateText`, `comprehend:DetectDominantLanguage`, `secretsmanager:GetSecretValue` (per `MultilingualSecretsPolicyMode`), and S3 on `AssetsBucket` for TTS objects.

## AWS

| Variable | Description |
| --- | --- |
| `AWS_TRANSCRIBE_REGION` | Transcribe client region (default `AWS_REGION`). |
| `AWS_TRANSLATE_REGION` | Translate client region. |
| `AWS_COMPREHEND_REGION` | Comprehend LID region. |
| `ASSETS_BUCKET` | **Required for AWS Transcribe path** — audio staged under `voice-stt/…`. |

### Amazon Transcribe (batch STT)

Full reference: **[AWS_TRANSCRIBE_CONFIGURATION.md](./AWS_TRANSCRIBE_CONFIGURATION.md)** (`AWS_TRANSCRIBE_LANGUAGE_IDENTIFICATION`, `AWS_TRANSCRIBE_LANGUAGE_OPTIONS`, IAM, metrics, troubleshooting).

## Recommended pilot provider stack

| Tier | STT | Language ID (text) | Translation → English |
| --- | --- | --- | --- |
| Primary | **Azure Speech** | **Azure Translator** detect | **Azure Translator** |
| Secondary | **Google Cloud Speech-to-Text** | **Google Translate** v2 detect | **Google Translate** v2 |
| Tertiary | **AWS Transcribe** (batch + S3) | **Amazon Comprehend** | **Amazon Translate** |

Set with `PRIMARY_STT_PROVIDER=azure`, `SECONDARY_STT_PROVIDER=google`, `TERTIARY_STT_PROVIDER=aws` (and the analogous `PRIMARY_LANGUAGE_DETECTOR` / `PRIMARY_TRANSLATION_PROVIDER` envs). **`off`** disables a tier.

## SAM parameters (optional)

`infra/template.yaml` defines:

- `AzureSpeechKeySecretArn`
- `AzureTranslationKeySecretArn`
- `GoogleApplicationCredentialsSecretArn`
- `GoogleCloudProjectId` — passed as `GOOGLE_CLOUD_PROJECT_ID` in Globals.
- `LanguageProvider` — `aws` | `google` | `auto` → `LANGUAGE_PROVIDER` in Globals.
- `GoogleTtsOutputBucket` — optional override; empty means use `ASSETS_BUCKET` for TTS object keys in code.
- `MultilingualSecretProvisioning` (`external` | `managed`) — when `managed`, the stack creates placeholder secrets; see [DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md).
- `MultilingualSecretsPolicyMode` (`scoped` | `broad`) — controls `GetSecretValue` IAM on the two multilingual **audio** Lambdas and **Silent Text** (scoped path: `rapidcortex/<stage>/multilingual*`, or pass `GoogleApplicationCredentialsSecretArn` in external mode; use `broad` only for legacy/odd secret names).

They are injected into **`PostIncidentAudioChunkFunction`** and **`AddTranscriptChunkFunction`** as `*_SECRET_ARN` env vars (may be empty in dev). **Globals** set `MULTILINGUAL_STRICT_VALIDATION` from `DeploymentStage` (`dev` = false, `staging`/`prod` = true).

## Production checklist

1. Set **`DEPLOYMENT_STAGE`** to **`staging`** or **`prod`** on the stack so **`MULTILINGUAL_STRICT_VALIDATION`** is **true** and **`ApiLambdaDefaults`** selects **AWS-first** multilingual tiers (see **`docs/DEPLOYMENT_MULTILINGUAL_AWS.md`**). Ensure **`ASSETS_BUCKET`** is set when **AWS Transcribe** is in the STT chain.
2. Run **`validateMultilingualDeploymentConfig()`** / fail-fast responses (missing keys when Azure/Google tiers are enabled; missing bucket when AWS STT is enabled).
3. Prefer **Secrets Manager** over inline env keys for Azure/Google.
4. Ensure Lambdas have **IAM**: Transcribe + S3 (already on assets bucket), Translate, Comprehend, Bedrock (analysis), Secrets Manager read where used, plus **outbound HTTPS** to Azure/Google when those tiers are enabled.
5. Tighten **HttpApi CORS** with SAM parameter **`HttpApiCorsAllowedOrigins`** (comma-separated origins; avoid `*` in real production).

## Example: Azure → Google → AWS

```bash
PRIMARY_STT_PROVIDER=azure
SECONDARY_STT_PROVIDER=google
TERTIARY_STT_PROVIDER=aws
PRIMARY_TRANSLATION_PROVIDER=azure
SECONDARY_TRANSLATION_PROVIDER=google
TERTIARY_TRANSLATION_PROVIDER=aws
PRIMARY_LANGUAGE_DETECTOR=azure
SECONDARY_LANGUAGE_DETECTOR=google
TERTIARY_LANGUAGE_DETECTOR=aws
```

Fill matching credentials and regions before enabling in production.
