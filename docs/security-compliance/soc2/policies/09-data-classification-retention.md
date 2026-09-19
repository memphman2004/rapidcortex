# POL-09 Data classification and retention

| Field | Value |
|-------|--------|
| Policy ID | POL-09 |
| TSC | CC6.1, CC6.7 (data handling) |
| Owner | Jeff Coleman (interim security lead) |
| Approver | Management + privacy (PLT-004) |
| Effective | DRAFT 2026-09-19 |
| Review | Annual or on new PII field |

**Not a Type II report.** Not legal advice. Details: [PRIVACY_RETENTION_DECISIONS.md](../../PRIVACY_RETENTION_DECISIONS.md), [TRANSCRIPT_RETENTION_POLICY.md](../../TRANSCRIPT_RETENTION_POLICY.md).

## 1. Classification

| Class | Examples | Handling |
|-------|----------|----------|
| Restricted operational | Incident metadata, transcripts, AI analyses, caller media | Tenant-scoped; encrypted in transit/at rest; no consumer LLMs |
| Restricted identity | Cognito subjects, emails, MFA | Admin/IT only; audit access |
| Confidential internal | IAM, architecture, this pack | Need-to-know |
| Public | Marketing site copy that is not a certification claim | Promise control |

Treat Restricted operational like CAD-adjacent material.

## 2. Retention

- Default incident/transcript retention is **agency-defined**. `TranscriptRetentionPolicyDays` records SOP horizon; the app does **not** auto-delete DynamoDB rows from that number unless a future job is enabled.
- Legal hold is **agency-owned**.
- Audit events: retain at least through the Type II period plus 1 year (or agency contract, whichever longer).
- CloudTrail / evidence CLI JSON: retain for the report period plus firm retention (minimum 1 year after report issuance).

## 3. Encryption

- In transit: TLS 1.2+.
- At rest: DynamoDB and S3 AWS-managed encryption. No customer-managed KMS keys in production as of 2026-09-17 (ACCEPT for rotation — AWS-managed rotate by AWS). CMK upgrade is an operator path, not claimed as deployed.

## 4. Minimization

`sanitizeForProvider` / grounded replies for AI. Logging policy: no raw transcripts, passwords, or refresh tokens.
