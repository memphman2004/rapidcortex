# Environment configuration reference

**Companion:** [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md) (stack × stage summary). **Flags narrative:** [FEATURE_FLAGS.md](./FEATURE_FLAGS.md).

This document is the **long-form** operator reference for what each layer consumes. Values change with release — verify against `infra/template.yaml` and `apps/web` for your tag.

## 1. Web application (`apps/web`)

| Variable | Scope | Agency admin sees on Configuration? |
|----------|-------|-------------------------------------|
| `NEXT_PUBLIC_SITE_URL` | Web | Yes |
| `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` | Web | Yes |
| `NEXT_PUBLIC_AUTH_PROXY` | Web | Yes |
| `API_UPSTREAM_BASE` | **Server-only** Next | No (never browser) |
| `NEXT_PUBLIC_API_BASE` | Web (if used) | Yes |
| `NEXT_PUBLIC_OFFLINE_DEMO_MODE` | Web | Yes |
| `NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM` | Web | Yes |
| `NEXT_PUBLIC_DOCUMENTATION_BASE_URL` | Web | Yes |
| `NEXT_PUBLIC_COGNITO_*` | Web (public ids) | Yes |
| `COGNITO_CLIENT_SECRET` | Server-only Next | No |

## 2. HTTP API (Lambda globals)

Set via SAM — see `infra/template.yaml` `Globals.Function.Environment` and stage mappings.

| Concern | Representative variables | Who changes |
|---------|--------------------------|-------------|
| AI providers | `PRIMARY_PROVIDER`, `SECONDARY_PROVIDER`, `TERTIARY_PROVIDER`, model envs | Internal ops |
| AI behavior | `AI_ENABLE_FALLBACKS`, `AI_REQUEST_TIMEOUT_MS`, debounce / rate limits | Internal ops |
| Multilingual | `MULTILINGUAL_STRICT_VALIDATION`, `PRIMARY_STT_PROVIDER`, `LANGUAGE_DETECTION_MIN_CONFIDENCE`, `STT_MIN_CONFIDENCE`, `TRANSLATION_MIN_CONFIDENCE`, … | Internal ops + agency program for thresholds |
| Tables | `INCIDENTS_TABLE`, `TRANSCRIPTS_TABLE`, `ANALYSES_TABLE`, `AUDIT_TABLE`, `LANGUAGE_SESSIONS_TABLE` | Deploy outputs |
| Security | `ALLOW_UNAUTHENTICATED_API` | Must be **false** on pilot/prod-like |

**Agency visibility:** `GET /api/integration/status` exposes **derived** readiness (counts, booleans, tier **labels**) — not secret ARNs.

## 3. Cognito

| Item | Scope | Notes |
|------|-------|-------|
| `custom:agencyId` | Per user | Tenant isolation |
| `custom:role` | Per user | RBAC |
| MFA / password policy | Pool-wide | Agency IT |

## 4. Retention and audit (operations)

| Item | Where controlled | Admin UI |
|------|------------------|----------|
| Dynamo TTL / backups | AWS account / SAM | Indirect — see [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) |
| Audit stream | Lambda writers + Dynamo | **Read** via Admin → Audit |

## 5. Confidence thresholds (multilingual)

Implemented as **Lambda environment** variables (see [LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md) and repo `.env.example`). Tuning affects **503 / review flags** — treat as **sensitive** change-control with validation on staging.

## Related

- [CONFIGURATION_REFERENCE.md](./CONFIGURATION_REFERENCE.md)
- [RUNBOOK_MULTILINGUAL_CALLS.md](./RUNBOOK_MULTILINGUAL_CALLS.md)
