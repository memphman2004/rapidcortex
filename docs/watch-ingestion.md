# Watch ingestion — ChatGPT Procurement Watches → NexiQ Inbox

Machine-authenticated ingest that lands Watch findings in the **existing NexiQ Inbox** only.
Human operators still choose **+ Pipeline** before Leads CRM.

> Related: [rapid-iq-chatgpt-watch-ingest.md](./rapid-iq-chatgpt-watch-ingest.md) (ops smoke / Action setup),
> [rapid-iq-watch-ingest.openapi.yaml](./rapid-iq-watch-ingest.openapi.yaml) (GPT Action schema).

## Architecture

```
External Watch (ChatGPT / connector)
    → POST /api/rapid-iq/pipeline/watch-ingest
    → API key auth (Secrets Manager)
    → Zod validation (packages/shared)
    → normalize external_key + payload hash
    → Dynamo upsert (RAPID_IQ_PIPELINE_SIGNALS_TABLE)
    → NexiQ Inbox card (status=new)
    → Human: + Pipeline → existing Leads CRM
```

**Does not** auto-create CRM Leads or Pipeline records.

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
- **Host (live):** HttpApi3 execute-api URL (see OpenAPI / smoke script).  
  `api.rapidcortex.us` maps to HttpApi1 — do **not** use it for watch-ingest until a mapping exists.
- **Body:** one object or an array (max 25).

### Success (single finding)

```json
{
  "success": true,
  "action": "created",
  "external_key": "MO|CITYOFWENTZVILLE|26-364",
  "id": "<signalId>",
  "changes": ["created"]
}
```

`action` is `created` | `updated` | `unchanged`.

### Validation error

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "details": [{ "path": "opportunity.procurement_url", "message": "Invalid url" }]
}
```

## Deduplication

`external_key` is authoritative. Same key → update existing Inbox card (deadline / status / evidence / activity), not a duplicate.

Suggested key forms:

- With solicitation: `STATE|AgencySlug|SolicitationNumber`
- Early signal: `STATE|AgencySlug|NormalizedTitle|FY`

Keys are normalized (trim, collapse spaces, uppercase) for lookup. Lifecycle updates must **reuse** the same key — never append `-v2`.

Secondary protection: solicitation / URL hash pointers may set `possible_duplicate` + `possible_duplicate_of` for human review (no silent merge).

Identical payload hash → `unchanged` (no lifecycle clutter).

## Funding vs contract value

| Field | Meaning |
|-------|---------|
| `estimated_contract_value` / `estimated_value` | NexCort-addressable contract estimate → Inbox "Contract est." |
| `project_budget` / `funding_amount` | Broader project / CIP / grant envelope → "Project/Funding Signal" |

Never copy project budget into contract value.

## Signal types

`rfp` | `planning` | `funded` | `early_signal` | `competitor`

Early signals must not be labeled as RFPs in the Inbox.

## Human control

Watch ingestion **may** create/update Inbox signals, lifecycle activities, and evidence.  
It **must not** create Leads, move to Pipeline, or send outbound sales mail.

## Secret setup

```bash
bash scripts/create-watch-ingest-secret.sh
source scripts/env-api-dev.sh
# ensure RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN is set
bash scripts/deploy-rapid-iq-pipeline-api-dev.sh
```

## Smoke test

```bash
export RAPID_IQ_WATCH_INGEST_API_KEY='…'
export API_BASE='https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com'
bash scripts/smoke-watch-ingest.sh
```

Then open NexiQ → Watch Feed and confirm **CHATGPT WATCH** badge. Dismiss the smoke card.

## ChatGPT Actions

1. Import `docs/rapid-iq-watch-ingest.openapi.yaml`.
2. Auth: API Key → header `x-nexcort-watch-key`.
3. Each Watch run POSTs structured JSON (one finding per request preferred).
4. Never auto-create CRM Leads — Inbox only; use **+ Pipeline** in NexiQ.

## Env vars

| Var | Purpose |
|-----|---------|
| `RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN` | Secrets Manager ARN (preferred) |
| `RAPID_IQ_WATCH_INGEST_API_KEY` | Inline key (dev only) |
| `RAPID_IQ_PIPELINE_SIGNALS_TABLE` | Inbox signal table |
| `ENABLE_NEXIQ_PIPELINE` / feature flag | Must be on for ingest |

Never expose secrets via `NEXT_PUBLIC_*`.
