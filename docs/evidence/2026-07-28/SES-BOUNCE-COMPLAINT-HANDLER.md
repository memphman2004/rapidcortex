# SES bounce/complaint handler + production-access preflight

**Date:** 2026-07-28  
**Goal:** Hard bounces permanently suppressed before SES production access / first agency invoice.

## Code / infra shipped

| Piece | Location |
|-------|----------|
| Lambda handler | `apps/api/src/handlers/sesNotification.ts` |
| Unit tests | `apps/api/src/handlers/sesNotification.test.ts` |
| Config set helper on sends | `apps/api/src/lib/ses/sesConfigurationSet.ts` |
| SAM2 resources | `SesTransactionalConfigurationSet`, `SesNotificationsTopic`, event destination, `SesNotificationHandlerFunction` in `infra/nested/stack-app-sam-2.yaml` |
| Env | `SES_CONFIGURATION_SET_NAME` / short key `scs` → default `rapid-cortex-transactional-{stage}` |

**Behavior:** Permanent bounces and complaints call `sesv2:PutSuppressedDestination` and emit structured CloudWatch logs. Transient bounces are logged only (not suppressed).

## Pre-flight (live account, 2026-07-28)

| Check | Result |
|-------|--------|
| Domain `rapidcortex.us` verified + DKIM | **PASS** (prior check: Verified + DKIM SUCCESS) |
| Account suppression `BOUNCE`+`COMPLAINT` | **PASS** (already enabled) |
| Config set with bounce/complaint SNS | **MISSING until AppSam2 deploy** |
| `ProductionAccessEnabled` | **false** (sandbox) — submit Support case after deploy |

## Deploy / ops

```bash
source scripts/env-api-dev.sh
LEAN_DEPLOY_STACKS=sam2 bash scripts/deploy-lean-dev.sh dev
# or full: bash scripts/deploy.sh dev
```

After deploy:

```bash
aws sesv2 list-configuration-sets --region us-east-1
aws sesv2 get-configuration-set-event-destinations \
  --configuration-set-name rapid-cortex-transactional-dev --region us-east-1
```

Then submit SES production access (runbook Step 3) — do **not** submit until config set + handler exist.

## Alarms (optional follow-up)

CloudWatch bounce/complaint rate alarms from the runbook can be added after the config set is live.
