# G3 Evidence — Secret & Public-Env Scan (Pilot Readiness)

> **G3 customer gate:** **[`customer-readiness-gate.md`](../customer-readiness-gate.md)** — **YELLOW**: code and IaC controls have advanced; **environment-specific PASS evidence** and **reviewer signoffs** are still required in the **target** environment. **Code + IaC progress does not replace environment-specific proof.** **Do not** mark G3 GREEN from code, IaC, local tests, or intended configuration alone. Master rollup: [`g3-security-controls-platform.md`](./g3-security-controls-platform.md).

**Status:** PARTIAL — automated pattern scan + manual review notes. This document does **not** assert SOC 2, CJIS certification, or full production security sign-off.

## Method

- Repository script: `npm run security:scan-secrets` (`scripts/check-repo-secrets.mjs`) — blocks PEM blocks, `AKIA…` key material patterns, classic GitHub PAT shapes in tracked files.
- Supplemental search (2026-04-30): `rg` for `sk_live`, `AWS_SECRET_ACCESS_KEY` in `apps/`, `packages/`, `infra/` (excluding `node_modules`, `dist`).

## Findings

| Category | Result | Notes |
|---|---|---|
| Hardcoded long-lived cloud credentials in source | **None found** in tracked `apps/` / `packages/` / `infra/` via pattern scan at time of review. | Re-run before each release. |
| `NEXT_PUBLIC_*` usage | **Expected public identifiers** only (Cognito pool id + app client id, site URL, feature flags). | These are **not** secret signing keys — they identify public OAuth/OIDC endpoints. Rotate via Cognito when compromise is suspected (operational playbook, not codebase change). |
| `.env.example` / marketing samples | Contains **placeholder** Cognito identifiers and localhost-oriented examples. | Replace with tenant-specific values at deploy time; never commit tenant secrets. |

## Remediation applied in G3 sprint

- Centralized **`[REDACTED]`** logging via `apps/api/src/security/redact.ts` and `apps/api/src/lib/logger.ts` meta sanitization.
- Lambda CORS reflections no longer unconditionally `*` (`apps/api/src/handlers/billingSquareHttp.ts` + `security/cors-origin.ts`).

## Ongoing hygiene

1. CI should keep `npm run security:scan-secrets` green.
2. Do not paste production tokens into issues, transcripts, or screen shares.
