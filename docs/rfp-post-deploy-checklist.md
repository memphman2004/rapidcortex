# RapidIQ RFP Systems — Post-Deploy Checklist

**Purpose:** Gate staging before production promotion for watches, OpenAI web-search discovery, and the unified RFP tile. Covers behavior that `sam validate --lint` and unit tests cannot see.

**Order:** run the CLI verifier first, then this checklist.

```bash
STAGE=staging bash scripts/verify-rapidiq-rfp-systems.sh
```

`DeploymentStage=dev` is live production (`app.rapidcortex.us`), not a sandbox. Staging is engineering (`app-staging.rapidcortex.us`). Do not use `scripts/deploy-rapid-iq-pipeline-api-dev.sh` to toggle flags in staging.

Live names (the Downloads draft used different ones):

| Thing | Live value |
|---|---|
| Stack | Nested `rapid-cortex-${STAGE}-AppSamRapidIqPipelineStack` (parent `rapid-cortex-${STAGE}`) |
| Table | Existing pipeline table (`WATCH#` / `INTEL#` / `SIGNAL#` / `pk=RFP_COUNTS sk=LATEST`) — no new Dynamo table |
| Watch field | `market` = `PSAP` / `CAMPUS` / `VENUE` / `TRANSIT` (not `vertical` / `rc911`) |
| Worker | `IntelWatchWorkerFunction` — discovery runs **here**, not in the orchestrator |
| Counter | `RfpUnifiedCounterFunction` — EventBridge `rate(15 minutes)`, rule `…-riq-rfp-count-${STAGE}` |
| Snapshot JSON | `{ opportunityFeed, pipeline, intel, total }` each with `open` + `psap` |
| GET watches | `{ watches, defaultMarket: "all", total }` — not `{ data: … }` |
| GET one watch | `{ watch }` |
| API | AppSam3 `HttpApi3Url` |
| Web-search logs | `msg: "rapid_iq_web_search_discover"` / skip `reason: "OPENAI_WEB_SEARCH_ENABLED not true"` |
| Snapshot logs | `msg: "rapid_iq_rfp_count_snapshot"` |

Three corrections already in code, worth confirming they stayed that way:

1. Discoverer is in the **watch worker**, not the enqueue Lambda (88 sequential OpenAI calls would time out the orchestrator).
2. Snapshot is on the **existing pipeline table** (`RFP_COUNTS` / `LATEST`).
3. Transit watches stay **`webSearchEnabled: false`**. Seeds must never flip that — it would double cost on the largest existing watch group.

---

## Pre-flight

- [ ] `STAGE=staging bash scripts/verify-rapidiq-rfp-systems.sh` exits 0 (warnings about a missing first snapshot are OK)
- [ ] Watch count ≥ 68 on the pipeline table (`WATCH#` prefix; GSI `gsi2pk=WATCH#ALL`)
- [ ] `webSearchEnabled=false` on all 25 transit watches (`webSearchEnabled=true` count is **0**)
- [ ] `webSearchEnabled=true` on PSAP (17), campus (13), venue (13) — ~43 total. Seed does **not** overwrite existing `WATCH#` rows
- [ ] `OpenAiWebSearchEnabled` stack parameter is `false` unless you are in the one-shot test below
- [ ] Worker env `OPENAI_WEB_SEARCH_ENABLED` matches the parameter
- [ ] Worker env `OPENAI_API_KEY_SECRET_ARN` is set
- [ ] SAM.gov secret ARN is on the **feed** stack / `RapidIqOrchestratorFunction` (`RAPID_IQ_SAM_GOV_API_KEY_SECRET_ARN`), not required on the watch worker

If watch count is 25: `STAGE=staging npx tsx scripts/seed-rapid-iq-intel-watches.ts`

---

## Watch worker (web search OFF)

Manual invoke of **one** PSAP watch. The worker is SQS-triggered in production; direct invoke `{ "watchId": "…" }` is supported for this check. `dryRun` is accepted and ignored — rows still persist. Web search is gated only by the global flag + `watch.webSearchEnabled`.

Function name is printed by the verify script (`WORKER_FN`). macOS AWS CLI v2 needs `--cli-binary-format raw-in-base64-out`.

```bash
aws lambda invoke \
  --function-name "$WORKER_FN" \
  --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{"watchId":"psap-fulton-county-ga"}' \
  /tmp/riq-worker-out.json && python3 -m json.tool /tmp/riq-worker-out.json
```

Expected shape (flag off):

```json
{
  "watchId": "psap-fulton-county-ga",
  "urls_fetched": 1,
  "intel_rows_written": 1,
  "web_search_urls_discovered": 0,
  "web_search_source_ids": [],
  "web_search_skipped": true,
  "web_search_skip_reason": "OPENAI_WEB_SEARCH_ENABLED not true"
}
```

`urls_fetched` / `intel_rows_written` may be `N` ≥ 0 depending on live pages.

- [ ] Invoke returns without error
- [ ] `web_search_urls_discovered` is `0`
- [ ] `web_search_skip_reason` is `OPENAI_WEB_SEARCH_ENABLED not true` (or `collectors_mock` if Anthropic/mock is on)
- [ ] `INTEL#` rows exist for that watch
- [ ] Seeded-URL rows are `sourceType: "web_page"` — not `openai_web_search`
- [ ] CloudWatch `/aws/lambda/$WORKER_FN` contains `"rapid_iq_web_search_discover"` with `"reason":"OPENAI_WEB_SEARCH_ENABLED not true"`

---

## Watch worker (web search ON — staging, one watch, then OFF)

This is intentionally **one** manual invoke on `psap-fulton-county-ga`. Do not leave the flag on in staging (~$2/day once all 43 vertical watches run).

Staging toggle (full nested deploy). Do **not** run `deploy-rapid-iq-pipeline-api-dev.sh` here — that stack is live production.

```bash
source scripts/env-api-staging.sh
OPENAI_WEB_SEARCH_ENABLED=true bash scripts/deploy.sh staging
```

Faster alternative if you only need the worker env for one invoke (preserve every other variable):

```bash
# merge OPENAI_WEB_SEARCH_ENABLED=true into the existing worker env, invoke, restore false
```

Then:

```bash
aws lambda invoke \
  --function-name "$WORKER_FN" \
  --region us-east-1 \
  --cli-binary-format raw-in-base64-out \
  --payload '{"watchId":"psap-fulton-county-ga"}' \
  /tmp/riq-worker-web-search.json && python3 -m json.tool /tmp/riq-worker-web-search.json
```

Expected:

```json
{
  "urls_fetched": 1,
  "intel_rows_written": 1,
  "web_search_urls_discovered": 1,
  "web_search_source_ids": ["openai-web-search"],
  "web_search_skipped": false
}
```

Look for **exactly** these:

- [ ] `web_search_urls_discovered > 0` (typically 1–5; two OpenAI queries, noise hosts dropped)
- [ ] Discovered URLs are not google.com / linkedin.com / facebook.com / youtube.com / reddit.com (noise-host filter)
- [ ] PlanetBids / Bonfire / BidNet / SAM.gov rank above generic sites when present
- [ ] Discovered-URL intel rows have `sources[].sourceType: "openai_web_search"` **and** `sources[].sourceId: "openai-web-search"`
- [ ] Discovered URLs were **not** written back onto `WATCH#psap-fulton-county-ga` `sourceUrls` (same-day merge only)
- [ ] Worker finishes inside the 240s timeout (discovery is in the worker, not 88 sequential calls in the orchestrator)
- [ ] CloudWatch: `"msg":"rapid_iq_web_search_discover"` with `"discovered": N` and `N > 0`
- [ ] Cost: 2 OpenAI web-search calls ≈ $0.05 for this one watch (check OpenAI usage)

Turn the flag back off immediately:

```bash
source scripts/env-api-staging.sh
OPENAI_WEB_SEARCH_ENABLED=false bash scripts/deploy.sh staging
```

Confirm worker env is `false` before walking away.

---

## RFP counts snapshot

First run if verify reported no item:

```bash
aws lambda invoke \
  --function-name "$SNAPSHOT_FN" \
  --region us-east-1 \
  /tmp/riq-snap-out.json && python3 -m json.tool /tmp/riq-snap-out.json
```

Expected Lambda return / Dynamo item:

```json
{
  "pk": "RFP_COUNTS",
  "sk": "LATEST",
  "entityType": "rfp_count",
  "updatedAt": "2026-09-…",
  "opportunityFeed": { "open": 0, "psap": 0, "campus": 0, "venue": 0, "hospital": 0, "transit": 0 },
  "pipeline": { "open": 0, "psap": 0 },
  "intel": { "open": 0, "psap": 0 },
  "total": { "open": 0, "psap": 0, "campus": 0, "venue": 0, "hospital": 0, "transit": 0 }
}
```

There is no `feed` or `rc911` key. Tile uses `snapshot.total.open`.

```bash
aws dynamodb get-item \
  --table-name "$PIPELINE_TABLE" \
  --key '{"pk":{"S":"RFP_COUNTS"},"sk":{"S":"LATEST"}}' \
  --region us-east-1
```

- [ ] Snapshot written on the **pipeline** table (not a new table)
- [ ] `total.open` is plausible (not 0 with a full feed, not implausibly huge)
- [ ] `opportunityFeed.open + pipeline.open + intel.open == total.open`
- [ ] `INTEL#` counted in `intel`, `SIGNAL#` in `pipeline` — not mixed
- [ ] **Negative test (most likely silent inflation):** a high-volume BoardDocs signal (`gsi2pk=SOURCE#boarddocs`) is **not** counted as an RFP unless it is solicitation-shaped (`RFP LIVE` / `active_rfp` / stage ≥ 8 / intel type RFP|RFQ|RFB|PROCUREMENT_NOTICE). `relevant: true` and `fitScore ≥ floor` on a `BOARD_AGENDA` must **not** increment the tile. The verify script samples this.
- [ ] EventBridge rule `…-riq-rfp-count-${STAGE}` is ENABLED, `rate(15 minutes)`
- [ ] Snapshot age < 20 minutes after a schedule fire
- [ ] `GET /api/rapid-iq/intel/rfp-counts` returns the snapshot
- [ ] Tile falls back to feed `RFP LIVE` tag count when `GetItem` is empty (delete is **not** required in staging if a snapshot already exists — this is the code path in `rapid-iq-client.tsx`)

---

## Intel API / UI contract

Use the token command printed at the end of the verify script (HttpApi3 URL + Cognito client id already filled). Browser login is blocked by Cognito in this environment; CLI is the check.

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/rapid-iq/intel/watches" | jq '{
    defaultMarket,
    total,
    ok: (.defaultMarket == "all" and .total >= 68),
    markets: [.watches[].market] | group_by(.) | map({(.[0]): length}) | add
  }'
```

Expected:

```json
{
  "defaultMarket": "all",
  "total": 68,
  "ok": true,
  "markets": { "TRANSIT": 25, "PSAP": 17, "CAMPUS": 13, "VENUE": 13 }
}
```

These two regressions are invisible in unit tests but immediately visible to anyone on Intel:

- [ ] `defaultMarket === "all"` (not `"PSAP"` / `"rc911"` — that would hide non-PSAP watches)
- [ ] `total >= 68` in **one** response (no 25-item cap leftover from the transit-only list)

Also:

- [ ] All four markets present
- [ ] `WATCH#psap-fulton-county-ga` exists

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/rapid-iq/intel/watches/psap-fulton-county-ga" | jq '{
    id: .watch.id,
    market: .watch.market,
    webSearchEnabled: .watch.webSearchEnabled,
    sourceUrlCount: (.watch.sourceUrls | length)
  }'
```

- [ ] `webSearchEnabled: true`
- [ ] `sourceUrls` length ≥ 1
- [ ] `market: "PSAP"` (not `"rc911"`)

RFP tile:

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/rapid-iq/intel/rfp-counts" | jq '{
    updatedAt: .snapshot.updatedAt,
    open: .snapshot.total.open,
    psap: .snapshot.total.psap,
    campus: .snapshot.total.campus,
    venue: .snapshot.total.venue,
    transit: .snapshot.total.transit
  }'
```

- [ ] 200 (the unauthenticated probe is 401/403 if the route exists, 404 if it did not deploy)
- [ ] `snapshot.total.open` present and plausible (greater than 0 once ingest has run, less than 10,000)
- [ ] `snapshot.updatedAt` within ~20 minutes of a counter run
- [ ] Vertical breakdown uses **`psap`**, not `rc911`

---

## Production promotion gate

All of the following must be true:

- [ ] Pre-flight verifier is clean in staging
- [ ] Watch worker succeeds in staging with web search **OFF**
- [ ] Snapshot Lambda runs on the 15-minute schedule and the BoardDocs negative test holds
- [ ] `/api/rapid-iq/intel/rfp-counts` returns correct counts
- [ ] `/api/rapid-iq/intel/watches` returns ≥ 68 records and `defaultMarket=all`
- [ ] No worker/counter Lambda ERROR flood in staging CloudWatch for 24 hours after deploy
- [ ] Web search verified in staging (one watch, then flag **OFF**)
- [ ] Cost estimate confirmed (~$2/day at 43 vertical watches × 2 calls — transit stays off)

**Web search timing — explicit decision required. No code change either way; deploy flag only.**

- [ ] Decision: enable web search in prod **immediately**, or **defer**?
  - Defer: leave `OpenAiWebSearchEnabled=false` / `OPENAI_WEB_SEARCH_ENABLED=false` (CloudFormation default)
  - Enable: `OPENAI_WEB_SEARCH_ENABLED=true` on the live deploy (`source scripts/env-api-dev.sh && OPENAI_WEB_SEARCH_ENABLED=true bash scripts/deploy.sh dev`). That is production.

Record the decision here: __________________

---

## Rollback

No new DynamoDB tables were added. Rollback removes Lambdas and EventBridge rules only. Pipeline table data (`WATCH#` seeds, `INTEL#` rows, `RFP_COUNTS` snapshot) is retained. Seeds are idempotent — re-running never overwrites existing watch ids.

```bash
aws cloudformation rollback-stack \
  --stack-name rapid-cortex-staging-AppSamRapidIqPipelineStack \
  --region us-east-1
```

Parent nested rollback follows the usual `rapid-cortex-staging` stack update path.
