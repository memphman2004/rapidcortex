# NexiQ Buying Intelligence Engine

Upgrade path from **RFP-centric discovery** to **public-sector buying intelligence**
(pre-RFP signals: agendas, funding, vendor demos, pain, renewals).

Feeds the **existing NexiQ Inbox**. Does **not** auto-create Leads or Pipeline rows.

## Architecture (incremental)

```
Existing collectors / ChatGPT Watch / OpenAI web search
        ↓
process-signal / ingest-watch-signal
        ↓
applySignalIntelligence (intent + fit scores)
        ↓
applyBuyingIntelligence (stage, strength, facts/inferences, capabilities)
        ↓
correlateOrKeep (agency + tech category merge)
        ↓
Dynamo RAPID_IQ_PIPELINE_SIGNALS_TABLE
        ↓
NexiQ Inbox → human + Pipeline / Watch / Dismiss
```

## Reused (existing)

- Pipeline ingest Lambdas (SAM.gov, Legistar, BoardDocs, CivicClerk, grants, news, competitor, …)
- `signal-keywords` procurement stages + fit scoring
- Competitor registry
- Agency profiles / contact enrichment
- ChatGPT Watch ingest (`docs/watch-ingestion.md`)
- Inbox UI + `+ Pipeline` human promotion

## Added

| Component | Role |
|-----------|------|
| `packages/shared/src/rapid-iq/buying-intelligence.ts` | Taxonomy + classifiers |
| `discovery-query-library.ts` | Vertical query library |
| `apply-buying-intelligence.ts` | Attach fields on process |
| `correlate-buying-signals.ts` | Multi-doc → one Inbox card |
| `CORR#` Dynamo pointers | Correlation lookup |
| Inbox detail Facts / Inferences / Why now / **Watch** | Human control |

## Taxonomy (summary)

- **buying_stage:** awareness → planning → funded → evaluating → procurement_live → …
- **signal_strength:** weak | moderate | strong | confirmed
- **buying_signal_type:** procurement, evaluation, funded, pain_signal, competitor_activity, …
- **matched_capabilities:** cad_integration, transcription, rtcc, …
- **facts vs inferences:** kept separate in Inbox UI
- **priority_band:** urgent | high | medium | monitor + `priorityReasons[]`

## Correlation

Signals sharing `STATE|AgencySlug|TechCategory` within ~180 days merge into one Inbox
card (lifecycle activities + evidence). Formal RFPs still create/update normally via
existing hash / `external_key` paths.

## Human actions

| Action | Effect |
|--------|--------|
| SHOW EVIDENCE | Existing evidence / timeline |
| WATCH | `watched=true` — monitor without Pipeline |
| DISMISS | Existing dismiss |
| + PIPELINE | Existing human promotion only |

## Explicit guarantee

**No procurement or buying signal automatically creates a CRM Lead or moves an item into Pipeline.**

## Known limitations (next increments)

- Full PDF OCR / page-level evidence not yet universal across all collectors
- Renewal calendar UI and competitor dashboard aggregates are partial (data fields ready)
- CivicIQ comparison mode is schema-ready (`source` enum includes `civiciq`) — no paywall scraping
- Pre-RFP lead-time metrics dashboard not yet built (log fields available on process)
- LLM extraction contract exists conceptually; current classifiers are deterministic keyword/rules for cost control

## Tests

```bash
cd packages/shared && npx vitest run src/rapid-iq/buying-intelligence.test.ts
```

Golden fixtures: Troup County, Rutland, Wentzville, Dearborn Heights, Hermosa Beach —
classification only, never hard-coded into production results.
