# Feature flags and toggles

Split by **who sets** and **visibility** to avoid treating marketing toggles as security controls.

## Web (`NEXT_PUBLIC_*`) — set on Next.js host

| Variable | Default intent | Agency admin visibility |
|----------|----------------|-------------------------|
| `NEXT_PUBLIC_AUTH_PROXY` | `1` for cookie BFF | Shown on **Admin → Configuration** |
| `NEXT_PUBLIC_API_BASE` | Direct API (alternative to proxy) | Shown |
| `NEXT_PUBLIC_OFFLINE_DEMO_MODE` | **Unset** on pilot | Shown — must be **off** for real pilot |
| `NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM` | **Unset** (toolbar off when API live) | Shown |
| `NEXT_PUBLIC_DOCUMENTATION_BASE_URL` | Optional hosted `docs/` root | Shown |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG`, Cognito public ids | Required for auth | Shown |
| `NEXT_PUBLIC_ENABLE_QA_SCORING` | F1 QA UI + panels | Shown on Configuration |
| `NEXT_PUBLIC_ENABLE_INCIDENT_MEDIA` | F2 caller media surfaces | Shown |
| `NEXT_PUBLIC_ENABLE_SOP_PROTOCOL_AI` | F4 SOP card + admin SOP | Shown |
| `NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE` | F3 triage strip + queue tab | Shown |
| `NEXT_PUBLIC_ENABLE_DISPATCHER_WELLNESS` | F5 supervisor wellness (never enable for dispatcher-only builds) | Shown |

**Not visible in browser (server-only on web):** `API_UPSTREAM_BASE`, `COGNITO_CLIENT_SECRET` — see [INSTALLATION.md](./INSTALLATION.md).

## Lambda / API (pilot-critical)

| Area | Examples | Set via |
|------|----------|---------|
| AI chain | `PRIMARY_PROVIDER`, `SECONDARY_PROVIDER`, `TERTIARY_PROVIDER`, timeouts, debounce | SAM / Lambda env ([AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md)) |
| AI escape hatch | `AI_ALLOW_MOCK_ONLY_IN_PROD` | Lambda only — policy flag |
| Multilingual | `MULTILINGUAL_STRICT_VALIDATION`, `PRIMARY_STT_PROVIDER`, `LANGUAGE_DETECTION_MIN_CONFIDENCE`, `STT_MIN_CONFIDENCE`, `TRANSLATION_MIN_CONFIDENCE`, etc. | SAM / Lambda ([LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)) |
| API auth posture | `ALLOW_UNAUTHENTICATED_API` | Lambda — **false** outside dev |
| F1 QA | `ENABLE_QA_SCORING`, `ENABLE_QA_SCORE_AFTER_ANALYSIS`, `QA_SCORING_MOCK`, `QA_BEDROCK_MODEL_ID`, QA table names | SAM Globals |
| F2 media | `ENABLE_INCIDENT_MEDIA`, `INCIDENT_MEDIA_*` | SAM Globals |
| F4 SOP | `ENABLE_SOP_PROTOCOL_AI`, `SOP_DETECT_EVERY_N_SEGMENTS`, `SOP_DETECTION_MOCK`, `SOP_UPLOAD_URL_TTL_SECONDS` | SAM Globals; agency `config.sop` |
| F3 triage | `ENABLE_NON_EMERGENCY_TRIAGE`, `TRIAGE_DETECT_EVERY_N_SEGMENTS`, `TRIAGE_MOCK` | SAM Globals; agency `config.triage` |
| F5 wellness | `ENABLE_DISPATCHER_WELLNESS`, `TRAUMA_FLAGS_TABLE` | SAM Globals; agency `config.wellness` |

**Agency admin visibility:** summarized via **`GET /api/integration/status`** (strict mode on/off, issue count, primary tier labels) — not per-secret values.

**Dev / staging copy-paste:** see [`scripts/dev-staging-phase2.env`](../scripts/dev-staging-phase2.env) for paired API + web flags and PATCH examples.

## Cognito / product behavior

- **Self-signup** and PostConfirmation triggers — [COGNITO_SELF_SIGNUP.md](./COGNITO_SELF_SIGNUP.md) (not a `NEXT_PUBLIC` flag).

## Related

- [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md) (stack vs web summary)
- [ENVIRONMENT_CONFIGURATION_REFERENCE.md](./ENVIRONMENT_CONFIGURATION_REFERENCE.md) (fuller listing)
- [PILOT_CONFIGURATION_MODEL.md](./PILOT_CONFIGURATION_MODEL.md)
