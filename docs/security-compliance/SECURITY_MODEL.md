# Security model — pilot (technical controls)

This document describes **pilot-grade technical controls** implemented in Rapid Cortex. It is **not** a CJIS, HIPAA, FedRAMP, or SOC 2 attestation. Agency security and compliance teams must map these controls to their own policies and any required **external** assessments.

## Trust boundaries

| Zone | Contents | Controls |
|------|------------|----------|
| **Browser** | Next.js UI, httpOnly cookies for Cognito tokens when using the auth proxy | TLS to web origin; no API keys in `NEXT_PUBLIC_*` except Cognito **public** pool/client identifiers. |
| **Next.js server** | BFF routes, `API_UPSTREAM_BASE`, optional `COGNITO_CLIENT_SECRET` | Server env only; host hardening is operator responsibility. |
| **API (Lambda)** | JWT validation, DynamoDB, Secrets Manager reads | IAM least privilege per template direction; no long-lived human keys in repo. |
| **Third-party AI / speech** | Provider payloads | DPAs and flows are **agency + vendor** contracts; see [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md). |

## Secrets

- **AWS Secrets Manager** (preferred): Azure Speech/Translator keys, Google service-account JSON, OpenAI/Anthropic keys — referenced by **ARN** in SAM parameters or Lambda env (`infra/template.yaml`).
- **Managed multilingual secrets**: stack-created placeholders must be replaced before pilot traffic ([DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md)).
- **No production keys in git**: `.env.example` documents names only; CI must not print secrets.

## Logging

- Application logs must **not** include raw **passwords**, **refresh tokens**, **API keys**, or full **transcripts** by policy ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)).
- **`normalizeAuditEventForApi`** (API list path) redacts known sensitive **detail** keys before JSON is returned to browsers.

## Encryption

- **In transit**: HTTPS for web and API; API Gateway TLS for custom domains.
- **At rest**: DynamoDB and S3 use AWS-managed encryption by default; **KMS CMK** per field/table is an operator upgrade path (not claimed as deployed here).

## Authentication & authorization

- **Cognito JWT** (ID token claims) drive `custom:agencyId` and `custom:role`.
- **RBAC** enforced in Lambda services and mirrored in Next.js middleware for UX — see [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md) and [API_SURFACE.md](./API_SURFACE.md).

## Audit

- Append-only **audit events** in DynamoDB for sensitive mutations; vocabulary in [AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md).

## Dependency & config hygiene

- Lockfiles committed; deploy from **pinned** artifacts in pilot.
- **`ALLOW_UNAUTHENTICATED_API`** must be **false** outside local dev.
- **`MULTILINGUAL_STRICT_VALIDATION`** should remain **true** for staging/pilot/prod SAM mappings.

## Compliance dependencies (external)

Formal **CJIS Security Policy** compliance, **state 911** certification, and **vendor-specific** CAD/radio approvals are **out of product scope** for this repo’s documentation claims — see [NON_GOALS.md](./NON_GOALS.md). This file exists so engineers and agencies share a **common technical vocabulary** without overstating certification.

## Related

- [AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md)
- [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)
- [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)
