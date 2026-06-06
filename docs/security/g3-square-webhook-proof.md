# G3 Evidence — Square Billing Webhooks

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** PARTIAL — HMAC verification implemented; rotating keys remains **manual operational** work.

## Route

Lambda handler **`billingSquareHttp`** (`apps/api/src/handlers/billingSquareHttp.ts`):

- Sub-path `webhook` on `POST /api/billing/square/webhook` (full path resolves via SAM route mapping).

## Signature layers

| Mode | Requirement |
|---|---|
| Legacy shared-secret header (`x-square-webhook-secret` / Rapid Cortex aliases) | Compared to `SQUARE_WEBHOOK_SECRET` when set. Header must be present and match. |
| HMAC verification | Requires `SQUARE_WEBHOOK_SIGNATURE_KEY` + `SQUARE_WEBHOOK_NOTIFICATION_URL`; validates `notificationUrl + bodyRaw` matches `x-square-hmacsha256-signature` (supports SHA256/SHA1 base64 comparisons per helper). |

## Fail-closed in higher environments

When `DEPLOYMENT_STAGE ∈ { pilot, staging, prod, production }` **unless** `ALLOW_UNSIGNED_SQUARE_WEBHOOKS=true`:

- Deployment **must** have at least one verification path configured; otherwise webhook returns **`403 Forbidden`** explaining misconfiguration.

## Raw body preservation

Webhook branch base64-decodes `event.body` when `isBase64Encoded=true` before hashing.

## Replay / duplicates

Processed events use `billingWebhookEventsTable` dedupe (`markProcessedOnce`) — duplicates return acknowledgement without double-applying downstream billing mutations.

## Unit tests

- `apps/api/src/__tests__/square-webhook-signature.test.ts`
