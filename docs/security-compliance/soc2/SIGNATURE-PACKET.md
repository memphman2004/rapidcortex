# Management signature packet — SOC 2 policies POL-01–POL-12

**Not a Type II report.** Signing this packet adopts the in-repo policies as Rapid Cortex internal policy. It does **not** create an AICPA attestation.

**Signer:** Jeff Coleman, management / board equivalent for Apps on Demand LLC d/b/a Rapid Cortex (entity naming still LEG-007).

**Documents in scope (git paths):**

1. `docs/security-compliance/soc2/SYSTEM-BOUNDARY.md`
2. POL-01 … POL-12 under `docs/security-compliance/soc2/policies/`
3. Pre-window closeout `docs/security-compliance/soc2/evidence/2026-09-19-prewindow/`

Print this page + the policy PDFs (or a zip of the markdown). Store the **wet-ink or DocuSign PDF** in the private compliance share, not in git.

## Attestation (sign by 2026-09-30)

I have reviewed the Rapid Cortex SOC 2 control pack dated 2026-09-19. I adopt POL-01 through POL-12 as internal policy for production stack `rapid-cortex-dev` / `app.rapidcortex.us` / AWS account `158961537080`. I understand:

- We do **not** claim “SOC 2 Type II” or “SOC 2 certified” until a CPA firm issues a report.
- Shared-account carve-out (other products in the same AWS account) is accepted for the first observation window (R-SOC-001).
- CAD write-back stays fail-closed.
- SAM must **not** create a second CloudTrail Object Lock COMPLIANCE bucket on live (`EnableCloudTrail=false`).

| Field | Sign |
|-------|------|
| Name | Jeff Coleman |
| Role | Management |
| Date (UTC) | ________________ |
| Signature | ________________ |
| Second signer (optional, recommended) | ________________ |

## Shared-account carve-out (same signature block may cover)

I confirm other products in account `158961537080` are out of Rapid Cortex Type II scope per SYSTEM-BOUNDARY.md §3.

| Field | Sign |
|-------|------|
| Name | Jeff Coleman |
| Date (UTC) | ________________ |
| Signature | ________________ |
