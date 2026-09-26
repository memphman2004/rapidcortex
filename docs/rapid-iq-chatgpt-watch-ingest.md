# ChatGPT Watch → NexiQ Inbox ingest

Machine-authenticated ingest that lands Watch findings in the **NexiQ Inbox** only.
Human operators still choose **+ Pipeline** before Leads CRM.

## Endpoint

```
POST {API_BASE}/api/rapid-iq/pipeline/watch-ingest
```

Headers:

```
Content-Type: application/json
x-nexcort-watch-key: <api-key>
# or: Authorization: Bearer <api-key>
```

- **Auth:** API key from Secrets Manager (`RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN`), not Cognito JWT.
- **Host (live):** `https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com` (HttpApi3).  
  `api.rapidcortex.us` maps to HttpApi1 only — do **not** use it for watch-ingest until a mapping exists.
- **Body:** one object or an array (max 25) matching `rapidIqWatchIngestBodySchema` in `packages/shared`.

Route is live on HttpApi3 (`POST /api/rapid-iq/pipeline/watch-ingest`, auth `NONE` at API Gateway; key checked in Lambda). CFN still needs an **import** of orphan signal/credits routes before the next `EnableRapidIqNewHttpRoutes=true` nested deploy (otherwise AlreadyExists rollback).

## Deduplication

`external_key` is authoritative. Same key → update existing Inbox card (deadline / status / evidence / activity), not a duplicate.

Suggested key forms:

- With solicitation: `STATE|AgencySlug|SolicitationNumber`
- Early signal: `STATE|AgencySlug|NormalizedTitle|FY`

## Secret setup

```bash
bash scripts/create-watch-ingest-secret.sh
# copy the printed export + x-nexcort-watch-key value

source scripts/env-api-dev.sh
# ensure RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN is set
# Prefer surgical pipeline deploy; if CFN hits AlreadyExists on signal routes,
# update SignalHttp code/env + create-route CLI (see stack template comments).
bash scripts/deploy-rapid-iq-pipeline-api-dev.sh
```

## Smoke test

```bash
API_BASE=https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com
# or: bash scripts/smoke-watch-ingest.sh (after exporting RAPID_IQ_WATCH_INGEST_API_KEY)
KEY='…'

curl -sS -X POST "${API_BASE}/api/rapid-iq/pipeline/watch-ingest" \
  -H "Content-Type: application/json" \
  -H "x-nexcort-watch-key: ${KEY}" \
  -d '{
    "source": "chatgpt_watch",
    "watch": "psap_rfp",
    "external_key": "LA|CalcasieuParishSheriff|RFP-SMOKE-1",
    "signal_type": "rfp",
    "vertical": "911_psap",
    "agency": { "name": "Calcasieu Parish Sheriff'\''s Office", "city": "Lake Charles", "state": "LA" },
    "opportunity": {
      "title": "Smoke test public safety software",
      "solicitation_number": "RFP-SMOKE-1",
      "posted_date": "2026-09-24",
      "due_date": "2026-11-13",
      "estimated_value": null,
      "procurement_url": "https://example.gov/rfp/smoke-1",
      "status": "open"
    },
    "qualification": { "fit": "high", "strategy": "partner", "reason": "Smoke test" },
    "next_action": "Dismiss after verifying Inbox badge",
    "evidence": [{ "url": "https://example.gov/rfp/smoke-1", "source_type": "official_procurement" }]
  }'
```

Then open NexiQ IQ → **Watch Feed** (or 911 tab) and confirm **CHATGPT WATCH** badge. Dismiss the smoke card.

## ChatGPT Actions

1. Import [`rapid-iq-watch-ingest.openapi.yaml`](./rapid-iq-watch-ingest.openapi.yaml) into the GPT Action (or paste it).
2. Auth: API Key → header `x-nexcort-watch-key` (value from `create-watch-ingest-secret.sh`).
3. Paste the vertical Watch system prompts (PSAP / Campus / Venue / Transit / Competitors) so each run POSTs structured JSON.
4. Never auto-create CRM Leads — Inbox only; use **+ Pipeline** in NexiQ.

