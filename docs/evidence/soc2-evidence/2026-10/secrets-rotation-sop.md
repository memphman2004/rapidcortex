# Secrets Manager rotation — Rapid Cortex (manual SOP)

**Control:** CC6.1 / CC6.6 complementary — credential lifecycle  
**Date:** 2026-09-17  
**Evidence:** `secrets-inventory.json` (36 Rapid Cortex secrets; `RotationEnabled` is null/false on all)

Automatic rotation is **not** enabled. These secrets are third-party API keys, OAuth client secrets, and HMAC keys. AWS managed rotation Lambdas do not exist for Twilio, Ring, Anthropic, etc.

## Cadence

| Class | Examples | Rotation |
|---|---|---|
| Billing / SES SMTP | `rapid-cortex/billing/*`, `rapid-cortex/dev/billing/*` | 90 days or on staff change |
| AI providers | `rapid-cortex/ai/openai`, `rapid-cortex/ai/anthropic` | 90 days or on vendor incident |
| Camera / Ring / Nest / Wyze | `rapid-cortex/connect/*` | On compromise or partner key expiry |
| Rapid IQ SaaS keys | `rapid-cortex/rapid-iq/*` | 90 days |
| JWT / token encryption | `rapid-cortex/external-api/*`, `rapid-cortex/rapid-iq/token-encryption` | 180 days; dual-publish then revoke |

## Procedure

1. Open a ticket (`secrets-rotation`) with secret name (never the value).
2. Generate a new key in the vendor console.
3. `aws secretsmanager put-secret-value --secret-id <name> --secret-string ...` from a privileged session (not this SOP file).
4. Deploy or bounce the consuming Lambda/ECS service.
5. Revoke the old vendor key after 24 hours of healthy metrics.
6. Attach the ticket ID to the quarterly access review in folder `05 - Access Control`.

Until automatic rotation Lambdas exist, **this SOP plus ticket history** is the Type II operating evidence.
