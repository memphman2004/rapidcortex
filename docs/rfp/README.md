# RFP cybersecurity & implementation pack

**Audience:** sales, solutions, agency IT/security, procurement.  
**Use:** attach these three files (plus linked runbooks) when an RFP asks for CJIS-aligned security controls and an implementation/transition plan.  
**Status:** Complete as a **control and procedure pack**. Not a certification.

Canonical product claims remain in [NON_GOALS.md](../go-to-market-sales/NON_GOALS.md) and [SALES_BOUNDARIES.md](../go-to-market-sales/SALES_BOUNDARIES.md).

---

## What “complete” means here

| Included | Not included (cannot be shipped as software) |
|----------|-----------------------------------------------|
| Documented controls mapped to each RFP bullet | FBI / CSO **CJIS certification** or CJIS-ATP |
| Operating procedures Rapid Cortex will follow | A **staffed 24/7 SOC** unless the 24/7 support add-on is purchased |
| AWS-native detection (WAF, CloudWatch, audit, optional GuardDuty) | Traditional on-prem IDS/IPS appliances on the agency LAN |
| Tenant IAM, RBAC, encryption, logging | Segmentation of the **agency’s** PSAP network |
| Implementation schedule, cutover, rollback, UAT, BCP, risk plan | Filled dates, names, and RTO/RPO **until a SOW is signed** |
| Vulnerability-management process | A current third-party **pen-test report** (separate SOW) |
| IR and DR runbooks | Contractual SLA numbers unless Exhibit C is executed |

Copy the **standard schedule** in [implementation-and-transition.md](./implementation-and-transition.md) into the agency workbook and fill owners/dates. Do not send a blank template as if it were that agency’s plan.

---

## Forbidden proposal language

Do **not** write any of the following unless counsel and a completed assessment program exist:

- “CJIS-compliant” / “CJIS certified” / “CJIS-ATP”
- “SOC 2 Type II” / “FedRAMP authorized”
- “We operate a 24/7 Security Operations Center” (without the paid support upgrade)
- “We will segment the agency network” or “we replace CAD/911”

**Safe phrasing:** “CJIS-**aligned** technical controls documented for agency mapping,” “AWS WAF and CloudWatch monitoring with documented on-call response,” “assistive co-pilot alongside CAD.”

---

## Artifact map

| RFP bullet | Pack section | Supporting product / ops docs |
|------------|--------------|-------------------------------|
| CJIS-aligned security controls | [cybersecurity-controls.md](./cybersecurity-controls.md) §1 | [CJIS_ALIGNMENT_NOTES.md](../security-compliance/CJIS_ALIGNMENT_NOTES.md), [SECURITY_MODEL.md](../security-compliance/SECURITY_MODEL.md) |
| Multi-layer architecture | §2 | [IT_DEPARTMENT_TECHNICAL_OVERVIEW.md](../product-architecture/IT_DEPARTMENT_TECHNICAL_OVERVIEW.md) |
| SOC monitoring | §3 | [MONITORING_AND_OPS.md](../operations-runbooks/MONITORING_AND_OPS.md) |
| IDS / IPS | §4 | [g3-waf-proof.md](../security/g3-waf-proof.md), [DECEPTION_SHIELD.md](../security/DECEPTION_SHIELD.md) |
| Network segmentation | §5 | Tenant isolation + AWS trust zones |
| IAM | §6 | [AUTH_OPERATIONS.md](../product-architecture/AUTH_OPERATIONS.md) |
| Security event logging | §7 | [AUDIT_EVENT_MATRIX.md](../security-compliance/AUDIT_EVENT_MATRIX.md) |
| Vulnerability management | §8 | [CI_RELEASE_PIPELINE.md](../deployment-infrastructure/CI_RELEASE_PIPELINE.md) |
| Incident response | §9 | [INCIDENT_RESPONSE.md](../operations-runbooks/INCIDENT_RESPONSE.md) |
| Disaster recovery | §10 | [BACKUP_AND_RECOVERY.md](../operations-runbooks/BACKUP_AND_RECOVERY.md) |
| Implementation schedule | [implementation-and-transition.md](./implementation-and-transition.md) §1 | [AGENCY_ONBOARDING_RUNBOOK.md](../operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md) |
| Cutover strategy | §2 | [PILOT_GOVERNANCE.md](../go-to-market-sales/PILOT_GOVERNANCE.md) |
| Rollback | §3 | [RUNBOOK.md](../operations-runbooks/RUNBOOK.md) |
| Testing methodology | §4 | [TEST_STRATEGY.md](../product-architecture/TEST_STRATEGY.md) |
| Acceptance testing | §5 | [PILOT_VALIDATION_CHECKLIST.md](../go-to-market-sales/PILOT_VALIDATION_CHECKLIST.md) |
| Transition support | §6 | [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md) |
| Operational continuity | §7 | Backup + support + floor fallback |
| Risk mitigation | §8 | [risk-register.md](../phase-0/risk-register.md) |

---

## RFP zip (minimum)

1. This README  
2. `cybersecurity-controls.md`  
3. `implementation-and-transition.md`  
4. [SECURITY_QUESTIONNAIRE_RESPONSES.md](../security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md)  
5. [SUBPROCESSOR_LIST.md](../security-compliance/SUBPROCESSOR_LIST.md)  
6. CJIS / SOC 2 **alignment** PDF (internal product requirements) — alignment only  

Add per-agency: filled implementation workbook, network diagram for **this** tenant’s access path, executed DPA after signature.

---

## Version

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-08-21 | Initial complete pack for cybersecurity + implementation RFP bullets |
