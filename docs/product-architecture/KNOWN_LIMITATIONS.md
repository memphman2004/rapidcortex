# Known limitations (pilot — honest list)

Rapid Cortex is built for a **controlled pilot**. This page states boundaries clearly so agencies do not discover them under pressure.

**Promise control:** external-facing language should follow [PROMISE_CONTROL.md](./PROMISE_CONTROL.md), [SALES_BOUNDARIES.md](./SALES_BOUNDARIES.md), [PILOT_NON_GOALS.md](./PILOT_NON_GOALS.md), [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md), [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md), and [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) so maturity is not oversold. **Pilot configuration** assumptions: [IMPLEMENTATION_ASSUMPTIONS.md](./IMPLEMENTATION_ASSUMPTIONS.md). **Onboarding:** [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md). **Support:** [SUPPORT_MODEL.md](./SUPPORT_MODEL.md), [FAQ_INTERNAL.md](./FAQ_INTERNAL.md). **Pilot measurement:** [PILOT_SUCCESS_METRICS.md](./PILOT_SUCCESS_METRICS.md), [FEEDBACK_LOOP.md](./FEEDBACK_LOOP.md); index: [PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md).

## Integration and data feed

- **CAD / RMS / 911 CPE** — No first-party bidirectional CAD integration in the baseline pilot path; incidents are created via the **product API** or admin flows unless your deployment adds a connector ([INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)).
- **Radio / telephony audio** — Vendor-neutral live radio ingest is **not** a first-agency GA promise; multilingual **audio chunks** require an integration that supplies audio to the API ([MULTILINGUAL_CALL_PIPELINE.md](./MULTILINGUAL_CALL_PIPELINE.md)).
- **Transcript simulator** — Scripted chunks on **`/dashboard`** may be **disabled by default** when the API is configured; **`/demo`** remains the primary academy path. When enabled (`NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM=1` or offline demo mode), chunks POST to the real transcript API—it is **not** live 911 audio ([NON_GOALS.md](./NON_GOALS.md) §5).

## AI and language

- **AI output** is **assistive**; accuracy varies by modality, language, and noise. Agencies must define **when** supervisors intervene ([MVP_SCOPE.md](./MVP_SCOPE.md)).
- **Multilingual** — Provider fallbacks and confidence scores reduce but do not eliminate **interpretation risk**; `needsInterpreterReview` flags segments for human attention when the pipeline sets them.
- **Strict multilingual validation** — Misconfigured Azure/Google/AWS secrets can cause **503** with `MULTILINGUAL_CONFIG_INVALID` on voice routes until fixed ([LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)).

## Web and auth

- **Offline / training mode** — If neither `NEXT_PUBLIC_AUTH_PROXY=1` nor `NEXT_PUBLIC_API_BASE` is set, the dispatcher UI shows **no fake incident queue** unless you deliberately set **`NEXT_PUBLIC_OFFLINE_DEMO_MODE=1`** for local demos ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md), [NON_GOALS.md](./NON_GOALS.md) §5).
- **Session** — Cookie-based proxy mode is the supported browser pattern; token lifetime follows Cognito app client settings.

## Compliance and certification

- Documentation describes **alignment** with common public-safety expectations; it does **not** claim **CJIS**, **HIPAA**, or **SOC 2** certification ([SECURITY_MODEL.md](./SECURITY_MODEL.md)).

## Product scope

- See [NON_GOALS.md](./NON_GOALS.md) for explicit non-promises.
- Pilot vs roadmap positioning: [PILOT_VS_FUTURE_STATE.md](./PILOT_VS_FUTURE_STATE.md).
- Primary use cases (what “good” looks like when limited): [USE_CASES.md](./USE_CASES.md).

## Updating this list

When a limitation is removed or changed, update this file and [USER_GUIDE.md](./USER_GUIDE.md) in the same PR.
