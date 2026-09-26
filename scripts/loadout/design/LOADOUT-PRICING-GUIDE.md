# NexCortiQ Loadout — Pricing Guide & Schema Reference
Version 1.0 — September 2026

---

## Pricing Model Overview

Loadout uses a **base + overage** model per feature:

- **Monthly base** — charged on the 1st of each period, covers included calls
- **Included calls** — API calls bundled at no extra cost
- **Overage** — charged per 1,000 calls above the included quota
- **Pro-rata activation** — features added mid-period are billed for remaining days
- **Immediate removal** — no refunds for partial months; removal takes effect immediately

---

## Self-Serve Features

Activate instantly. No provisioning call required.

| Feature | Monthly Base | Included Calls | Overage / 1K | Endpoint |
|---|---|---|---|---|
| AI Transcription | $750 | 10,000 | $0.08 | `/v1/transcribe` |
| Real-Time Translation | $500 | 10,000 | $0.06 | `/v1/translate` |
| AI Incident Analysis | $600 | 5,000 | $0.12 | `/v1/analyze` |
| Incident Classification | $350 | 8,000 | $0.05 | `/v1/classify` |
| Caller Sentiment Scoring | $450 | 8,000 | $0.07 | `/v1/sentiment` |
| QA Scoring | $400 | 3,000 | $0.15 | `/v1/qa/score` |
| Field Brief Delivery | $600 | 5,000 | $0.10 | `/v1/field/brief` |

**Self-serve total if all activated:** $3,650/mo base

---

## Enterprise Features

Require a 30-minute provisioning call. No setup fee. Pricing is starting rate — final pricing confirmed at provisioning based on infrastructure complexity.

| Feature | Starting Base | Included Calls | Overage / 1K | Notes |
|---|---|---|---|---|
| Non-Emergency Call Handling | $800 | 2,000 | $0.40 | Telephony + IVR integration |
| SOP Protocol AI | $700 | 3,000 | $0.25 | SOP library upload required |
| CAD Integration | $1,200 | 5,000 | $0.20 | CAD vendor assessment required |
| Cross-Jurisdiction Sharing | $950 | 3,000 | $0.30 | Multi-agency agreement required |
| Hospital Pre-Alert Portal | $600 | 2,000 | $0.30 | Hospital network enrollment |
| Deception Shield | $1,500 | Flat rate | N/A | No per-call billing |
| Full NexCortiQ Platform | Custom | Custom | Custom | Full deployment + support |

---

## Overage Calculation

```
Overage charges = max(0, calls_used - included_calls) / 1000 × overage_rate
```

**Example — AI Transcription over quota:**
- Base: $750 (10,000 calls included)
- Calls used: 13,500
- Overage: (13,500 − 10,000) / 1,000 × $0.08 = $0.28
- **Line total: $750.28**

---

## Invoice Schedule

- Invoices generated on the 1st of each month at 08:00 UTC via EventBridge
- Emailed automatically to `billingEmail` + CC to `technicalEmail` and RC admin
- HTML invoice + plain-text fallback via Amazon SES
- Net-30 payment terms
- Payment methods: ACH, wire, check payable to Apps on Demand LLC

---

## API Error Codes

All errors return JSON with the same structure:

```json
{
  "success": false,
  "error": "feature_not_licensed",
  "message": "Your Loadout does not include the AI Transcription feature.",
  "feature": "transcription",
  "upgrade_url": "https://loadout.nexcortiq.us/catalog",
  "request_id": "req_9f3kx2m"
}
```

| Error Code | HTTP | Cause |
|---|---|---|
| `unauthorized` | 401 | Missing or invalid API key |
| `feature_not_licensed` | 403 | Endpoint not in active Loadout |
| `quota_exceeded` | 403 | Monthly call quota exhausted |
| `unknown_endpoint` | 403 | Route has no feature mapping |
| `enterprise_required` | 400 | Feature needs provisioning call |
| `service_unavailable` | 503 | DB transient error (retry with backoff) |

---

## DynamoDB Schema

### `ncq-loadout-subscriptions-{stage}`

```
pk = SUB#{tenantId}
sk = SUBSCRIPTION
---
orgName          String
activeFeatures   StringSet    — feature IDs currently live
billingEmail     String
technicalEmail   String
billingCycleDay  Number       — day of month invoice fires (default: 1)
tier             String       — small | medium | large | enterprise
status           String       — active | suspended | cancelled
version          Number       — optimistic concurrency counter
createdAt        String       — ISO 8601
updatedAt        String       — ISO 8601
```

### `ncq-loadout-api-keys-{stage}`

```
pk = APIKEY#{sha256(rawKey)}
---
tenantId              String
status                String       — active | suspended | revoked
tier                  String
enabledFeatures       StringSet    — mirrors subscription.activeFeatures
quotaPerFeature       Map<String>  — {featureId: callLimit}
usageThisMonth        Map<String>  — {featureId: callCount}   ← kept for authorizer hot path
allowedJurisdictions  StringSet
keyName               String       — e.g. "Production Key"
createdAt             String
lastUsedAt            String

GSI: TenantIndex (hash: tenantId) — list all keys for a tenant
```

### `ncq-loadout-usage-{stage}`

```
pk = USAGE#{tenantId}#{YYYY-MM}
sk = FEATURE#{featureId}
---
callCount   Number    — atomic ADD incremented by authorizer
quotaLimit  Number    — set at period start from subscription
tenantId    String
featureId   String
month       String    — YYYY-MM
ttl         Number    — epoch seconds, 13 months from creation
```

### `ncq-loadout-swap-history-{stage}`

```
pk = SWAP#{tenantId}
sk = {ISO8601}#{uuid}
---
action       String   — add | remove | enterprise_request | key_rotate
featureId    String
source       String   — self-serve | admin | system
requestId    String   — for enterprise_request entries
createdAt    String
```

### `ncq-loadout-invoices-{stage}`

```
pk = INV#{tenantId}
sk = PERIOD#{YYYY-MM}
---
invoiceId    String   — INV-{YYYYMM}-{tenantId[:8].upper()}
period       String   — YYYY-MM
totalDue     Number
status       String   — generated | sent | preview | void
invoiceJson  String   — full JSON blob (line items, contacts, etc.)
generatedAt  String
ttl          Number   — 3 years from creation (regulatory retention)
```

---

## Subscription Manager API

All routes require a valid Loadout API key in the `x-api-key` header.

```
GET  /loadout/features               List active features + usage + costs
POST /loadout/features/add           { featureId: "transcription" }
POST /loadout/features/remove        { featureId: "qa_scoring" }
POST /loadout/enterprise/request     { featureId, contactName, contactEmail, bestTime, notes }
GET  /loadout/invoice/preview        Current period line items + projected total
```

---

## Infrastructure Checklist

Before deploying to production:

- [ ] SES domain identity verified for `nexcortiq.us`
- [ ] From address `billing@nexcortiq.us` verified and out of sandbox
- [ ] SNS email subscription confirmed for `AdminEmail`
- [ ] DynamoDB PITR enabled on all 5 tables (set in SAM template)
- [ ] DynamoDB SSE enabled (set in SAM template)
- [ ] CloudWatch alarms subscribed to SNS topic
- [ ] EventBridge invoice schedule enabled only in prod (condition in SAM)
- [ ] Authorizer TTL set to 30s (balance cache hits vs permission propagation)
- [ ] API Gateway throttling configured: 1000 RPS burst, 500 RPS steady
- [ ] X-Ray tracing enabled on all Lambdas
- [ ] Reserved concurrency on InvoiceGeneratorFunction (max 10) to prevent runaway
- [ ] `.env` for dev/staging points to non-prod tables

---

*NexCortiQ Loadout — Your platform. Your tools. Your terms.*
*loadout.nexcortiq.us | developers.nexcortiq.us | billing@nexcortiq.us*
