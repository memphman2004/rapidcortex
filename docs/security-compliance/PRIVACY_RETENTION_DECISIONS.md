# Privacy and retention — pilot decisions

This document defines **what the product is designed to store**, **what it does not store by default**, and **agency expectations** for retention, export, and deletion. It is **not** legal advice; agency counsel should align this with local law and policy.

Related: [MVP_SCOPE.md](./MVP_SCOPE.md), [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md), [SECURITY_MODEL.md](./SECURITY_MODEL.md), [AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md), [phase-0/risk-register.md](./phase-0/risk-register.md) (R4).

---

## 1. Data classification (pilot)

Treat as **sensitive operational data** (protect like CAD-adjacent material):

- Incident **metadata** (titles, status, agency identifiers, dispatcher assignments as implemented).
- **Transcript** segments (text, timestamps, speaker labels).
- **AI analyses** (structured fields, rationale text, snapshots referencing protocol packs).
- **Audit events** (who did what, on which resource—**not** full transcript bodies in audit payloads by design direction; verify deployment logging).

**Authentication identifiers** (email, Cognito subject) are processed for auth and admin flows per identity configuration.

## 2. What is stored (typical DynamoDB / configured tables)

Aligned with current API persistence patterns:

| Category | Stored content (summary) | Primary persistence |
|----------|-------------------------|---------------------|
| Incidents | Agency-scoped incident records | DynamoDB incidents table |
| Transcripts | Per-incident segments | DynamoDB transcripts table |
| AI analyses | Structured analysis runs per incident | DynamoDB analyses table |
| Audit | Agency-scoped audit events | DynamoDB audit table |
| Language / voice sessions | Session state for multilingual pipeline (when enabled) | DynamoDB language sessions table (see multilingual docs) |
| Assets | Optional S3 objects (e.g. audio artifacts) when features use configured bucket | S3 (per stack config) |

Exact table names and keys follow deployment outputs (`infra/template.yaml`, [INSTALLATION.md](./INSTALLATION.md)).

## 3. What is not stored (by default product intent)

- **Raw provider API keys** in application tables (use Secrets Manager / env as deployed).
- **Full transcript text in application CloudWatch logs** — product direction is minimum-necessary logging; operators should verify subscription filters and log fields in their account.
- **Customer model weights** trained on agency data (non-goal; [NON_GOALS.md](./NON_GOALS.md)).

Third-party **AI providers** may process content in flight per their terms—agencies must complete their own DPA / flow review for chosen providers.

## 4. Retention — expectations

**Deploy-time flag (SOP, not auto-delete):** the SAM template exposes **`TranscriptRetentionPolicyDays`**; when set, all API Lambdas receive **`TRANSCRIPT_RETENTION_POLICY_DAYS`** (documented in [TRANSCRIPT_RETENTION_POLICY.md](./TRANSCRIPT_RETENTION_POLICY.md)). This records the agency’s **target** horizon for transcript-related data; the application does **not** delete DynamoDB items solely from this number unless a future jobs feature is enabled.

| Topic | Pilot expectation |
|-------|-------------------|
| Default retention period | **Agency-defined**; the stack does not automatically expire incident rows on a legal calendar by default—agencies must plan disposition (export → delete, or hold). |
| Legal hold | **Agency-owned** workflow; product does not replace e-discovery tooling ([NON_GOALS.md](./NON_GOALS.md)). |
| Backups | Enable **DynamoDB PITR** and document restore drills for prod before real data ([infra/monitoring-and-ops.md](../infra/monitoring-and-ops.md)). |

Admin UI may surface **retention / compliance placeholders**—operational enforcement is **deployment + process**, not a single toggle.

## 5. Export

- **API-level access** to incidents, transcripts, and analyses for authorized roles is the primary **technical export** mechanism for pilot (subject to RBAC).
- Bulk export formats, scheduled dumps, or SIEM streaming are **integration workstreams**—document any agency-specific export pipeline in the [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md).

## 6. Delete

- **User deactivation** is an identity/admin concern (Cognito).
- **Incident / transcript / analysis deletion** as a one-click “right to be forgotten” product feature may be partial in MVP—pilot agencies must confirm **actual** delete APIs and runbooks with engineering for their stack version.
- **Crypto-erasure** or backup rewrites are **infra processes**—not implied by app-only deletes.

## 7. Review triggers

Any new **PII field**, **logging** of content fields, or **cross-border** processing change → **privacy review** with counsel (see [phase-0/risk-register.md](./phase-0/risk-register.md)).
