# SOC 2 Trust Services Criteria — Rapid Cortex pack

**Status:** Internal control descriptions, policies, procedures, and evidence templates.  
**Not a SOC 2 Type I or Type II report.** Do not quote this pack as an attestation.

**In-scope production:** stack `rapid-cortex-dev` · `DeploymentStage=dev` · `https://app.rapidcortex.us` · AWS account `158961537080` · region `us-east-1`.  
**Observation target:** 2026-10-01 (see [OBSERVATION-WINDOW.md](./OBSERVATION-WINDOW.md)).  
**Technical baseline:** [docs/evidence/soc2-evidence/2026-10/README.md](../../evidence/soc2-evidence/2026-10/README.md).

This directory is the **policy and operating-evidence** layer. Track 1 collected AWS CLI snapshots. Type II also requires that CC1–CC9 **operated** during the window: signed policies, access reviews, change tickets, vendor reviews, incident/tabletop notes, restore drills, and HR/training records.

**2026-09-19 closeout:** [evidence/2026-09-19-prewindow/README.md](./evidence/2026-09-19-prewindow/README.md) · [SIGNATURE-PACKET.md](./SIGNATURE-PACKET.md) · [CPA-ENGAGEMENT-SOW.md](./CPA-ENGAGEMENT-SOW.md)

---

## What this pack is

| Artifact | Path |
|----------|------|
| System boundary + shared-account carve-out | [SYSTEM-BOUNDARY.md](./SYSTEM-BOUNDARY.md) |
| TSC CC1–CC9 control matrix | [CONTROL-MATRIX.md](./CONTROL-MATRIX.md) |
| Observation calendar and sample plan | [OBSERVATION-WINDOW.md](./OBSERVATION-WINDOW.md) |
| Policy corpus (CC1–CC9) | [policies/](./policies/) |
| Operating procedures | [processes/](./processes/) (includes [60-day document review](./processes/document-review.md)) |
| Evidence logs (fill during the window) | [evidence/](./evidence/) |
| Printable templates | [docs/evidence/templates/soc2/](../../evidence/templates/soc2/) |
| Monthly CLI pack (read-only) | `scripts/soc2-observation-pack.sh` |
| Access-review export (read-only) | `scripts/soc2-access-review.sh` |
| Restore-drill helper (dry-run default) | `scripts/soc2-restore-drill.sh` |
| Live-deploy lock-in | `scripts/lib/soc2-live-production-overrides.sh` (sourced by `deploy.sh dev`) |

---

## Claim language (mandatory)

**Allowed:** “SOC 2 Type II observation period targeted to start 2026-10-01”; “SOC 2–aligned controls documented”; “technical control evidence collected.”

**Forbidden unless a CPA firm has issued the report:** “SOC 2 certified”; “SOC 2 Type II”; “we are SOC 2 compliant”; “audited to TSC.” Same rule as [PROMISE_CONTROL.md](../../go-to-market-sales/PROMISE_CONTROL.md) and [rfp/README.md](../../rfp/README.md).

This pack does **not** claim CJIS, HIPAA, or FedRAMP certification.

---

## What still requires humans (cannot be finished in git)

| Item | Why git cannot close it |
|------|-------------------------|
| CPA / AICPA firm engagement | Third-party attestation |
| Management / board policy signatures | Legal authority |
| Background checks, signed training, offer letters | HR systems; PII stays out of this repo |
| Monthly live AWS snapshots during the window | Needs `AWS_PROFILE=rapid-cortex` |
| Executed tabletop and restore drill | Operators must run them and attach tickets |
| Dedicated AWS account **or** signed carve-out | Shared account hosts other products |
| Third-party pen-test report | Separate SOW (LEG-010) |
| Executed DPA / MSA | Counsel (LEG-002, PLT-003) |

Work the remaining list from [OUT-OF-BAND.md](./OUT-OF-BAND.md) and [DOCUMENT_GAPS.md](../../go-to-market-sales/DOCUMENT_GAPS.md) (`SOC-*` rows).

---

## How to operate this pack

1. **Before 2026-10-01:** management reviews and signs policies 01–12 (store signed PDFs **outside** git). Fill the first access review, vendor review, tabletop, and restore-drill logs. Run `scripts/soc2-technical-controls-snapshot.sh` and `scripts/soc2-observation-pack.sh`.
2. **Each month of the window:** run the observation pack; attach CloudWatch/SNS alarm history; log changes and access exceptions.
3. **Each quarter:** access review + vendor review + risk register refresh.
4. **Do not** set `EnableCloudTrail=true` on `rapid-cortex-dev` — live logging is the existing trail `rapid-cortex-cloudtrail-prod` (Option B). SAM would create a **second** trail and an Object Lock **COMPLIANCE** bucket (`rapid-cortex-cloudtrail-logs-dev-*`) that cannot be deleted for ~7 years. See [SYSTEM-BOUNDARY.md](./SYSTEM-BOUNDARY.md).
5. **Do** keep `DDB_ENABLE_PITR=true` on every `deploy.sh dev`. `deploy.sh` forces this via the live-production override library.

---

## Related (do not duplicate)

- Technical model: [SECURITY_MODEL.md](../SECURITY_MODEL.md)
- Questionnaire: [SECURITY_QUESTIONNAIRE_RESPONSES.md](../SECURITY_QUESTIONNAIRE_RESPONSES.md)
- Subprocessors: [SUBPROCESSOR_LIST.md](../SUBPROCESSOR_LIST.md)
- IR (product/ops): [INCIDENT_RESPONSE.md](../../operations-runbooks/INCIDENT_RESPONSE.md)
- Backup: [BACKUP_AND_RECOVERY.md](../../operations-runbooks/BACKUP_AND_RECOVERY.md)
- Secrets rotation SOP: [secrets-rotation-sop.md](../../evidence/soc2-evidence/2026-10/secrets-rotation-sop.md)
- SDLC triage: [SECURITY_TRIAGE_PROCESS.md](../SECURITY_TRIAGE_PROCESS.md)

## Version

| Version | Date | Notes |
|---------|------|-------|
| 1.1 | 2026-09-19 | 60-day review SOP for MFA, contracts, and pilot operating docs |
| 1.0 | 2026-09-19 | Initial in-repo TSC pack for October 1 observation |
