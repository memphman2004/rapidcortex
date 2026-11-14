# ADR-001 — Call Assist live architecture acceptance

**Status:** Accepted  
**Date:** 2026-11-12  
**Account:** `158961537080` only  

## Context

A production-readiness checklist assumed a different shape (per-call Fargate `:9001`, model ID `amazon.nova-sonic-v2:0`, separate Dynamo tables, `SR-*` IDs, dedicated EventBridge bus). Live Call Assist already works on Lex/Polly + Connect with a different design. We align documentation and additive safety/config to that live system instead of rewriting the working path.

## Decision

| Checklist item | Live / accepted implementation |
|----------------|--------------------------------|
| Nova runtime | Shared long-lived ECS **gateway on `:8080`** (optional; empty image URI = Lex/Polly only). Not one RunTask per call on `:9001`. |
| Bedrock model | `amazon.nova-2-5-sonic` (`NOVA_2_SONIC_MODEL_ID`). Lex speech locale: `amazon.nova-2-sonic-v1:0`. **`amazon.nova-sonic-v2:0` is not a Bedrock model ID.** Zero use of EOS `amazon.nova-sonic-v1:0`. |
| Audio sample rate | Nova stream uses **16000** Hz as implemented — do not “fix” to 8000 without a Connect media E2E retest. |
| Data model | Single table `rapid-cortex-call-assist-{stage}` with `gsi1` / `gsi2`. |
| Confirmation numbers | `RC-MMDD-XXXX` (and legacy forms) via `case-number.ts` — not `SR-{AGCY}-{timestamp}`. |
| Nova tools | `transfer_emergency`, `issue_report_number`, `save_intake_fields`, `request_human`. 311 intake is **Lex taxonomy**, not Nova SR tools. |
| Fallback signaling | Connect contact attributes (`novaSonicFallbackToLex`, `voiceEngine`) — not a required EventBridge hop for the working path. |
| Nexiq opening | Short identity: `NEXIQ_OPENING_GREETING`. City / non-emergency disclosure comes from **agency / FALLBACK greeting templates** spoken by telephony — do not rewrite the live short opener without a voice E2E. |
| SMS DID | Live may still share an origination number; product rule is Call Assist must not own Pre-Arrival iQ `+13198358230` long-term. Changing the live stack param is an ops cutover, not a silent code default flip. |
| Nova gateway deploy | Opt-in via `NovaSonicGatewayImageUri` + VPC/subnets. Empty = intentional Lex/Polly-only (current live). |
| Dynamo TTL | Template enables `expiresAt` on **create**. Imported live table may have TTL off until an explicit ops enable (`scripts/enable-call-assist-table-ttl.sh`) — do not auto-enable in deploy. |
| Connect queue ARNs | Prefer values already on the Connect flow / agency `connectEmergencyQueueArn` / `connectQueueArn`. Empty CFN params must not wipe console wiring. |

## Consequences

- RFP / audit language must describe the **accepted** architecture above.
- Additive improvements (Spanish emergency phrases, CJIS flags with live-preserving defaults, optional ops EventBridge bus) are allowed.
- Do not redeploy gateway, flip SMS DID, enable TTL, or change live greetings as part of “checklist compliance.”
