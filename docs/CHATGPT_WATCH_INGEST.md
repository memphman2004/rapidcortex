# ChatGPT Watch → NexiQ Watch Inbox delivery contract

NexiQ cannot pull from a ChatGPT conversation. Watches (or any approved HTTPS sender) **push** validated intelligence into Watch Inbox.

**Discovery ≠ Lead.** Ingest never creates a CRM Lead or Pipeline opportunity. Humans qualify from Watch Inbox.

## Endpoint

```
POST https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com/api/watch/ingest
```

Legacy (still supported):

```
POST …/api/rapid-iq/pipeline/watch-ingest
```

`api.rapidcortex.us` maps to HttpApi1 only — Watch ingest lives on **HttpApi3** (`API_UPSTREAM_BASE_3`).

## Authentication

```
Authorization: Bearer <WATCH_INGEST_API_KEY>
```

Also accepted: `x-nexcort-watch-key: <WATCH_INGEST_API_KEY>`

Secret: AWS Secrets Manager `rapid-cortex/rapid-iq/watch-ingest-api-key` (field `apiKey`).

Never expose the key in ChatGPT user-visible output or browser bundles.

## Headers

| Header | Required | Notes |
|--------|----------|--------|
| `Authorization` | Yes | Bearer API key |
| `Content-Type` | Yes | `application/json` |
| `Idempotency-Key` | Optional | Client correlation; payload content hash also dedupes |

## Body

**One WatchSignal object per POST.** Arrays are rejected on `/api/watch/ingest`.

See TypeScript schema: `packages/shared/src/rapid-iq/watch-signal-schema.ts`.

Minimum evidence: at least one `evidence[]` entry. Prefer `source_quality: "authoritative"`.

Use stable `external_key` for upserts (e.g. `GA|GwinnettCounty|PA031-26`).

## Success responses

```json
{
  "success": true,
  "action": "created",
  "signal_id": "…",
  "external_key": "…",
  "lifecycle_event_created": true
}
```

`action` may be `created` | `updated` | `unchanged`.

Only report transfer success when `success === true`.

## Other Watch APIs (Cognito JWT — RC admin / sales)

| Method | Path |
|--------|------|
| GET | `/api/watch/health` |
| GET | `/api/watch/stats` |
| GET | `/api/watch/signals` |
| GET | `/api/watch/signals/{id}` |
| PATCH | `/api/watch/signals/{id}` |
| POST | `/api/watch/signals/{id}/qualify` |
| POST | `/api/watch/signals/{id}/dismiss` |
| POST | `/api/watch/signals/{id}/monitor` |
| POST | `/api/watch/signals/{id}/assign` |

UI: `/rc-admin/intelligence/watch` (alias `/intelligence/watch`)  
Admin tester: `/rc-admin/watch-ingest` (alias `/admin/watch-ingest`)

## ChatGPT Watch instruction block (paste into every Watch)

```
When a validated intelligence signal is discovered, maintain the complete structured WatchSignal object internally.

If the NexCort Watch Ingest API capability is available, POST each validated signal individually to the configured Watch Ingest API.

Use external_key as the stable opportunity correlation identifier.

Never create a CRM Lead or Pipeline opportunity automatically.

Delivery destination is Watch Inbox only.

Only report that a signal was transferred when the API returns success=true.

If delivery fails, continue displaying the intelligence to the user and explicitly indicate that CRM synchronization failed.

If the API capability is unavailable, do not claim synchronization occurred.

Never expose API credentials in user-visible output.
```

## Important limitation

Placing an API URL in a ChatGPT prompt does **not** grant network access. The sender must be an approved connector, OpenAI tool/action, Lambda relay, internal research service, or the admin ingest tester.

## Smoke test

```bash
export RAPID_IQ_WATCH_INGEST_API_KEY='…'   # from scripts/create-watch-ingest-secret.sh
export API_BASE='https://tbr4zvjlk5.execute-api.us-east-1.amazonaws.com'
bash scripts/smoke-watch-ingest.sh
# Canonical path:
# curl -X POST "$API_BASE/api/watch/ingest" -H "Authorization: Bearer $RAPID_IQ_WATCH_INGEST_API_KEY" …
```
