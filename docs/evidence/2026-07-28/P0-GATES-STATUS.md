# P0 Gates G1–G5 — Evidence Run 2026-07-28

**Environment:** `rapid-cortex-dev` / `us-east-1` (+ prod web CDN for WAF proof)  
**Collector:** automated agent + AWS CLI (`AWS_PROFILE=rapid-cortex`)  
**Verdict:** **NOT GREEN overall** — see per-gate status. Do not treat this pack as production approval.

Raw logs: `/tmp/p0-gates/` on the collection host.

---

## Summary

| Gate | Status after this run | Why |
|------|----------------------|-----|
| **G1** Tenant isolation | **YELLOW → almost GREEN** | Unit suite 39/39 PASS. Live isolation **30/32 PASS**; 2 FAIL fixed in code (media 503 / transcript 400 → must **redeploy API** then re-run). Human sign-off pending. |
| **G2** CAD read safety | **YELLOW (write-back GREEN-safe)** | Write-back CFN `CadWritebackEnabled=false`; BFF returns “not enabled”; stack2 writeback 403 `addon_not_enabled`. Vitest G2 9/9 + writeback 15/15 PASS. **No customer CAD vendor adapter E2E** → cannot claim full CAD-read GREEN. |
| **G3** Security controls | **YELLOW / in progress** | SSR CDN WAF attached. API `EnableApiWaf` redeploy with `ENABLE_API_WAF=true` started 2026-07-28T16:20:33Z (`/tmp/p0-gates/api-redeploy-waf-enable.log`). Confirm `EnableApiWaf=true` + non-empty `ApiWebAclArn` after deploy. |
| **G4** Auditability | **YELLOW** | Repo validation scenarios PASS historically; **live audit export pack not executed** (script still stub). |
| **G5** Operational safety | **YELLOW** | Fire drill filed: `docs/evidence/2026-07-28/g5-operational-safety.md`. Writeback disabled evidenced. Smoke 13/1 (stale Next chunk). No N−1 CFN rollback. |

---

## G1 — Tenant isolation & authentication

### Automated
- `npm run test:security` → **39 passed** (`/tmp/p0-gates/g1-test-security.txt`)

### Live
- Script: `RC_TEST_PASSWORD=… bash scripts/run-cross-agency-isolation-test.sh`
- Result: **30 PASS / 2 FAIL** (`/tmp/p0-gates/g1-live-isolation-final.txt`)
  - FAIL: media list → **503** (infra gate before tenant)
  - FAIL: transcript write → **400** (Zod before tenant)
- **Code fix (this repo, pending deploy):**
  - `apps/api/src/services/mediaService.ts` — tenant assert before `assertMediaInfra`
  - `apps/api/src/handlers/addTranscriptChunk.ts` + `transcriptService.assertAccess` — auth/tenant before body validation

### Sign-off
- [ ] Engineering lead
- [ ] Security lead  
**After API redeploy + isolation 32/32 PASS → eligible for GREEN.**

---

## G2 — CAD integration safety (read scope)

### Automated
- `npm run test:g2` → **9 passed**
- Writeback unit tests → **15 passed**

### Live write-back denial
- CFN `CadWritebackEnabled=false` on `rapid-cortex-dev` + nested AppSam stacks
- Web BFF `POST /api/cad/writeback/request` → **400** “CAD write-back is not enabled…”
- Stack2 authenticated writeback → **403** `addon_not_enabled`

### Remaining for full G2 GREEN (CAD-read pilot)
- [ ] One real vendor read adapter E2E against customer staging CAD  
- [ ] Negative-path logs (timeout / malformed) attached  
**Manual/shadow pilot without CAD:** write-back safety is evidenced; mark G2 **YELLOW with documented limitation** (no live CAD read).

---

## G3 — Security controls

| Control | Evidence | Status |
|---------|----------|--------|
| Web CDN WAF | `arn:aws:wafv2:us-east-1:158961537080:global/webacl/rapid-cortex-v2-web-cdn-prod/…` on `E1T1KDP4B7PNW7` | PASS (SSR) |
| Marketing hosting WAF | `EWZ286WS69KX1` WebACLId empty | GAP |
| API Gateway WAF | `EnableApiWaf=false`, empty `ApiWebAclArn` | **BLOCKER** |
| CORS | Lambda `APPROVED_CORS_ORIGINS` set on some functions; OPTIONS `/api/health` → 404; GET health 200 without ACAO | GAP |
| Secrets | Prior pack + no values printed this run | PARTIAL |

### Required for GREEN
1. Redeploy with `ENABLE_API_WAF=true` (all AppSam nests that create ApiWebAcl)
2. CORS probe matrix (approved vs evil origin) on a real authenticated route
3. Security + DevOps sign-off

---

## G4 — Auditability

- Live `scripts/audit-scenario-tests.sh` is a **stub** without authenticated audit export.
- Prior `compliance-evidence/06-audit-scenarios.md` = Vitest validation only.

### Required for GREEN
- [ ] ≥5 authenticated scenarios with request IDs + redacted audit export  
- [ ] Compliance/security sign-off

---

## G5 — Operational safety

- Write-back kill switch evidenced (G2 above).
- `scripts/fire-drill-execute.sh` added for timed smoke + writeback probe.
- `post-deploy-smoke.sh dev` failed (no `rapid-cortex-web-ssr-dev`); use prod SSR stack or API-only smoke for API gates.
- No N−1 artifact rollback executed.

### Required for GREEN
- [ ] Execute `bash scripts/fire-drill-execute.sh dev us-east-1` (and API smoke) with timestamps filed  
- [ ] Optional: true N−1 ECS/Lambda rollback drill  
- [ ] SRE sign-off

---

## Explicit non-claims

- Does **not** assert CJIS / SOC 2 certification.
- Does **not** enable CAD write-back (G6 remains RED).
- Does **not** replace human reviewer signatures required by `docs/customer-readiness-gate.md`.
