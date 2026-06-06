# G3 Evidence — Inbound External API / Webhooks (Non-exhaustive)

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** PARTIAL inventory — aligns with pilot scope; dormant integrations flagged **DISABLED**.

| Integration | Verification | Replay / Idempotency | Notes |
|---|---|---|---|
| Square billing webhook | Headers + optional HMAC (see `g3-square-webhook-proof.md`) | Dynamo event dedupe (`BillingWebhookEventsTable`) | Enforced staging/prod configs |
| Stripe gateway | `stripe-signature` header validated in `billingStripeGateway` handler (`apps/api/src/handlers/billingStripeGateway.ts`) | Stripe idempotency keys on REST calls outbound (not exhaustive here) | **Enable only when secrets provisioned** |
| Twilio / SMS receipts | Validates Twilio signatures when SNS/SMS bridging enabled (`apps/api/src/handlers/incidentSmsSnsInbound.ts` paths) — confirm per-deployment | Provider-specific | Document per agency cutover |
| CAD vendor inbound | **Not wired** for write-back pilot; read-only egress only (`apps/web/lib/rapid-cortex/cad/*`). | N/A |
| Rapid Cortex agency API OAuth | Bearer JWT issuance + RSA secrets via Secrets Manager ARN (`externalApiJwtSecret.ts`) | Client credential tokens short-lived | Document key rotation playbook |

Anything not wired for pilot MUST remain disabled or guarded by feature flags (`docs/pilot-path-stub-remediation-report.md` lineage).
