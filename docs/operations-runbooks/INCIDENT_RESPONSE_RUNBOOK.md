# Security incident response runbook (operator draft)

**Audience:** Security + engineering on-call.  
**Disclaimer:** Adapt to your org’s SOC2/IR playbooks. This is a **starter** aligned to AWS-native Rapid Cortex deployments.

## Severity levels (suggested)

| Level | Examples | Initial response |
|-------|-----------|------------------|
| P1 | Suspected active breach, mass data exfiltration, credential leak | Page on-call; freeze deploys; start evidence timeline |
| P2 | Repeated 403/401 anomalies, WAF spike, suspicious presign volume | Triage in SIEM; enable WAF count mode |
| P3 | Single account compromise suspicion | Disable Cognito user; revoke refresh tokens |

## Immediate containment

1. **Compromised user:** Cognito admin API / console — disable user, revoke sessions, rotate app client secret if client secret was exposed.
2. **Leaked API key / webhook secret:** Rotate in Secrets Manager / Square dashboard; redeploy SAM with new parameter ARNs.
3. **Suspected open S3:** S3 console — verify **Block Public Access**; remove any unintended bucket policies; CloudTrail data event query on `PutBucketPolicy`.

## Evidence collection

- **CloudTrail** management + data events (S3/Dynamo if enabled).
- **API Gateway access logs** (enable if not already) with `requestId` correlation to Lambda `@requestId`.
- **`X-Request-Id`** returned to clients (where implemented) — map support tickets to logs.
- **Do not** copy full transcripts or PII into tickets — use internal incident IDs and timestamps.

## Recovery

- Patch vulnerable code path; run `npm audit`, `npm run security:scan-secrets`, CI green.
- Post-incident: update `docs/SECURITY_HARDENING_AUDIT.md` “Remaining risks” and run root-cause review.

## Contacts

- Configure **SNS ops topic** email/SMS in SAM parameters for deployment alerts.
- Document customer security contact separately (per agency).
