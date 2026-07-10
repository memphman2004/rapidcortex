# Campus operations guide — install, setup & day-2 care

**Audience:** **Campus** public safety, security, and IT administrators (universities, K–12 districts, corporate campuses).  
**Scope:** Browser-based **campus console** — not a 911 PSAP dispatch system.  
**Canonical scope:** [MVP_SCOPE.md](../go-to-market-sales/MVP_SCOPE.md) · [role-dashboard-spec.md](../role-dashboard-spec.md) (Campus section).

---

## 1. What campus Rapid Cortex is (and is not)

| Campus Rapid Cortex **is** | Campus Rapid Cortex **is not** |
|----------------------------|--------------------------------|
| Assistive safety workflows, location-aware intake (QR/NFC), staff coordination | A replacement for **911**, campus police radio, or Clery-only reporting alone |
| Slate/neutral **campus console** at `/app/campus/{code}` | A PSAP transcription or CAD workspace |
| Dedicated SMS number for **cold inbound** student/staff texts | Shared PSAP toll-free for unsolicited texts |

Campus reporters typically have **no login** when texting a number from signage — the **destination phone number** must map to exactly one campus agency.

---

## 2. Roles

| Role | Console | Primary tasks |
|------|---------|---------------|
| `CAMPUS_ADMIN` | Campus admin | Users, locations, QR codes, policy |
| `CAMPUS_SUPERVISOR` | Supervisor | Ops oversight, escalations |
| `CAMPUS_SECURITY` | Security | Patrol coordination, incidents |
| `CAMPUS_DISPATCH` | Campus dispatch | Campus-scoped queue (not 911 PSAP) |

Campus users must **not** receive PSAP roles. Clery and state education reporting remain **agency-owned** processes — Rapid Cortex may support workflows but does not replace statutory filings.

---

## 3. Before go-live

### 3.1 Dedicated SMS / text number

Same routing rule as venues — see [VENUE_OPERATIONS_GUIDE.md](./VENUE_OPERATIONS_GUIDE.md) §3.1 and internal `RC_Campus_Venue_Onboarding_Guide-2.docx`.

1. Local area code preferred (e.g. campus state area code on signs).  
2. A2P 10DLC campaign registration for US SMS.  
3. Map number → campus `agencyId`.  
4. Test cold inbound: text from mobile → correct campus console incident.

### 3.2 QR / NFC location program

| Asset | Guide |
|-------|--------|
| QR codes | `RC_QR_Code_Installation_Guide` (Internal Docs / Product Usage) |
| NFC tags | `RC_NFC_Tag_Installation_Guide` (Internal Docs) |

Only `CAMPUS_ADMIN` (and RC superadmin) manage QR inventory — PSAP roles excluded.

### 3.3 URLs

| Item | Pattern |
|------|---------|
| Campus console | `https://[your-host]/app/campus/[campus-code]/` |
| QR resolve | Per printed QR → location context in incident |

### 3.4 Checklists

- [ ] [AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md)  
- [ ] [training/PILOT_AGENCY_ADMIN_CHECKLIST.md](../training/PILOT_AGENCY_ADMIN_CHECKLIST.md)  
- [ ] Clery-adjacent marketing copy reviewed by compliance if public-facing ([content-roadmap](../../../apps/marketing/content-roadmap.md))

---

## 4. Day-2 operations

- Escalation to **911** remains explicit SOP — campus console does not auto-transfer to PSAP.  
- **Audit** — campus-scoped; coordinate with general counsel on retention.  
- **FERPA / student privacy** — map data classes in agency playbook; executed DPA required.

---

## 5. Troubleshooting

| Symptom | Action |
|---------|--------|
| Inbound SMS wrong campus | Verify dedicated number mapping |
| User sees PSAP UI | Fix `custom:role` — must be `CAMPUS_*` |
| QR scan wrong building | Re-print QR; verify location admin record |

---

## 6. Onboarding package

Ship with: [USER_GUIDE.md](./USER_GUIDE.md), [KNOWN_LIMITATIONS.md](../product-architecture/KNOWN_LIMITATIONS.md), campus playbook, signed DPA.

**Related:** [VENUE_OPERATIONS_GUIDE.md](./VENUE_OPERATIONS_GUIDE.md) · [HOSPITAL_OPERATIONS_GUIDE.md](./HOSPITAL_OPERATIONS_GUIDE.md)
