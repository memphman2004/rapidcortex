# 5a. IR tabletop — IAM access key leak — 2026-09-19

**SOP:** [incident-response-tabletop.md](../../processes/incident-response-tabletop.md)  
**Policy:** [POL-07](../../policies/07-incident-response-policy.md)  
**Scenario:** 1 — IAM key leaked  
**Type:** Discussion-based (no production mutation)  
**Facilitator / attendees:** Jeff Coleman (management + security + eng + on-call combined). Attendee count: **1**.  
**Start / end (UTC):** 2026-09-19T01:30Z – 2026-09-19T02:15Z (45 min; shorter than 60 because single operator)  
**Residual:** CPA firms prefer ≥2 attendees. Repeat with a deputy when hired (R-SOC-015).

## Inject

At 01:30Z a GitHub secret-scanning email (hypothetical) reports IAM access key prefix `AKIA…DTC6` in a public gist, labeled `rapid-cortex-deploy`. Unknown: whether the gist is still public, whether the key was used, whether S3/Dynamo were listed.

## Walkthrough (POL-07)

| Clock | Step | Decision | Runbook |
|-------|------|----------|---------|
| T+0 | Detect | Treat as **SEV-1** (credential leak). Freeze non-emergency `deploy.sh dev`. | POL-07, INCIDENT_RESPONSE_RUNBOOK |
| T+5 | Contain | Disable the leaked access key (`iam:UpdateAccessKey` Inactive) then create a replacement for `rapid-cortex-deploy`. Do **not** delete the user. Do not rotate unrelated AI vendor keys unless CloudTrail shows they were read. | INCIDENT_RESPONSE_RUNBOOK § Immediate containment |
| T+10 | Preserve | `cloudtrail lookup-events` for the access key ID; export to evidence bucket; **no transcripts in the ticket**. Trail in scope: `rapid-cortex-cloudtrail-prod`. | POL-10, SYSTEM-BOUNDARY |
| T+20 | Scope | Check: new IAM users, GetSecretValue, Dynamo Scan, S3 GetObject on `rapid-cortex-*`. If GetSecretValue on AI/Ring secrets → enter rotation SOP (names only in ticket). | secrets-rotation-sop |
| T+30 | Recover | Confirm MFA on console login; new key only in password manager; bounce any long-lived CI that used the old key. | POL-03 |
| T+40 | Comms | Internal: OpsAlerts SNS. External: only if customer data access is evidenced — draft DPA notice, **do not send** in this drill. Floor message if any: “assistive layer may pause; CAD remains system of record.” | POL-07, SUPPORT_MODEL |
| T+45 | Post-incident | Ticket follow-ups below. Timeline within 10 business days if this were live. | POL-07 §7 |

**Not done in this drill (by design):** no IAM keys were disabled; no secrets rotated; no customer email sent.

## Gaps found

| Gap | Follow-up |
|-----|-----------|
| Single operator / no deputy | R-SOC-015 hire or name backup |
| PLT-025 paging not proven (phone/PagerDuty) | Subscribe a monitored mailbox/SMS to OpsAlerts and screenshot |
| ACM alarm still `INSUFFICIENT_DATA` | SOC-107b |
| Access-review script not yet live | AR-001 |
| Deploy user MFA not proven in this packet | AR-001 |
| No break-glass runbook for “disable deploy key while a SAM deploy is in flight” | New ticket SOC-115 |

## Result

Tabletop **executed** as a paper SEV-1. Use this packet plus a second live session when a backup person exists.

Ledger: [tabletop-log.md](../tabletop-log.md)
