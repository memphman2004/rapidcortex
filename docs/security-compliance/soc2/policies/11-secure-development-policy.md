# POL-11 Secure development policy

| Field | Value |
|-------|--------|
| Policy ID | POL-11 |
| TSC | CC8.1, CC5.2, CC4.2 |
| Owner | Jeff Coleman (interim engineering lead) |
| Approver | Management |
| Effective | DRAFT 2026-09-19 |
| Review | Annual |

**Not a Type II report.** Complements [SECURITY_TRIAGE_PROCESS.md](../../SECURITY_TRIAGE_PROCESS.md) and [CI_RELEASE_PIPELINE.md](../../../deployment-infrastructure/CI_RELEASE_PIPELINE.md).

## 1. Secure SDLC

- TypeScript strict; Zod from `packages/shared` for API I/O; no duplicate types.
- RBAC at handler entry; `agencyId` on DynamoDB access.
- Feature flags: default ON when unset except CAD write-back.
- Mock/dev paths for external AWS/AI when secrets are absent.
- Secrets Manager **ARNs**, never raw secrets in templates.
- No wildcard IAM; no `AWS::NoValue` inside IAM Resource/Action lists.

## 2. Security testing (when CI is configured by the operator)

This repo does not ship GitHub Actions. Operators must run equivalent gates: `npm audit`, `npm run test:security`, IaC scan, SAST. Merge-blocking SLAs: Critical 24h, High 48h, Moderate in sprint unless accepted.

## 3. Dependencies

Lockfiles committed. High/critical `npm audit` findings follow triage. License policy blocks GPL/AGPL in product runtime unless accepted.

## 4. Production data in non-prod

Do not copy live transcripts into staging. Staging may share **secret ARNs** for vendor keys (isolation is Dynamo/S3/Cognito, not those keys) — still no live incident rows.
