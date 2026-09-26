# 3. Access review — 2026-09-19 (pre-window)

**SOP:** [access-review.md](../../processes/access-review.md)  
**Period:** 2026-Q3 close / pre-observation  
**Reviewer:** Jeff Coleman (security lead, interim)  
**Approver:** same person — **segregation exception** R-SOC-016 (small-company; CPA must accept or require a second signer)

Live `scripts/soc2-access-review.sh` **did not run** (no AWS CLI). This review uses Track 1 artifacts only.

## Privileged principals in evidence

| Principal | Type | Source | MFA / control | Decision |
|-----------|------|--------|---------------|----------|
| `rapid-cortex-deploy` | IAM user | STS in 2026-09-17 / 2026-10-snapshot | **Unknown this day** — deploy user; must confirm console MFA + key age on live export | **KEEP** — required for SAM; follow-up MFA |
| `rapid-cortex-soc2-auditor` | IAM role | `auditor-role.json` | Assume-role from account root; ReadOnlyAccess + SecurityAudit; no write | **KEEP** — auditor evidence |
| `rapid-cortex-soc2-evidence-readonly` | IAM role | `auditor-role-evidence-readonly.json` | Read-only companion | **KEEP** |
| Cognito pool `us-east-1_0z6tA6WBs` | User pool | `cognito-mfa-config.json` | `MfaConfiguration=ON`, TOTP enabled | **KEEP** — MFA required at pool |
| Cognito groups `rcsuperadmin` / `rcadmin` / `rcitadmin` | Groups | **not exported** | Member list unknown without AWS | **OPEN** — export before 2026-09-30 |

## Exceptions

| ID | Exception | Expiry | Compensating |
|----|-----------|--------|----------------|
| AR-001 | No live IAM user MFA / access-key inventory | 2026-09-30 | Re-run access-review script |
| AR-002 | No Cognito privileged group membership list | 2026-09-30 | Same |
| AR-003 | Reviewer = approver | Until second privileged human exists | Documented concentration; GitHub PR history as second pair of eyes on IAM template changes |

## Result

**CONDITIONAL PASS** for design of privileged roles. **Not** a complete CC6 operating sample until AR-001 and AR-002 close.

Ledger: [access-review-log.md](../access-review-log.md)
