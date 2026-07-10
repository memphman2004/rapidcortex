# Order Form — DRAFT

> **STATUS: DRAFT — COUNSEL AND FINANCE REVIEW REQUIRED**  
> Attach to and governed by the **Master Services Agreement** (`COMPLETE_MSA_MASTER_DOCUMENT.docx`) or **Platform Services Agreement**.  
> Exhibit A (Statement of Work) may be attached or incorporated by reference.

---

## Order details

| Field | Value |
|-------|--------|
| **Order Form ID** | RC-OF-[YYYY]-[NNNN] |
| **Customer legal name** | [AGENCY LEGAL NAME] |
| **Contracting entity** | [TBD — Apps on Demand LLC d/b/a Rapid Cortex **or** Rapid Cortex, LLC] |
| **Effective date** | [DATE] |
| **MSA effective date** | [DATE] (or “MSA executed concurrently”) |
| **Initial term** | [12] months from Service Commencement Date |
| **Auto-renewal** | [Yes / No] per MSA Article 3 |

---

## 1. Service tier and modules

| Item | Selection |
|------|-----------|
| **Plan** | [ ] Essential  [ ] Professional  [ ] Command  [ ] Enterprise  [ ] Pilot (see Pilot Scope Agreement) |
| **Agency type** | [ ] PSAP / ECC  [ ] Campus  [ ] Venue  [ ] Hospital  [ ] Other: ______ |
| **Jurisdiction slug(s)** | [e.g. `erie-county`] |
| **Cognito agency ID** | `[agencyId UUID or slug]` |

### Modules in scope (check all that apply)

Align with [SALES_SCOPE_MATRIX.md](../SALES_SCOPE_MATRIX.md) — do not check modules not sold.

| Module | In scope | Notes |
|--------|----------|-------|
| Real-time transcription | [ ] | |
| AI incident analysis (assistive) | [ ] | Human-in-the-loop required |
| Multilingual STT / translation | [ ] | Requires provider config |
| Supervisor QA / review queues | [ ] | |
| Non-emergency / triage queue | [ ] | If enabled in SOW |
| CAD read-only adapter | [ ] | Vendor: ______ |
| CAD assisted write-back | [ ] | **Separate legal addendum required** |
| Media / caller link intake | [ ] | |
| Ring Connect | [ ] | |
| Desktop apps (macOS / Windows) | [ ] | |
| RC Lite API | [ ] | Use RC Lite Agreement instead if API-only |

---

## 2. Users and sites

| Metric | Quantity |
|--------|----------|
| **Licensed seats (concurrent)** | [N] |
| **Sites / jurisdictions** | [N] |
| **Dedicated SMS number (campus/venue)** | [ ] Yes — [number]  [ ] N/A (PSAP) |

---

## 3. Fees (Finance to complete)

> Public marketing remains quote-based. **Do not** publish this section.

| Line item | Amount (USD) | Frequency |
|-----------|--------------|-----------|
| Platform subscription | $[TBD] | Monthly / Annual |
| One-time implementation | $[TBD] | Once |
| Training (onsite days) | $[TBD] | Per SOW |
| CAD integration (if any) | $[TBD] | Per vendor SOW |
| **Total year-one estimate** | $[TBD] | |

**Payment terms:** Net [30] · PO required: [ ] Yes [ ] No · PO #: ______

**Tax:** [ ] Tax-exempt — certificate on file [ ] Standard sales tax applies

---

## 4. Service commencement

| Milestone | Target date |
|-----------|-------------|
| Tenant provisioned | |
| Admin training complete | |
| Go-live (floor use) | |

**Service Commencement Date:** earlier of go-live or [DATE + 90 days] if agency delays are not Processor-caused.

---

## 5. Support level

| Tier | Selection |
|------|-----------|
| Standard business hours | [ ] |
| Priority / mission (if contracted) | [ ] |

Escalation contacts per [OPS_CONTACT_MATRIX.md](../../operations-runbooks/OPS_CONTACT_MATRIX.md) — fill agency rows in playbook.

---

## 6. Data and compliance

| Item | Acknowledgment |
|------|----------------|
| DPA executed | [ ] Concurrent DPA  [ ] DPA dated ______ |
| Privacy / retention decisions reviewed | [ ] Per [PRIVACY_RETENTION_DECISIONS.md](../../security-compliance/PRIVACY_RETENTION_DECISIONS.md) |
| CJIS / security review | [ ] Complete  [ ] In progress |
| Assistive AI / not autonomous dispatch | [ ] Acknowledged ([PILOT_GOVERNANCE.md](../PILOT_GOVERNANCE.md)) |

---

## 7. Special terms

[Free text — e.g. pilot extension, CAD vendor name, data residency, excluded modules]

---

## 8. Order of precedence

1. This Order Form (including Exhibit A SOW if attached)  
2. Master Services Agreement  
3. DPA  
4. Documentation and marketing materials (non-binding for scope)

---

## Signatures

| **Customer** | **Rapid Cortex** |
|--------------|------------------|
| Authorized signature | Authorized signature |
| Print name / title | Print name / title |
| Date | Date |

---

**Related:** [CHANGE_ORDER_DRAFT.md](./CHANGE_ORDER_DRAFT.md) · [CONTRACT_PACKAGE_INDEX.md](../CONTRACT_PACKAGE_INDEX.md)
