# Security questionnaire — response pack (draft)

**Audience:** agency IT security, CJIS coordinators, procurement.  
**Status:** **DRAFT** — customize per RFP; not a certification. Remove or edit rows that do not apply to the **specific** deployment profile (pilot vs production, modules sold).

**Supporting artifacts:** [SECURITY_MODEL.md](./SECURITY_MODEL.md), [SUBPROCESSOR_LIST.md](./SUBPROCESSOR_LIST.md), [TENANT_ISOLATION_MODEL.md](./TENANT_ISOLATION_MODEL.md), [AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md), [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md), data flow PDF in Internal Product requirements.

---

## Company & service

| Question | Response |
|----------|----------|
| Service description | Cloud SaaS **assistive** intelligence for emergency communications — transcription, translation, AI summaries, supervisor QA, optional CAD-adjacent workflows. Does **not** replace CAD, 911, or dispatch authority. |
| Primary hosting | Amazon Web Services (Lambda, API Gateway, DynamoDB, S3, Cognito, etc.) — see [SUBPROCESSOR_LIST.md](./SUBPROCESSOR_LIST.md). |
| CJIS certification claim? | **No.** We provide **alignment** documentation; agency maps controls to their CJIS program. |
| SOC 2 Type II report? | **Not in repo.** Alignment statement available; formal report via sales when available. |

---

## Data classification & tenancy

| Question | Response |
|----------|----------|
| Tenant isolation | Partitioned by **`agencyId`** on DynamoDB access and API authorization — [TENANT_ISOLATION_MODEL.md](./TENANT_ISOLATION_MODEL.md). |
| URL slug as security boundary? | **No.** JWT claims (`custom:agencyId`, `custom:role`) enforce access. |
| Cross-tenant access | Only **`rcsuperadmin`** platform role; logged and restricted to RC operators. |
| Sensitive data types | Incident metadata, transcripts, AI output, audit events, optional media — treat as **law enforcement / operational sensitive** minimum. |

---

## Authentication & access control

| Question | Response |
|----------|----------|
| Identity provider | AWS **Cognito** User Pool; JWT validated server-side (JWKS). |
| MFA | Cognito MFA-capable; **agency policy** enables requirement. |
| RBAC | Role strings in `custom:role`; enforced via `AuthorizationService` in API — [AUTH_OPERATIONS.md](../product-architecture/AUTH_OPERATIONS.md). |
| Session / tokens | httpOnly cookies when auth proxy enabled; no long-lived API keys in browser for standard users. |
| Service accounts | Lambda IAM roles per function; Secrets Manager ARNs for provider keys — no keys in git. |

---

## Encryption

| Question | Response |
|----------|----------|
| In transit | TLS 1.2+ for browser, API Gateway, AWS service calls. |
| At rest | DynamoDB and S3 AWS-managed encryption by default; KMS CMK upgrade path per agency policy. |
| Key management | AWS KMS / Secrets Manager; operator rotates secrets per runbook. |

---

## Logging & monitoring

| Question | Response |
|----------|----------|
| Application logging | Structured logs to CloudWatch; **policy:** no raw transcripts, passwords, or refresh tokens in logs — [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md). |
| Audit trail | Agency-scoped audit events in DynamoDB — [AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md). |
| Infrastructure audit | CloudTrail recommended; template may include trail bucket — verify stack outputs. |
| Alerting | CloudWatch alarms + SNS ops topic; customer paging is operator responsibility (PLT-025). |

---

## AI & third-party processing

| Question | Response |
|----------|----------|
| Autonomous dispatch? | **No.** Human-in-the-loop; AI is decision **support** only — [PILOT_GOVERNANCE.md](../go-to-market-sales/PILOT_GOVERNANCE.md). |
| AI providers | Default AWS (Bedrock, Transcribe, Translate, Comprehend); optional external keys only when explicitly configured. |
| CJIS-sensitive mode | Prefer AWS-only providers; unset external secret ARNs — [CJIS_ALIGNMENT_NOTES.md](./CJIS_ALIGNMENT_NOTES.md). |
| Model training on customer data? | **No** use of agency incident content to train public foundation models per standard enterprise AI terms (confirm in executed DPA). |

---

## Vulnerability & incident response

| Question | Response |
|----------|----------|
| Secure SDLC | IaC (SAM), PR review, CI tests; dependency lockfiles. |
| Penetration testing | **Agency may require** written pen-test SOW before production; not bundled in repo. |
| Incident response | [INCIDENT_RESPONSE.md](../operations-runbooks/INCIDENT_RESPONSE.md); security triage [SECURITY_TRIAGE_PROCESS.md](./SECURITY_TRIAGE_PROCESS.md). |
| Breach notification | Per executed **DPA** and MSA incident articles (legal template — PLT-003). |

---

## Business continuity & backup

| Question | Response |
|----------|----------|
| DynamoDB backup | PITR available per stage in template; verify enabled for pilot/prod. |
| Restore testing | GA-005 — restore drill required before production SLA claims — [BACKUP_AND_RECOVERY.md](../operations-runbooks/BACKUP_AND_RECOVERY.md). |
| RTO / RPO | **Not guaranteed** in pilot unless Exhibit C SLA executed with numbers. |

---

## Compliance mappings (informal)

| Framework | Posture |
|-----------|---------|
| CJIS Security Policy | Control **alignment** documented — not FBI approval |
| HIPAA / BAA | **BAA not in repo** — hospital vertical requires separate legal package |
| FedRAMP | **Not claimed** |
| SOC 2 | Readiness-oriented practices; formal report separate |

---

## Attachments checklist for RFP response

- [ ] [SUBPROCESSOR_LIST.md](./SUBPROCESSOR_LIST.md)
- [ ] Data flow diagram PDF (Internal Product requirements)
- [ ] CJIS alignment statement PDF
- [ ] Network diagram (agency-specific — fill per deployment)
- [ ] Executed DPA (post-signature)
- [ ] Insurance certificate (if required — **not in repo**)

---

## Version

| Version | Date | Notes |
|---------|------|-------|
| 0.1 | 2026-07-09 | Initial draft for pilot procurement |
