# G5: Operational safety & rollback — evidence

**Date:** 2026-07-28  
**Environment:** `rapid-cortex-dev` / `us-east-1`  
**Drill script:** `scripts/fire-drill-execute.sh`  
**Raw log:** [`g5-fire-drill-2026-07-28T16:21:37Z.log`](./g5-fire-drill-2026-07-28T16:21:37Z.log)

## Fire drill results

| Step | Result |
|------|--------|
| Baseline smoke (`SMOKE_WEB_STACK_NAME=rapid-cortex-web-ssr-prod-v2`) | **13 PASS / 1 FAIL** — stale Next.js chunk MIME on `/login` webpack asset (CDN/HTML skew; not a kill-switch regression) |
| CAD write-back probe `POST …/api/cad/incidents` (unauth) | **HTTP 404** — route absent on stack1 execute-api; **not** a successful CAD write |
| CFN kill-switch flags | `CadWritebackEnabled=false`, `CadWritebackRequiresApproval=true`, `EnableApiWaf=false` *(WAF enable redeploy in progress)* |
| Post-drill smoke | Same 13/1 as baseline |

## Notes

- Drill continued after smoke failure so writeback + flag evidence was captured.
- Full API redeploy with `ENABLE_API_WAF=true` started 2026-07-28T16:20:33Z → log `/tmp/p0-gates/api-redeploy-waf-enable.log`. Re-check `EnableApiWaf` after deploy completes.
- N−1 CloudFormation rollback not exercised in this drill (script is non-mutating by design).

## Sign-offs

- [ ] SRE / operations lead — date: ___

**Gate status:** YELLOW — writeback-disabled evidenced; smoke chunk stale; WAF flip pending deploy completion.
