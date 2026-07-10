# Hospital operations guide — capacity portal & coordination

**Audience:** **Hospital** ED leadership, EMS liaisons, and IT administrators using the hospital vertical.  
**Scope:** **Capacity and routing portal** — not EMS dispatch or PSAP CAD.  
**Canonical scope:** [role-dashboard-spec.md](../role-dashboard-spec.md) (Hospital section).

---

## 1. What hospital Rapid Cortex is (and is not)

| Hospital module **is** | Hospital module **is not** |
|------------------------|----------------------------|
| Bed capacity, diversion status, facility routing visibility | A 911 call-taking or EMS dispatch system |
| Teal-branded **hospital portal** (`/hospital-admin/*`, `/hospital-staff/*`) | A PSAP dispatcher workspace |
| Coordination surface for regional EMS ↔ hospital capacity | Medical direction or clinical decision support |

**PHI / HIPAA:** Hospital deployments require a executed **BAA** in addition to DPA — see [DOCUMENT_GAPS.md](../go-to-market-sales/DOCUMENT_GAPS.md) LEG-003. This guide is operational only.

---

## 2. Roles

| Role | Dashboard | Capabilities (summary) |
|------|-----------|------------------------|
| `HOSPITAL_ADMIN` | `/hospital-admin/dashboard` | Facility config, users, regional capacity views |
| `HOSPITAL_STAFF` | `/hospital-staff/dashboard` | Update capacity status (primary action) |
| `HOSPITAL_COORDINATOR` | `/hospital-admin/dashboard` (scoped) | EMS liaison / regional coordination |

> **Note:** `HOSPITAL_COORDINATOR` permission set is **product intent** — confirm matrix in `packages/security` before selling ([role-dashboard-spec.md](../role-dashboard-spec.md)).

Hospital users must **not** receive PSAP or venue/campus roles.

---

## 3. Before go-live

### 3.1 Legal and compliance

- [ ] **BAA** executed (counsel) — not included in standard PSAP pilot packet  
- [ ] **DPA** executed  
- [ ] Agency classification of capacity/diversion data in playbook  
- [ ] No transcript or 911 audio modules enabled unless explicitly in hospital SOW  

### 3.2 Technical setup

| Item | Owner |
|------|--------|
| Hospital tenant `agencyId` | RC ops |
| Cognito users with `HOSPITAL_*` roles | Hospital IT + RC admin |
| Facility list / capacity fields | Hospital admin |
| Integration to regional EMS (if any) | Per integration SOW |

### 3.3 Training

| Audience | Guide |
|----------|--------|
| Hospital admin | [TRAINING_ADMIN.md](../operations-runbooks/TRAINING_ADMIN.md) (hospital sections) |
| Clinical staff | Staff dashboard — capacity update only; minimal UI |
| EMS coordinators | Coordinator scoped view — confirm permissions before training |

---

## 4. Day-2 operations

- **Capacity updates** — staff role primary workflow; audit changes.  
- **Diversion status** — agency SOP defines who may declare diversion.  
- **Regional view** — admin/coordinator; no cross-hospital data without contract scope.  
- **Support** — [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md); **no PHI in email subjects**.

---

## 5. Troubleshooting

| Symptom | Action |
|---------|--------|
| User lands on dispatch console | Wrong role — must be `HOSPITAL_*` |
| Coordinator sees admin-only actions | Permissions not finalized — check security matrix |
| Capacity not visible to EMS partners | Integration not in scope or adapter not deployed |

---

## 6. Onboarding package

Ship with: executed BAA + DPA, hospital playbook, [PRIVACY_RETENTION_DECISIONS.md](../security-compliance/PRIVACY_RETENTION_DECISIONS.md), [SECURITY_MODEL.md](../security-compliance/SECURITY_MODEL.md).

**Related:** [JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md) (PSAP) · [CONTRACT_PACKAGE_INDEX.md](../go-to-market-sales/CONTRACT_PACKAGE_INDEX.md)
