# 1. Technical control snapshot — 2026-09-19

**Attempted:** `scripts/soc2-observation-pack.sh` and `scripts/soc2-technical-controls-snapshot.sh`  
**Environment:** Cursor cloud agent (no `aws` binary, no `AWS_PROFILE`, no boto3)  
**Method:** Re-attest the Track 1 CLI pack collected 2026-09-17 (see [2026-10 README](../../../../evidence/soc2-evidence/2026-10/README.md)) and SHA-256 the files so they cannot be silently edited.

This is **not** a new live AWS collection. A Type II firm will want a pack dated in the observation window from `rapid-cortex-soc2-auditor` or `rapid-cortex-deploy`.

## Integrity

Hashes: [docs/evidence/soc2-evidence/2026-09-prewindow/hashes.sha256](../../../../evidence/soc2-evidence/2026-09-prewindow/hashes.sha256)

## Control extract (from named 2026-10 artifacts)

| Control | Artifact result | Pre-window verdict |
|---------|-----------------|-------------------|
| CloudTrail `rapid-cortex-cloudtrail-prod` | `IsLogging` true; `TimeLoggingStopped` empty; log-file validation in describe pack | **PASS** (stale-dated 2026-09-17) |
| Cognito pool `us-east-1_0z6tA6WBs` | `MfaConfiguration=ON`, software token enabled | **PASS** (stale-dated) |
| DynamoDB PITR | 182/182 `ENABLED` in `dynamodb-pitr-post-fix.tsv` | **PASS** (stale-dated) |
| WAF logging | API edge + web CDN CloudFront ACLs have log destinations | **PASS** (stale-dated) |
| ACM expiry alarm `rc-acm-cert-expiry-cc0f7fc4` | Alarm exists, actions → OpsAlerts SNS; **StateValue=`INSUFFICIENT_DATA`** at creation | **ACCEPT with follow-up** — metric may need a daily datapoint; treat missing as breaching |
| Secrets rotation | 36 NexCort iQ secrets; `RotationEnabled` null on all | **ACCEPT** — manual SOP |
| Auditor role | `rapid-cortex-soc2-auditor` + SecurityAudit + ReadOnlyAccess | **PASS** |
| SAM CloudTrail on `rapid-cortex-dev` | Must stay **false** (Option B) | Design lock-in in `deploy.sh` |

## Follow-ups (tickets)

| ID | Item | Due |
|----|------|-----|
| SOC-107a | Re-run both snapshot scripts on a NexCort iQ laptop with `AWS_PROFILE=rapid-cortex` | 2026-09-30 |
| SOC-107b | Confirm ACM alarm leaves `INSUFFICIENT_DATA` | 2026-09-30 |
| R-SOC-002 | Never set `ENABLE_CLOUD_TRAIL=true` on `deploy.sh dev` | standing |

## Cover sheet

- Operator: Jeff Coleman (interim security/eng) via in-repo closeout
- Live CLI path: **not collected this day**
- Control-check row: [monthly-control-check.md](../monthly-control-check.md)
