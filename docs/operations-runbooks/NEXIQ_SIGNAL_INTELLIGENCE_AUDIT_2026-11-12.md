# NexiQ Production Readiness Audit — 2026-11-12

**Scope:** Civic iQ → scored signals → `POST /api/signals` → `rapid-cortex-nexiq-signals-dev` → RC Admin NexiQ Signals UI  
**Account:** 158961537080 (`rapid-cortex`) · HttpApi `tbr4zvjlk5`  
**Rule:** Do not add Phase-2 features. Fix blockers. Flag gaps.

---

## BLOCKERS

- **[PIPELINE] Discovery/scoring job is not in this repo and is not scheduled in AWS**
  - No `claude/nexiq_post_*.py`, no `scripts/nexiq/` discovery runner, no GitHub Actions workflow.
  - Only artifact found: one-shot poster `tmp/nexiq-signals-2026-11-02/post_all_signals.py` (hardcoded pre-scored payloads → POST).
  - No Civic iQ client code anywhere in `apps/api` (only Dynamo SK `SOURCE#civiciq`).
  - No `CIVIC_IQ_API_KEY` secret in Secrets Manager.
  - No EventBridge / Scheduler rule for Civic signal discovery (NexiQ Intel collector every 2h is a **different** pipeline: document/source crawl → Rapid IQ, not Civic signal ingest).
  - **Proxy block (Anthropic cloud egress):** confirmed by design of the stack comments (“Claude scheduled tasks”) and the known inability to POST from that environment. Because discovery/scoring still lives outside AWS, qualified signals are not reliably written on a daily schedule.
  - **Fix required (build, not a one-line patch):** implement `nexiq-signal-discovery` as an AWS Lambda (or ECS task) with EventBridge `cron(0 6 * * ? *)`, Secrets Manager reads for OpenAI + Civic iQ + ingest API key, then POST to `/api/signals` **inside the VPC/AWS network** (or write DynamoDB directly). Until that exists, the proxy issue cannot be “fixed” in-repo.

- **[PIPELINE] OpenAI scoring path not productionized in-repo**
  - No pinned model, no `temperature=0`, no backoff, no token-usage metrics in any checked-in job.
  - Secret `arn:aws:secretsmanager:us-east-1:158961537080:secret:rapid-cortex/ai/openai-kqZQ3D` **exists**, but nothing in the NexiQ Signals path loads it for scoring.

---

## HIGH RISK

- **[DATA] TTL was DISABLED on `rapid-cortex-nexiq-signals-dev`**
  - Audit found `TimeToLiveStatus: DISABLED`. Ingest did not set `ttl`.
  - **Fixed (2026-11-12):** enabled TTL attribute `ttl` on the live table; ingest now writes `ttl = now + 90d` and sanitizes title/summary HTML.

- **[DATA] PITR was DISABLED**
  - Business-intel table with no point-in-time recovery.
  - **Fixed (2026-11-12):** enabled PITR on `rapid-cortex-nexiq-signals-dev` via AWS API.

- **[OPS] No CloudWatch alarms / custom metrics for Civic signal posting**
  - No `nexiq/SignalsPosted`, no “0 posts for 2 days” alarm, no run-history table for Civic ingest runs.
  - NexiQ Intel has collector error alarms — **not** the same product surface.

- **[UX NAMING] Three different “signal” products share CRM/nav language**
  1. **NexiQ Signals** — `/api/signals` · table `rapid-cortex-nexiq-signals-dev` · UI `NexiqSignalsPanel` (Rapid IQ)
  2. **Signal Feed** — `/rc-admin/signal-feed` · LeadSignal / grants CRM (sales leads)
  3. **Watch Inbox** — `/rc-admin/intelligence/watch` · Rapid IQ **pipeline** signals (`tracking` ≠ NexiQ `tracking`)
  - Audit checklist conflating these will mis-score UI readiness.

- **[CONFIG] Qualification threshold hardcoded**
  - `NEXIQ_SIGNAL_MIN_CONFIDENCE = 40` in `packages/shared` (not SSM / env). Prompt default “65?” is **not** what production enforces.

---

## MEDIUM RISK

- **Table is an Existing\* parameter workaround** (`ExistingNexiQSignalsTableName`) — CFN does not own create/TTL/PITR for this table; future stack deploys won’t reconcile TTL/PITR unless the physical table is imported or template is expanded.
- **GSIs present and correct for current access patterns:** `status-createdAt-index`, `vertical-status-index`, `dedupeHash-index`. No dedicated GSI on `source` / `score` (score sort is in-memory after query).
- **HttpApi CORS on `tbr4zvjlk5` is null** — browser clients use Next BFF (`apps/web/app/api/signals/*` → upstream). Acceptable if BFF remains the only browser path; direct browser POSTs would fail CORS.
- **POST `/api/signals` is `AuthorizationType: NONE` at API Gateway** with Lambda-side IAM **or** ingest API key (`x-nexcort-signals-key`). Correct for Claude/key callers; unauthenticated without key returns 401 from Lambda (verified by handler logic). Ensure ingest secret stays rotated.
- **No HTML sanitization previously** — added lightweight strip on ingest.
- **Agency name normalization** — not implemented (all “the agency” placeholders in the Nov 2 scratch payloads).
- **Idempotency on POST is dedupeHash-based** (upsert returns `{ duplicate: true }`); ConditionalCheckFailed on pk also handled. Partial-run re-score for discovery scripts: N/A (no discovery job in AWS).

---

## PASSED

- Ingest Lambda **exists and is real** (`rapid-cortex-dev-AppSamNe-NexiqSignalsHttpFunction-82TDXNrzwcXZ`), Zod-validated (`nexiqSignalCreateBodySchema`), writes `rapid-cortex-nexiq-signals-dev`.
- Routes on HttpApi `tbr4zvjlk5`: `POST /api/signals`, `GET /api/signals`, `GET /api/signals/summary`, `PATCH /api/signals/{signalId}`.
- GET/PATCH use Cognito JWT (+ `canAccessNexiqSignals`: rcsuperadmin / rcadmin / rcitadmin / salescontractor).
- Stage throttle present: burst 5000 / rate 2000 (default stage settings).
- Table billing: **PAY_PER_REQUEST**.
- Live row count at audit: **313** signals (historical posts succeeded; Nov 2 run log shows mostly DUP).
- Ingest API key secret present: `rapid-cortex/nexiq-signals/ingest-api-key`.
- OpenAI secret present at expected ARN suffix `openai-kqZQ3D`.
- UI panel exists (`NexiqSignalsPanel`): empty/error handling, vertical tabs, track / dismiss / push_to_crm, score-desc sort via repository.
- Web BFF proxies JWT GETs; POST from browser correctly blocked (IAM/key ingest only).
- Scratch poster does not hardcode `sk-` / `ciq_` keys (loads `NEXIQ_SIGNALS_INGEST_API_KEY` or `.ingest_key`).
- Account isolation: table in **158961537080** only (not CAD account).

---

## DEFERRED (Phase 2 / Out of Scope)

- Full Civic iQ category coverage, pagination, rate limits, ICP externalization, pinned OpenAI model + token metering (must land with the AWS discovery Lambda).
- Agency name normalization / prospect matching quality.
- Run-history Dynamo table + Slack/email digests + “Run Now” admin button.
- Custom CloudWatch metrics/alarms for Civic ingest.
- Source GSI (`civic_iq` / `manual` / `web`) — SK is currently fixed `SOURCE#civiciq`.
- Expanding vertical tags beyond `core_psap | campus | venue | transit` to law_enforcement / fire_ems / campus_safety naming from the checklist.
- Importing `NexiQSignalsTable` into CloudFormation as a managed resource (exit Existing\* workaround).

---

## Layer checklist (condensed)

| Layer | Verdict |
|---|---|
| 1 Discovery / scoring scripts | **FAIL** — not in repo; not scheduled |
| 2 API Gateway + ingest Lambda | **PASS** (auth + Zod + dedupe) |
| 3 DynamoDB | **PASS** after TTL/PITR enable; GSIs OK |
| 4 RC Admin UI | **PASS** for NexiqSignalsPanel; Signal Feed / Watch Inbox are different products |
| 5 Proxy / schedule | **FAIL** — Option D (not scheduled in AWS) |
| 6 Monitoring | **FAIL** for Civic ingest |
| 7 Data quality | **PARTIAL** — dedupe + score bounds OK; sanitization fixed; agency normalize deferred |
| 8 Secrets | **PARTIAL** — OpenAI + ingest key OK; Civic iQ secret missing |

---

## Fixes applied this audit

1. Enable DynamoDB TTL (`ttl`) on `rapid-cortex-nexiq-signals-dev`.
2. Enable PITR on `rapid-cortex-nexiq-signals-dev`.
3. Ingest writes `ttl` (90 days) and strips HTML from title/summary (`signalsHttp.ts` + `NEXIQ_SIGNAL_TTL_DAYS`).

**Still required for green pipeline:** AWS-hosted discovery+scoring+post job (replaces Anthropic-cloud daily scripts).

---

## Note on storage cleanup

Prompt suggested deleting `claude/nexiq_signals_2026-*.json`. That directory is **not present** in this workspace (`claude/` missing). Scratch data under `tmp/nexiq-signals-2026-11-02/` remains (~130KB JSON + poster); safe to delete locally if disk pressure returns.
