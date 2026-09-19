# Live Mac Mini runs — 2026-09-19T01:41Z–01:42Z

**Operator:** Jeff Coleman (`AWS_PROFILE=rapid-cortex`)  
**Principal:** `arn:aws:iam::158961537080:user/rapid-cortex-deploy`  
**Account:** `158961537080`  
**Host:** Jeffs-Mac-mini  
**Raw CLI (commit from that machine):** `docs/evidence/soc2-evidence/2026-09/`

## Observation pack

`bash scripts/soc2-observation-pack.sh` completed stamp `20260919T014158Z`. Commands that ran: STS, CloudTrail status/describe/selectors on `rapid-cortex-cloudtrail-prod`, Cognito MFA + describe on `us-east-1_0z6tA6WBs`, ACM alarm `rc-acm-cert-expiry-cc0f7fc4`, CloudWatch OK/ALARM lists, Secrets Manager list (names only), IAM `rapid-cortex-soc2-auditor`.

Review `raw/` on the Mac Mini, then `git add docs/evidence/soc2-evidence/2026-09` and push this branch.

## Access review

`bash scripts/soc2-access-review.sh` completed. Export dir: `docs/evidence/soc2-evidence/2026-09/access-review`. Open that folder, check IAM MFA gaps and Cognito privileged groups, then sign [access-review-log.md](../access-review-log.md).

## Restore drill

| Field | Value |
|-------|--------|
| Ticket | `soc2-restore-20260930` |
| Source | `rapid-cortex-audit-dev` |
| Target | `rapid-cortex-audit-dev-restore-20260919` |
| PITR | ENABLED, 35-day window |
| Earliest restorable | 2026-09-17T18:17:25-04:00 |
| Restore time | ~2026-09-18T21:37:28-04:00 |
| TableStatus at request | **CREATING** (`RestoreInProgress: true`) |
| TableStatus later | **ACTIVE** (`RestoreInProgress` null) |
| DescribeTable ItemCount (restore, immediately after ACTIVE) | **0** (expected stale; DynamoDB updates this ~every 6 hours) |
| DescribeTable ItemCount (source) | **13218** |
| GSI `agencyId-createdAt-index` ItemCount (at create) | **13218** |
| Scan COUNT (restore, after ACTIVE) | **13218 / ScannedCount 13218** (matches source) |
| Production pointer changed | **no** |
| Restore table deleted | **yes** — `delete-table` returned `TableStatus=DELETING` for `rapid-cortex-audit-dev-restore-20260919` only |

**Result:** CC7.5 restore drill **complete**. Production `rapid-cortex-audit-dev` was not cut over and was not deleted.
