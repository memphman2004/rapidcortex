# Contract & commercial package index

**Audience:** sales, solutions, legal ops, implementation leads.  
**Status:** Internal — paths and filenames reflect repo layout as of 2026-07.  
**Not legal advice.** Marked **DRAFT** items require counsel and/or Finance before customer send.

---

## How to use this index

| Customer stage | Send first | Add when |
|----------------|------------|----------|
| **Discovery / NDA** | NDA (if needed) | Before sharing architecture or live tenant access |
| **Pilot evaluation** | Pilot offer + scope agreement + trust packet | Before floor time on live incidents |
| **Production subscription** | MSA + Order Form (Exhibit A SOW) + Pricing (Exhibit B) + SLA (Exhibit C) | Before production go-live and recurring billing |
| **RC Lite API only** | RC Lite API Agreement + API pricing guide | Before API key issuance |
| **CAD integration** | Per-vendor SOW addendum + [CAD_CONNECTION_PLAYBOOK.md](../product-architecture/CAD_CONNECTION_PLAYBOOK.md) | Only when CAD scope is in contract |

Keep **signed** copies outside git (CRM, Adobe Sign ledger, agency secure share). RC Admin → **Agreements** tracks Adobe Sign completions when connected.

---

## 1. Pilot agencies (PSAP / ECC)

| Document | Location | Status | Notes |
|----------|----------|--------|-------|
| Pilot offer (commercial narrative) | `Rapid Cortex Internal Docs/Sales_Marketing/Rapid_Cortex_Pilot_Offer_Professional.docx` | Sales-ready | Marketing copy; not a contract |
| **Agency pilot scope agreement** | `Rapid Cortex Internal Docs/Internal Product requirements/04_Rapid_Cortex_Agency_Pilot_Scope_Agreement_Draft.pdf` | **DRAFT** | Remove “Draft”; legal review; assistive-use language |
| Agency onboarding checklist (PDF) | `Rapid Cortex Internal Docs/Internal Product requirements/05_Rapid_Cortex_Agency_Onboarding_Checklist.pdf` | Internal | Companion to scope agreement |
| Data flow overview | `Rapid Cortex Internal Docs/Internal Product requirements/03_Rapid_Cortex_Data_Flow_and_Architecture_Overview.pdf` | Internal | Security / IT reviewers |
| CJIS / SOC2 alignment statement | `Rapid Cortex Internal Docs/Internal Product requirements/02_Rapid_Cortex_Security_CJIS_SOC2_Alignment_Statement.pdf` | Alignment only | **Not** certification |
| **DPA** | [DPA_DRAFT.md](./legal-drafts/DPA_DRAFT.md) (draft) + marketing stub | **DRAFT** | PLT-003; counsel before execution |
| **Security review sign-off** | Per agency process | **GAP** | PLT-002 |
| Implementation workbook | [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md) | Template | Copy per agency |
| Agency playbook | [AGENCY_PLAYBOOK_TEMPLATE.md](../admin-user-management/AGENCY_PLAYBOOK_TEMPLATE.md) | Template | Fill before go-live |

**Product docs to bundle with pilot (no signature):** [JURISDICTION_OPERATIONS_GUIDE.md](../admin-user-management/JURISDICTION_OPERATIONS_GUIDE.md) Appendix A manifest, [KNOWN_LIMITATIONS.md](../product-architecture/KNOWN_LIMITATIONS.md), [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md).

---

## 2. Production / non-pilot agencies

| Document | Location | Status | Notes |
|----------|----------|--------|-------|
| **Master Services Agreement** | `Rapid Cortex Internal Docs/Contract_legal stuff/COMPLETE_MSA_MASTER_DOCUMENT.docx` | Template | Apps on Demand LLC d/b/a Rapid Cortex — reconcile entity with Platform Agreement |
| Public MSA copy | `apps/web/public/docs/MASTER SERVICES AGREEMENT.docx` | Template | Same family as complete MSA |
| **Platform Services Agreement** | `Rapid Cortex Internal Docs/Contract_legal stuff/RC_Platform_Services_Agreement.docx` | v1.0 template | Adobe Sign path; Exhibit A has `$TBD` pricing |
| Exhibit A — Statement of Work | Inside MSA / Platform Agreement | Template | Populate from [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md) |
| Exhibit B — Pricing | Inside MSA | **TBD amounts** | Finance + `RC_Pricing_Master_Guide_v4.xlsx` |
| Exhibit C — SLA | Inside MSA | Template | Do not promise public SLA until executed |
| **Order Form** | [ORDER_FORM_DRAFT.md](./legal-drafts/ORDER_FORM_DRAFT.md) | **DRAFT** | Counsel + Finance; references MSA |
| **Change Order** | [CHANGE_ORDER_DRAFT.md](./legal-drafts/CHANGE_ORDER_DRAFT.md) | **DRAFT** | Scope/fee amendments |
| **DPA (draft markdown)** | [DPA_DRAFT.md](./legal-drafts/DPA_DRAFT.md) | **DRAFT** | Counsel review before Adobe Sign |
| Go / no-go checklist | `Rapid Cortex Internal Docs/Internal Product requirements/06_Rapid_Cortex_Production_Go_No_Go_Checklist.pdf` | Internal | Pre-GA gate |

---

## 3. RC Lite API (partners / developers)

| Document | Location | Status |
|----------|----------|--------|
| RC Lite API Agreement | `Rapid Cortex Internal Docs/Contract_legal stuff/RC_Lite_API_Agreement.docx` | v1.0 template |
| API pricing (internal) | [RC_Lite_API_Pricing.md](../pricing-billing/RC_Lite_API_Pricing.md) | Internal — align with agreement before send |

Adobe Sign `agreement_type: rc_lite` auto-provisions tenants when webhooks are wired ([`packages/shared/src/adobe-sign/schemas.ts`](../../packages/shared/src/adobe-sign/schemas.ts)).

---

## 4. Trust & procurement packet (attach to any stage)

Send as a zip or secure link when security/legal asks before signature:

| Artifact | Location | Status |
|----------|----------|--------|
| RFP cybersecurity & implementation pack | [rfp/README.md](../rfp/README.md) | Complete procedures — **not** certification |
| Security questionnaire responses (draft) | [SECURITY_QUESTIONNAIRE_RESPONSES.md](../security-compliance/SECURITY_QUESTIONNAIRE_RESPONSES.md) | Draft — customize per RFP |
| Subprocessor list | [SUBPROCESSOR_LIST.md](../security-compliance/SUBPROCESSOR_LIST.md) | Draft — review quarterly |
| Security model (technical) | [SECURITY_MODEL.md](../security-compliance/SECURITY_MODEL.md) | Product |
| Privacy / retention | [PRIVACY_RETENTION_DECISIONS.md](../security-compliance/PRIVACY_RETENTION_DECISIONS.md) | Product |
| Tenant isolation | [TENANT_ISOLATION_MODEL.md](../security-compliance/TENANT_ISOLATION_MODEL.md) | Product |
| Audit event matrix | [AUDIT_EVENT_MATRIX.md](../security-compliance/AUDIT_EVENT_MATRIX.md) | Product |
| CJIS alignment notes | [CJIS_ALIGNMENT_NOTES.md](../security-compliance/CJIS_ALIGNMENT_NOTES.md) | Alignment only |

**Not available in repo:** SOC 2 Type II report, executed BAA, CJIS SLA rider, pen-test report — request through sales; trust page discloses this.

---

## 5. Vertical products (Campus / Venue / Hospital)

| Document | Location | Status |
|----------|----------|--------|
| Venue operations guide | [VENUE_OPERATIONS_GUIDE.md](../admin-user-management/VENUE_OPERATIONS_GUIDE.md) | Customer markdown |
| Campus operations guide | [CAMPUS_OPERATIONS_GUIDE.md](../admin-user-management/CAMPUS_OPERATIONS_GUIDE.md) | Customer markdown |
| Hospital operations guide | [HOSPITAL_OPERATIONS_GUIDE.md](../admin-user-management/HOSPITAL_OPERATIONS_GUIDE.md) | Customer markdown |
| Campus / venue onboarding (internal) | `Rapid Cortex Internal Docs/RC_Campus_Venue_Onboarding_Guide-2.docx` | Internal — SMS/Twilio depth |
| Role access matrix | `Rapid Cortex Internal Docs/Internal Product requirements/RapidCortex_Role_Access_Matrix_v2.pdf` | Internal |
| Product role spec | [role-dashboard-spec.md](../role-dashboard-spec.md) | Engineering / SE |
| Example filled playbook | [EXAMPLE_agency-pilot-2026.md](../admin-user-management/playbooks/EXAMPLE_agency-pilot-2026.md) | Fictional example |

Transit-specific customer onboarding remains a gap until `/app/transit` ships.

---

## 6. Entity & naming reconciliation (legal action)

| Issue | Files affected |
|-------|----------------|
| **Apps on Demand LLC** vs **Rapid Cortex, LLC** | `COMPLETE_MSA_MASTER_DOCUMENT.docx` vs `RC_Platform_Services_Agreement.docx` |
| Counsel must pick **one** contracting entity and amend all templates | Before first production signature |

---

## 7. Related operational docs

- Gap tracker: [DOCUMENT_GAPS.md](./DOCUMENT_GAPS.md)
- GTM lifecycle: [GTM_PACKAGE.md](./GTM_PACKAGE.md)
- 90-day execution: [GTM_EXECUTION_PLAN.md](./GTM_EXECUTION_PLAN.md)
- Deploy blockers: [NEXT_DEPLOY_BLOCKERS.md](../deployment-infrastructure/NEXT_DEPLOY_BLOCKERS.md) (PLT-001–004 governance)
