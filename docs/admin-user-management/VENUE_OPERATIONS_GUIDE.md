# Venue operations guide — install, setup & day-2 care

**Audience:** **Venue** security, guest services, and IT administrators (stadiums, arenas, convention centers, entertainment districts).  
**Scope:** Browser-based **venue console** — not a 911 PSAP dispatch system.  
**Canonical scope:** [MVP_SCOPE.md](../go-to-market-sales/MVP_SCOPE.md) · [NON_GOALS.md](../go-to-market-sales/NON_GOALS.md) · [role-dashboard-spec.md](../role-dashboard-spec.md) (Venue section).

---

## 1. What venue Rapid Cortex is (and is not)

| Rapid Cortex venue **is** | Rapid Cortex venue **is not** |
|---------------------------|-------------------------------|
| Assistive incident intake, staff workflows, QR/NFC location context | A replacement for **911**, CAD, or public-safety radio |
| Orange-branded **venue console** at `/app/venue/{code}` | A PSAP dispatcher workspace |
| SMS/text intake **when a dedicated venue number is configured** | Shared toll-free routing for cold inbound texts |

**Every venue guest-services screen** must display that this is **not** a 911 emergency dispatch system (product requirement per `role-dashboard-spec.md`).

---

## 2. Roles

| Role | Console | Primary tasks |
|------|---------|---------------|
| `VENUE_ADMIN` | Venue admin | Users, locations, QR codes, settings |
| `VENUE_SUPERVISOR` | Supervisor | Live ops monitoring, escalations |
| `VENUE_SECURITY` | Security | Incident response, floor coordination |
| `VENUE_OPERATOR` | Operator | Day-to-day incident handling |
| `VENUE_GUEST_SERVICES` | Guest services | Guest-facing intake — **not 911** |

Venue users must **not** be provisioned with PSAP roles (`dispatcher`, `supervisor`, etc.).

---

## 3. Before go-live

### 3.1 Dedicated SMS / text number (required for cold inbound)

Unlike PSAP (dispatcher-initiated outbound SMS from a shared line), **each venue needs its own dedicated phone number** — the inbound number is the **only routing key** for unsolicited texts.

1. Collect venue legal name, address, and signatory for Twilio A2P registration.  
2. Provision a **local area code** matching the venue when possible.  
3. Map the number to the venue `agencyId` in platform config (RC ops).  
4. Document the number on physical signage — see internal `RC_Campus_Venue_Onboarding_Guide-2.docx`.

**Cost order of magnitude:** ~$1–2/month per number + SMS usage (internal ops doc).

### 3.2 URLs and access

| Item | Pattern |
|------|---------|
| Venue console | `https://[your-host]/app/venue/[venue-code]/` |
| Login | Cognito-hosted or agency SSO per contract |
| QR admin | Venue admin only — [QR installation PDF](../../../Rapid%20Cortex%20Internal%20Docs/RC_QR_Code_Installation_Guide.pdf) |

### 3.3 Checklists

- [ ] [AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md) (venue tenant row)  
- [ ] [training/PILOT_AGENCY_ADMIN_CHECKLIST.md](../training/PILOT_AGENCY_ADMIN_CHECKLIST.md) (venue admin)  
- [ ] Staff training on **when to direct guests to 911** vs venue intake  

---

## 4. Day-2 operations

- **Incidents** — venue-scoped only; no PSAP incident table.  
- **Media / caller links** — when module enabled, follow agency SOP for consent and retention.  
- **Audit** — venue admins review agency-scoped audit log; export per contract.  
- **Support** — [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md); include `requestId` and venue code.

---

## 5. Troubleshooting

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Text to venue number creates wrong tenant | Shared number misconfiguration | Dedicated number per venue — Section 3.1 |
| User lands on PSAP dashboard | Wrong `custom:role` | Re-provision as `VENUE_*` |
| Guest services missing disclaimer | UI regression | Escalate to RC support — P1 for venue vertical |

See [TROUBLESHOOTING_GUIDE.md](../operations-runbooks/TROUBLESHOOTING_GUIDE.md).

---

## 6. Bundle with venue onboarding package

Ship with: [USER_GUIDE.md](./USER_GUIDE.md), [KNOWN_LIMITATIONS.md](../product-architecture/KNOWN_LIMITATIONS.md), signed scope agreement, and venue-specific playbook.

**Related:** [CAMPUS_OPERATIONS_GUIDE.md](./CAMPUS_OPERATIONS_GUIDE.md) · [CONTRACT_PACKAGE_INDEX.md](../go-to-market-sales/CONTRACT_PACKAGE_INDEX.md)
