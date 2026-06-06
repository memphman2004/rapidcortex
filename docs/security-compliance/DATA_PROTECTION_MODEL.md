# Data protection model

Rapid Cortex processes **agency-scoped operational data**: incidents, callers, transcripts, media, translations, and AI-derived analysis. This document describes **data protection expectations** for engineering and operations. It is **not** a legal data processing agreement.

## Classification (engineering view)

| Class | Examples | Handling |
|-------|-----------|----------|
| Highly sensitive | Live transcripts, caller video, addresses, CAD-linked identifiers | Encrypt in transit (TLS 1.2+), encrypt at rest (DynamoDB/S3 defaults + explicit bucket encryption), minimize retention, strict RBAC |
| Sensitive | AI summaries, QA notes, coaching notes | Same as above; avoid logging raw content |
| Operational metadata | Incident IDs, timestamps, correlation IDs | May appear in logs in redacted / truncated form |

## Storage

- **DynamoDB:** Prefer table design and GSIs that always filter by `agencyId` or `incidentId` under tenant-scoped access patterns. Enable **PITR** in staging/prod/pilot (see `DynamoPointInTimeRecovery` in SAM). Use **TTL** attributes where defined for ephemeral rows (tokens, sessions).
- **S3:** Buckets must be **private**; **block public access** explicitly on application buckets (see `AssetsBucket` in `infra/template.yaml`). Object keys should incorporate **`agencyId` and `incidentId`** in path prefixes (e.g. `incident-media/{agencyId}/{incidentId}/...`) — enforce in presign Lambdas.
- **Presigned URLs:** Generated only after **server-side** authorization that binds `(user, agencyId, incidentId, object key)`; never accept raw S3 keys from clients without validation.

## Logging

- Do **not** log full request bodies for sensitive routes.
- Use **`apps/api/src/lib/safe-log.ts`** (`redactFreeText`, `safeJsonPreview`, `logSecurityEvent`) for new code paths.
- CloudWatch log groups should have **retention** set (many Lambdas in SAM already declare retention).

## AI / external providers

- Treat external LLM/STT/TTS as **data processors**: redact or minimize payloads where feasible; use configuration flags to disable external paths in CJIS-sensitive deployments (see `docs/CJIS_ALIGNMENT_NOTES.md`).
- Log **usage metadata** (model id, token counts, latency) — not full prompts or transcripts — unless under explicit audited diagnostic mode.

## Retention & deletion

- Retention is **agency policy + legal** driven. Provide **configuration placeholders** in admin surfaces and Dynamo attributes; enforce in scheduled jobs (documented, not all implemented in this repo pass).

## Malware / content safety

- **Extension point:** After upload confirmation, enqueue object for async scan (third-party AV or AWS-based pipeline) before dispatcher release — document in backlog; do not claim scanning is active until wired.
