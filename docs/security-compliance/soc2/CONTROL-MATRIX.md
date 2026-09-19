# TSC control matrix (CC1–CC9)

**Not a Type II report.** Maps AICPA Trust Services Criteria (2017, security category) to Rapid Cortex policies, technical evidence, and operating evidence. Confidentiality/privacy/availability/processing-integrity categories are **not** in the first Type II scope unless management expands the engagement letter.

**Technical snapshots:** [2026-10 evidence pack](../../evidence/soc2-evidence/2026-10/README.md).  
**System:** [SYSTEM-BOUNDARY.md](./SYSTEM-BOUNDARY.md).

Legend for **Type II readiness**:

| Tag | Meaning |
|-----|---------|
| DESIGN | Control description exists in this pack |
| TECH | AWS/application evidence already collected (2026-09-17 / 2026-10) |
| OPS | Needs filled logs/tickets during the window (templates ready) |
| SIGN | Needs management/HR signature outside git |
| FIRM | Needs CPA firm |

---

## CC1 — Control environment

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC1.1 COSO / integrity | Code of conduct; acceptable use; no certification overclaim | [01](./policies/01-information-security-policy.md), [02](./policies/02-code-of-conduct.md) | Signed ack log [hr-training-log](./evidence/hr-training-log.md) | DESIGN + SIGN |
| CC1.2 Board oversight | Management reviews this pack annually; board or equivalent signs policies | [01](./policies/01-information-security-policy.md) | Signature page stored off-git | SIGN |
| CC1.3 Structure | Roles: Security lead, Eng lead, Ops on-call (NEEDS OWNER until named) | [01](./policies/01-information-security-policy.md), [OPS_CONTACT_MATRIX](../../operations-runbooks/OPS_CONTACT_MATRIX.md) | Filled contact matrix (private) | DESIGN + SIGN |
| CC1.4 Competence | Security awareness + onboarding/offboarding | [12](./policies/12-hr-security-awareness.md), [hr SOP](./processes/hr-onboarding-offboarding.md) | Training log | DESIGN + SIGN |
| CC1.5 Accountability | Performance of access reviews, IR, change control assigned | This matrix + quarterly calendar | Completed logs | OPS |

## CC2 — Communication and information

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC2.1 Internal comms | Policies in git; on-call via SNS/ops topic | [01](./policies/01-information-security-policy.md), [MONITORING_AND_OPS](../../operations-runbooks/MONITORING_AND_OPS.md) | Policy commit history; SNS subscriptions | DESIGN + OPS |
| CC2.2 External comms | Questionnaire, subprocessors, DPA draft; no Type II claim | [SECURITY_QUESTIONNAIRE_RESPONSES](../SECURITY_QUESTIONNAIRE_RESPONSES.md), [SUBPROCESSOR_LIST](../SUBPROCESSOR_LIST.md) | Customer send log (CRM, off-git) | DESIGN |
| CC2.3 Incident comms | Severity cadence; agency-facing factual updates | [07](./policies/07-incident-response-policy.md), [INCIDENT_RESPONSE](../../operations-runbooks/INCIDENT_RESPONSE.md) | Ticket + post-incident notes | DESIGN + OPS |

## CC3 — Risk assessment

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC3.1 Objectives | Assistive SaaS; CAD write-back fail-closed; human-in-the-loop | [06](./policies/06-risk-assessment-policy.md), [NON_GOALS](../../go-to-market-sales/NON_GOALS.md) | This pack | DESIGN |
| CC3.2 Identify risks | Combined register (product + SOC 2) | [06](./policies/06-risk-assessment-policy.md), [risk-register](./evidence/risk-register.md), [phase-0](../../phase-0/risk-register.md) | Quarterly review dates | DESIGN + OPS |
| CC3.3 Fraud | Privileged access, deploy keys, secret handling | [03](./policies/03-access-control-policy.md) | Access reviews; CloudTrail | DESIGN + TECH + OPS |
| CC3.4 Change in risk | Shared-account carve-out; CFN param drift; secrets without auto-rotation | [SYSTEM-BOUNDARY](./SYSTEM-BOUNDARY.md) | R-SOC-* rows | DESIGN + OPS |

## CC4 — Monitoring

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC4.1 Ongoing monitoring | CloudWatch alarms, WAF logs, ACM expiry, CloudTrail | [10](./policies/10-logging-monitoring-policy.md) | Monthly observation pack | TECH + OPS |
| CC4.2 Evaluations | Monthly control check + G3 security suite | [monthly-control-check](./evidence/monthly-control-check.md), [g3-security-controls-platform](../../security/g3-security-controls-platform.md) | Script output | OPS |
| CC4.1 deficiency | Findings enter triage SLAs | [SECURITY_TRIAGE_PROCESS](../SECURITY_TRIAGE_PROCESS.md) | Tickets | OPS |

## CC5 — Control activities / technology

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC5.1–CC5.3 | IaC (SAM), PR review, feature flags, least-privilege Lambda IAM | [04](./policies/04-change-management-policy.md), [11](./policies/11-secure-development-policy.md) | Git history; `validate:iam` | DESIGN + OPS |
| CC5.2 technology | AWS as processor; no wildcard IAM in new statements | `.cursorrules`; `scripts/check-iam-novalue-resources.py` | CI / `sam validate --lint` | DESIGN |

## CC6 — Logical and physical access

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC6.1 Logical access | Cognito JWT + RBAC; MFA ON on production pool | [03](./policies/03-access-control-policy.md) | `cognito-mfa-config.json`; access review | TECH + OPS |
| CC6.2 Provisioning | Joiner/mover/leaver | [hr SOP](./processes/hr-onboarding-offboarding.md) | Tickets + Cognito disable | OPS + SIGN |
| CC6.3 Removal | Offboarding within 1 business day for involuntary; same day for compromise | [12](./policies/12-hr-security-awareness.md) | Access review exceptions | OPS |
| CC6.6 Credentials | Secrets Manager; manual rotation SOP; no secrets in git | [secrets-rotation-sop](../../evidence/soc2-evidence/2026-10/secrets-rotation-sop.md) | Inventory + tickets | TECH + OPS |
| CC6.7 Transmission | TLS 1.2+; CORS allowlist | [SECURITY_MODEL](../SECURITY_MODEL.md) | ACM + CloudFront | TECH |
| CC6.8 Physical | AWS data centers (inherited); Rapid Cortex has no production colo | [SYSTEM-BOUNDARY](./SYSTEM-BOUNDARY.md) | AWS SOC reports (request from AWS) | FIRM (inherited) |

## CC7 — System operations

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC7.1 Detection | Alarms, WAF, CloudTrail, audit events | [10](./policies/10-logging-monitoring-policy.md) | Observation pack | TECH + OPS |
| CC7.2 Anomalies | Security triage SLAs | [SECURITY_TRIAGE_PROCESS](../SECURITY_TRIAGE_PROCESS.md) | Tickets | OPS |
| CC7.3–CC7.4 Incidents | IR policy + tabletop | [07](./policies/07-incident-response-policy.md), [tabletop](./processes/incident-response-tabletop.md) | Tabletop log | DESIGN + OPS |
| CC7.5 Recovery | PITR 182/182; restore drill | [08](./policies/08-business-continuity-policy.md), [restore-drill](./processes/restore-drill.md) | Drill log + PITR TSV | TECH + OPS |

## CC8 — Change management

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC8.1 Changes | PRs to `main`; `deploy.sh` for live; I_UNDERSTAND_DEV_IS_PROD=1 | [04](./policies/04-change-management-policy.md), [change SOP](./processes/change-management.md) | Change log + git SHAs | DESIGN + OPS |

## CC9 — Risk mitigation (vendor / business disruption)

| Criterion | Control activity | Policy / SOP | Evidence | Readiness |
|-----------|------------------|--------------|----------|-----------|
| CC9.1 Vendors | Subprocessor inventory; quarterly review; DPA draft | [05](./policies/05-vendor-management-policy.md), [vendor SOP](./processes/vendor-management.md) | Vendor review log | DESIGN + OPS |
| CC9.2 Business disruption | BCP/PITR/restore; CAD write-back stays off | [08](./policies/08-business-continuity-policy.md) | Restore drill | DESIGN + TECH + OPS |

---

## Sampling hints for the CPA firm (once engaged)

- **Daily / continuous:** CloudTrail `IsLogging`, Cognito MFA ON, PITR ENABLED (spot-check tables `agencies`, `audit`, incident/transcript).
- **Monthly:** observation pack zip; alarm history; secret rotation tickets if any.
- **Quarterly:** access review sign-off; vendor list diff; risk register.
- **Period:** at least one IR tabletop and one restore-to-**new**-table drill with screenshots/CLI and a ticket ID.

Do not give auditors write credentials. Use `rapid-cortex-soc2-auditor`.
