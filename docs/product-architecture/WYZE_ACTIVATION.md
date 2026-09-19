# Wyze activation (Track 3)

**Status:** Built, gated off on live (`WyzeEnabled=false` on `rapid-cortex-dev` as of 2026-09-17).  
**Goal this month:** first camera integration that actually works.  
**Does not:** replace CAD, enable CAD write-back, or store Wyze keys in git.

Citizen enrollment: `https://www.rapidcortex.us/connect/wyze`  
Dispatcher surfaces: Rapid Vision™ Wyze tab (UI defaults on when `NEXT_PUBLIC_ENABLE_CONNECT_WYZE` is unset).

## Two steps

### 1. Rotate the RC developer secret

Keys come from [Wyze developer API console](https://developer-api-console.wyze.com/#/apikey/view). They are for **RC-owned test devices** only. Homeowner streams use the key pair the resident submits at `/connect/wyze`.

```bash
export AWS_PROFILE=rapid-cortex
export WYZE_KEY_ID='…'
export WYZE_API_KEY='…'
bash scripts/activate-wyze.sh rotate
bash scripts/activate-wyze.sh verify   # optional live Wyze list
```

Secret: `rapid-cortex/connect/wyze-api-keys`  
ARN (live): `arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/connect/wyze-api-keys-YIoY3S`

JSON shape: `{ "keyId": "…", "apiKey": "…" }`. Placeholders (`changeme`, `TODO`, empty) are refused.

### 2. Flip `WyzeEnabled=true` on the live stack

`DeploymentStage=dev` is production (`rapid-cortex-dev`). Do not rename the stack.

```bash
source scripts/env-api-dev.sh
bash scripts/deploy.sh dev
```

`scripts/lib/wyze-live-activation-overrides.sh` (sourced from `deploy.sh`) forces `WyzeEnabled=true` and `ENABLE_CONNECT_WYZE=true` on `STAGE=dev` unless `WYZE_ALLOW_DISABLE_LIVE=1`.

After the SAM update, refresh web env (`scripts/print-stack-outputs-for-web.sh dev`) so ECS sees `NEXT_PUBLIC_ENABLE_CONNECT_WYZE=1` when the stack parameter is true. Then register one RC test camera at `/connect/wyze?agencyId=<pilot-agency>`.

## AlreadyExists risk

Wyze DynamoDB tables and the consent HMAC secret use `DeletionPolicy: Retain`. If they were created on a previous enable and the nested stack later dropped them from the template, the next CREATE fails with AlreadyExists. Live evidence from 2026-09-17 still shows `WyzeEnabled=false` — first enable should CREATE. If AWS already has `rapid-cortex-wyze-registrations-dev`, import or add `Existing*` params before retrying (same pattern as Nest leftover tables).

## Staging

Keep `WYZE_ENABLED=false` on engineering (`scripts/env-api-staging.example.sh`). Do not attach staging APIs to `api.rapidcortex.us`.
