# Pilot signature packet (Track 3 — this month)

Pricing, the pilot offer, and the MSA templates are **done**. The next move is an agency past the signature line and onto the platform. This file is the send-order, not a new contract.

Canonical commercial index: [CONTRACT_PACKAGE_INDEX.md](./CONTRACT_PACKAGE_INDEX.md).

## Close path

1. **Commercial** — Pilot offer + Agency Pilot Scope Agreement (remove “Draft” after counsel).  
   - Offer: `Rapid Cortex Internal Docs/Sales_Marketing/Rapid_Cortex_Pilot_Offer_Professional.docx`  
   - Scope: `Rapid Cortex Internal Docs/Internal Product requirements/04_Rapid_Cortex_Agency_Pilot_Scope_Agreement_Draft.pdf`
2. **Signature** — Adobe Sign / agency counsel. Keep signed copies **out of git**. RC Admin → Agreements when Adobe Sign is connected.
3. **Platform** — [AGENCY_ONBOARDING_RUNBOOK.md](../operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md) after countersignature.

MSA for production (not required to start a scoped pilot): `Rapid Cortex Internal Docs/Contract_legal stuff/COMPLETE_MSA_MASTER_DOCUMENT.docx` and public copy `apps/web/public/docs/MASTER SERVICES AGREEMENT.docx`. Counsel must pick **one** contracting entity (Apps on Demand LLC vs Rapid Cortex, LLC) before a production MSA.

## If a security review is in flight

Send this trust packet **before** arguing features. These two artifacts unblock most PSAP/IT questionnaires:

| Send | Path | Claim language |
|---|---|---|
| **CJIS / SOC 2 alignment statement** | `Rapid Cortex Internal Docs/Internal Product requirements/02_Rapid_Cortex_Security_CJIS_SOC2_Alignment_Statement.pdf` | Alignment only — **not** CJIS certification or a SOC 2 Type II report |
| **SOC 2 technical-controls evidence** | [docs/evidence/2026-09-17-soc2-technical-controls/README.md](../evidence/2026-09-17-soc2-technical-controls/README.md) and [docs/evidence/soc2-evidence/2026-10-snapshot/README.md](../evidence/soc2-evidence/2026-10-snapshot/README.md) | Engineering snapshot of CloudTrail / PITR / MFA / WAF / ACM — observation window, not an auditor letter |
| CJIS engineering notes | [CJIS_ALIGNMENT_NOTES.md](../security-compliance/CJIS_ALIGNMENT_NOTES.md) | Same: alignment, not FBI approval |
| Questionnaire draft | [SECURITY_QUESTIONNAIRE_RESPONSES.md](../security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md) | Customize per agency |
| Subprocessors | [SUBPROCESSOR_LIST.md](../security-compliance/SUBPROCESSOR_LIST.md) | Draft |

Do **not** write “SOC 2 Type II certified” or “CJIS certified” in email. If they ask for the Type II report, route through sales — it is not in this repo.

## After signature (activation, not sales)

- Wyze: [WYZE_ACTIVATION.md](../product-architecture/WYZE_ACTIVATION.md)  
- Nest agency linking: [NEST_SDM_ACTIVATION.md](../product-architecture/NEST_SDM_ACTIVATION.md)  
- CAD write-back stays **fail-closed**.
