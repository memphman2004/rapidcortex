# Evidence templates (G1–G5)

These files are **templates only**. Copy them to `docs/evidence/` (or your customer packet) when you have **real** test output, log excerpts, and **dated signatures**.

**Do not** check in filled templates with production URLs, tokens, or customer data.

| Gate | Template | Automated support in repo |
|------|----------|---------------------------|
| G1 | [`g1-tenant-isolation-evidence.template.md`](./g1-tenant-isolation-evidence.template.md) | `npm run test:security` (includes `jwt-validation.test.ts`, cross-tenant, RBAC) |
| G2 | [`g2-cad-integration-safety-evidence.template.md`](./g2-cad-integration-safety-evidence.template.md) | `npm run test:g2` + `npm run pilot:smoke` (when configured) |
| G3 | [`g3-security-controls-evidence.template.md`](./g3-security-controls-evidence.template.md) | `./scripts/security-g3-validation.sh` + `npm run security:g3` with `BASE_URL` |
| G4 | [`g4-auditability-evidence.template.md`](./g4-auditability-evidence.template.md) | `./scripts/audit-scenario-tests.sh` (live API) + audit unit tests in `apps/api` |
| G5 | [`g5-operational-safety-evidence.template.md`](./g5-operational-safety-evidence.template.md) | `./scripts/fire-drill-rollback.sh` (checklist) |
| Aggregate | [`GREEN-status-report.template.md`](./GREEN-status-report.template.md) | Only after gate sheet is legitimately GREEN with sign-offs |

**G6 (CAD write-back)** remains **RED by design** until separate governance; do not use the GREEN aggregate template to imply write-back approval.
