# G3 — Security Controls, Platform (Master Evidence Roll-up)

**Customer gate status:** **YELLOW** — code and IaC controls have advanced, but environment-specific proof and reviewer signoff are still required.

**Principle:** Code + IaC progress does **not** replace environment-specific proof. G3 cannot move to **GREEN** until the **target environment** has **PASS** evidence and **reviewer signoffs**.

**Warning — do not mark G3 GREEN** based only on code, IaC, **local tests**, or intended configuration.

This page consolidates **pilot-scope** controls and proofs. It does **not** assert **CJIS certification** or formal CJIS accreditation, **SOC 2 compliance** or Type II attestation, or **full production readiness** by itself.

| Linked artifact | Role |
|---|---|
| [`g3-secret-scan-results.md`](./g3-secret-scan-results.md) | Pattern scan + NEXT_PUBLIC stance |
| [`g3-secrets-manager-proof.md`](./g3-secrets-manager-proof.md) | Secret ARNs / loader behavior |
| [`g3-waf-proof.md`](./g3-waf-proof.md) | Optional regional WAF (`EnableApiWaf` flag) |
| [`g3-cors-proof.md`](./g3-cors-proof.md) | Approved origins helper + SAM guardrails |
| [`g3-auth-session-proof.md`](./g3-auth-session-proof.md) | Cognito authorizer + `getUserContext` |
| [`g3-square-webhook-proof.md`](./g3-square-webhook-proof.md) | Square inbound verification |
| [`g3-external-api-validation-proof.md`](./g3-external-api-validation-proof.md) | Stripe + others overview |
| [`g3-iam-s3-policy-review.md`](./g3-iam-s3-policy-review.md) | S3 / IAM reviewer prompts |
| [`g3-encryption-proof.md`](./g3-encryption-proof.md) | HTTPS + KMS/SSE attestations placeholders |

Smoke automation: run **`npm run security:g3` in the target environment** → capture PASS/FAIL logs and attach as evidence (local developer runs are **not** sufficient to close G3).

## GREEN bar (target environment — all required)

1. **`npm run security:g3` passes** in the target environment (logs attached).
2. **AWS Secrets Manager** references verified **without** exposing secret values.
3. **WAF WebACL** confirmed attached to the correct **CloudFront / API Gateway** resource (proof attached).
4. **CORS allowlist** tested with **approved** and **rejected** origins (proof attached).
5. **JWT/session validation** verified on protected routes.
6. **Tenant isolation** tested, including **attempted cross-agency** access.
7. **Square webhook** signature validation tested with **valid**, **invalid**, and **missing** signatures.
8. **External inbound integrations** validate signatures, tokens, timestamps, or replay protections where applicable.
9. **S3/IAM** policies reviewed for least privilege (evidence attached).
10. **Encryption** in transit and at rest verified (evidence attached).
11. **Evidence links** attached to the readiness record.
12. **Security / DevOps** owner signs off.
13. **Platform / Compliance** owner signs off where tenant isolation and auditability are involved.

Until the above are satisfied **for the stack under review**, G3 remains **YELLOW** regardless of main-branch maturity.

**Infrastructure note (nested stacks, 2026-04):** Splitting SAM into nested stacks resolves CloudFormation transformed-template **size limits** for deploy. That work is **orthogonal** to G3 closure: **G3 stays YELLOW** until environment-specific proof is attached, including **`npm run security:g3`** logs in the target account, **WAF** attachment proof, **CORS** proof, **Secrets Manager** `describe-secret`/loader proof, **IAM/S3** policy review, **webhook validation** proof, **tenant isolation** testing, and **reviewer signoff**.

### Checklist (implementation vs. evidence)

| Item | Repo / control hook | Evidence state |
|---|---|---|
| Secrets not baked into frontend bundles | `apps/web/lib/public-web-config.ts` inventory + scanners | PARTIAL (`g3-secret-scan-results.md`) |
| Secrets never logged verbatim | `apps/api/src/security/redact.ts` + logger meta redaction | PARTIAL (`redact` unit tests + manual log review cadence) |
| Sensitive runtime values from Secrets Manager / env fallback | `apps/api/src/lib/runtimeSecrets.ts`, SAM ARNs | PARTIAL (`g3-secrets-manager-proof.md`) |
| WAF present when required | `EnableApiWaf` + ACL association (`infra/template.yaml`) | BLOCKED until parameter enabled **and** live attachment proved |
| CORS bounded | `PilotProdNoCorsWildcard` SAM rule + `cors-origin.ts` helper | PARTIAL (`g3-cors-proof.md`) |
| JWT authorizer/session validation | Cognito JWT default authorizer (`infra/template.yaml`) | PARTIAL (`g3-auth-session-proof.md`) |
| Square webhook signatures | `billingSquareHttp` branch + Secrets | PARTIAL (`g3-square-webhook-proof.md`) |
| Other inbound APIs | Stripe webhook etc. | PARTIAL (`g3-external-api-validation-proof.md`) |
| Replay / idempotency | Square dedupe Dynamo table; Stripe service | PARTIAL |
| S3 uploads least privilege | IAM + presign paths | PARTIAL (`g3-iam-s3-policy-review.md`) |
| Encryption in transit / at rest defaults | Dynamo/S3/SMS | PARTIAL (`g3-encryption-proof.md`) |

**Status semantics**

- **COMPLETE** — reviewer-facing proof attached from the **target environment** (logs, CLI output, dashboards).
- **PARTIAL** — code or IaC landed; **environment-specific** manual proof still pending.
- **BLOCKED** — prerequisite missing (`EnableApiWaf`, customer origins list, KMS mandate, …).

**Current decision:** Keep G3 at **YELLOW**. Promoting to **GREEN** requires the GREEN bar above **plus** recorded sign-offs — not repository state alone.
