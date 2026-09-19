# POL-03 Access control policy

| Field | Value |
|-------|--------|
| Policy ID | POL-03 |
| TSC | CC6.1–CC6.3, CC6.6, CC3.3 |
| Owner | Jeff Coleman (interim security lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Quarterly (with access reviews) |

**Not a Type II report.**

## 1. Identity sources

| Plane | IdP | MFA |
|-------|-----|-----|
| Product (dispatchers, agency admins, RC admin) | Amazon Cognito pool `us-east-1_0z6tA6WBs` | **Required** (`MfaConfiguration=ON`) as of 2026-09-17 |
| AWS console / CLI (operators) | IAM users/roles in account `158961537080` | Hardware or virtual MFA on human IAM users |
| Auditor evidence | Role `rapid-cortex-soc2-auditor` | Assume-role; no standing write |

Canonical product roles: `packages/shared/src/auth/rapid-cortex-roles.ts`. Use `normalizeSessionRole()` before any PSAP migration. `commsupervisor` is deprecated.

AgencyId is **never** taken from URL parameters for authorization.

## 2. RBAC

- API: `AuthorizationService.canPerform()` from `packages/security` at handler entry.
- `rcsuperadmin` is the only role exempt from agencyId scoping; every use is auditable.
- UI: do not gray out permanent RBAC denials — omit the control ([docs/role-dashboard-spec.md](../../../role-dashboard-spec.md)).

## 3. Joiner / mover / leaver

See [hr-onboarding-offboarding.md](../processes/hr-onboarding-offboarding.md).

| Event | Maximum time |
|-------|----------------|
| Grant production AWS or Cognito privileged role | After ticket + second approver |
| Role change | Same ticket; old groups removed |
| Voluntary leaver | Access removed by last day |
| Involuntary leaver | Access removed within **1 business day** (immediately if hostile) |
| Suspected compromise | Disable Cognito user / IAM key **same day** |

## 4. Privileged access

Privileged = IAM that can deploy `rapid-cortex-dev`, read Secrets Manager values, or assume admin on the production Cognito pool; plus product roles `rcsuperadmin`, `rcadmin`, `rcitadmin`.

Privileged access is reviewed **quarterly** ([access-review.md](../processes/access-review.md)). Unused IAM access keys (>90 days unused) are disabled.

## 5. Secrets and credentials

- Production secrets live in AWS Secrets Manager (`rapid-cortex/...`). Rotation: [secrets-rotation-sop.md](../../../evidence/soc2-evidence/2026-10/secrets-rotation-sop.md) (manual; 90/180 day classes).
- No long-lived human keys in the repository. `.env` files with real credentials are gitignored and never committed.
- Lambda uses IAM roles, not embedded keys.

## 6. Remote access / physical

Rapid Cortex does not operate a production data center. AWS physical security is inherited (request AWS Artifact reports). Operator laptops: full-disk encryption, OS auto-update, and unique accounts. Lost device → revoke sessions the same day.

## 7. Quarterly review evidence

`scripts/soc2-access-review.sh` (read-only) + completed [access-review-log.md](../evidence/access-review-log.md).
