# Nexiq conversational staging ops

Operational polish on the existing Connect → Lex/Nova path. No second orchestrator.

## Contact attributes

Set at DID lookup (`GetAgencyConfigForNumber`) and copied onto the contact + Lex session:

| Attribute | Value |
|---|---|
| `qaTag` | `NexCortIQ-Conversational-v2` |
| `conversationalCohort` | `staging` (~5%) or `production` (remainder), stable per ContactId |

Filter Connect recordings / CTR exports by `qaTag = NexCortIQ-Conversational-v2`.

## Staging gate

- Traffic split: `CONVERSATIONAL_STAGING_TRAFFIC_PERCENT = 5` in `packages/shared/src/call-assist/conversational-ops.ts`
- Do not promote conversational tuning agency-wide until **≥ 500** staging cohort calls with no safety incidents (`CONVERSATIONAL_STAGING_MIN_CALLS`)
- Cohort is sticky per Connect `ContactId` (hash bucket 0–99); flip percent only in shared constants + redeploy Lex Lambdas / Connect start Lambda

## CloudWatch comparison (staging vs production)

Transfer events log JSON with `msg = "nexcortiq_conversational_transfer"`.

```sql
fields @timestamp, conversationalCohort, transferReason, agencyId, language, emergency
| filter msg = "nexcortiq_conversational_transfer"
| stats count() as transfers by conversationalCohort, transferReason
```

Dashboard metrics to compare by `conversationalCohort`:

| Signal | Source |
|---|---|
| Handle time (AHT) | Connect CTR / historical metrics |
| Transfer rate | `nexcortiq_conversational_transfer` count ÷ cohort call volume |
| Emergency trigger rate | same log where `emergency = true` |

Tune Nova/Lex endpointing from staging deltas before raising the traffic percent.

## AI disclosure

Opening / disclosure copy must say **AI** explicitly before the first intake question (FCC-oriented). Generic and KCPD templates lead with “AI assistant named Nexiq” / “I'm Nexiq, an AI assistant.”

## Dispatcher handoff

`buildTransferSummary` (safety-gate) emits a single-line screen-pop:

`Agency Nexiq transfer | Type: … | Address: … | Caller: … | Language: … | Turns: … | Reason: … | Last: "…" | Full transcript in contact attributes.`
