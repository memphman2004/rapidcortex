# Pilot configuration model

**Purpose:** describe **where** configuration lives and **who** may change it so pilots stay safe. This is the conceptual layer; exhaustive env tables are in [ENVIRONMENT_CONFIGURATION_REFERENCE.md](./ENVIRONMENT_CONFIGURATION_REFERENCE.md).

## Dimensions

| Dimension | What it governs | Typical storage |
|-----------|------------------|-----------------|
| **Global (product build)** | Shared packages, protocol catalog versions | Repo / release artifact |
| **Environment-specific** | Which AI vendor, strict multilingual, CORS, tables | SAM `DeploymentStage`, Lambda env, web host env |
| **Agency-specific** | Tenant isolation, billing profile, agency-scoped users | JWT `custom:agencyId`, Dynamo agency rows, Cognito attributes |
| **Role-specific** | What UI/API actions a principal may invoke | JWT `custom:role`, API authorizer |

## Layers (stack diagram — text)

1. **Browser (`NEXT_PUBLIC_*`)** — connectivity, pilot UX flags, Cognito **public** identifiers only.
2. **Next.js server** — BFF proxy target, Cognito client secret for auth routes.
3. **HTTP API + Lambdas** — incidents, transcripts, AI orchestration, multilingual pipeline, audit writes.
4. **AWS data plane** — DynamoDB tables, S3 assets bucket, Cognito user pool, Secrets Manager ARNs.

## AI configuration

- **Primary / secondary / tertiary** providers and timeouts are **Lambda** environment (see [AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md), `infra/template.yaml`).
- **Agency admins** see **labels** and chain summary via `GET /api/integration/status` — they do **not** rotate keys in UI.

## Multilingual configuration

- **Tables** (`LANGUAGE_SESSIONS_TABLE`, etc.), **vendor secrets**, and **`MULTILINGUAL_STRICT_VALIDATION`** are **environment**-scoped ([DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md)).
- **Confidence thresholds** (language detection, STT, translation) are **Lambda env** (see [.env.example](../.env.example) and SAM mappings) — **internal change-control**; document values in the agency workbook when tuned for a pilot.

## Retention / privacy

- Product **documents** expectations ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)); **technical enforcement** is Dynamo TTL / lifecycle policies and agency legal process — not a single “retention slider” in pilot UI.

## Audit and monitoring

- **Audit events** emitted per [AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md).
- **CloudWatch / SNS** per [MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md) — ops-owned.

## Change control (sensitive)

1. **No production change** to AI or multilingual chain during active incident exercises without rollback plan.
2. **Two-person rule** (recommended): implementer + reviewer for stage/pilot/prod-like Lambdas.
3. After change: **Admin → Configuration / Integrations** + [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md) smoke.

## Related

- [FEATURE_FLAGS.md](./FEATURE_FLAGS.md)
- [AGENCY_CONFIGURATION_GUIDE.md](./AGENCY_CONFIGURATION_GUIDE.md)
