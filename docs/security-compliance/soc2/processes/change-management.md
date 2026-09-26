# SOP — Change management (production)

**TSC:** CC8.1  
**Policy:** [POL-04](../policies/04-change-management-policy.md)

## Standard change

1. Ticket with: what, why, risk (low/med/high), rollback, whether IAM/Cognito/WAF/CloudTrail/PITR is touched.
2. PR + review (second person for infra).
3. Staging deploy when the change is not an emergency.
4. Live: `source scripts/env-api-dev.sh && bash scripts/deploy.sh dev`. Confirm the console shows `DDB_ENABLE_PITR=true` from the SOC 2 override library. Confirm it did **not** set `EnableCloudTrail=true`.
5. Smoke: `GET /api/health` and any route touched.
6. Log a row in [change-log.md](../evidence/change-log.md) with git SHA.

## Rollback

Failed CloudFormation may auto-rollback. Successful-but-bad: redeploy previous tag. Data writes are **not** undone by app rollback — use PITR restore SOP.

## Emergency

SEV-1 may go live first. File the change-log row the same day; complete PR review within 2 business days.
