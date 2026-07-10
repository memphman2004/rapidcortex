# Agency playbook — EXAMPLE (fictional pilot)

> **EXAMPLE ONLY** — fictional agency for training and template reference.  
> Copy [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md) for real agencies; store filled copies outside public repos if they contain contacts.

**Agency:** Metro Regional Emergency Communications Center (fictional)  
**Pilot type:** PSAP / ECC — assistive AI pilot  
**Onboarding runbook:** [AGENCY_ONBOARDING_RUNBOOK.md](../operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md)

---

## A. Agency identity

| Field | Value |
|--------|--------|
| Agency legal name | Metro Regional Emergency Communications Center |
| Public safety org type | Regional ECC / PSAP |
| Pilot window (start / end) | 2026-08-01 → 2026-09-30 (60 days) |

---

## B. URLs and environments

| Environment | Web base URL | API base (if disclosed) | Notes |
|-------------|--------------|------------------------|--------|
| Training / staging | `https://app.rapidcortex.us/metro-train/login` | Not disclosed to floor staff | Training accounts only |
| Pilot production | `https://app.rapidcortex.us/metro/login` | BFF proxy — browser uses web origin only | Live pilot floor |

**Default jurisdiction slug(s):** `metro` (training: `metro-train`)

**Password / MFA policy owner:** Dana Chen, IT Director — `dchen@metro-ecc.example.gov`

---

## C. Operational contacts

| Role | Name | Email / phone | Hours |
|------|------|-----------------|-------|
| Agency pilot executive sponsor | Chief Maria Okonkwo | `mokonkwo@metro-ecc.example.gov` | Business |
| IT / identity (Cognito) | Dana Chen | `dchen@metro-ecc.example.gov` | 07:00–19:00 ET |
| ECC supervision lead | Lt. James Rivera | `jrivera@metro-ecc.example.gov` | Shift coverage |
| Medical director / protocol authority | Dr. Patel (EMS medical control) | Via agency medical director office | On-call |
| Rapid Cortex support (contract) | RC Pilot Desk | `pilot@rapidcortex.us` | Per SUPPORT_MODEL |

---

## D. Assistive AI and escalation (SOP alignment)

- **Agency acknowledgment:** AI output is **decision support only** — dispatchers and supervisors retain authority; CAD and radio are systems of record.
- **When dispatchers must stop using AI suggestions:** Active hostage/barricade per local SOP; any time supervisor declares “AI hold”; when transcript confidence is flagged and supervisor unavailable > 2 min — use voice-only protocol.
- **Supervisor review SLA for AI-flagged incidents:** Supervisor acknowledges within **15 minutes** during peak; **5 minutes** when AI flags weapons or officer-down categories (agency-defined).

---

## E. Protocol guidance

- **Named protocol pack version(s):** Metro Fire/EMS v2024-Q4 (approved 2025-11-01)
- **Sign-off record:** Email approval from Dr. Patel on file with ECC training office (ref: MRECC-PROTO-2025-11)
- **Process when local SOP changes mid-pilot:** Freeze protocol pack updates until weekly pilot review; RC applies pack version bump only after written agency approval.

---

## F. Data — classification and handling

- **Classification:** Incident metadata, transcripts, and AI analyses treated as **law enforcement sensitive / CJIS-adjacent** — minimum necessary access.
- **Support tickets:** Use ticket body for symptoms only; **do not** attach full transcripts unless legal approves; always include incident id and UTC timestamp.

---

## G. Retention, export, and deletion

- **Retention:** Pilot data retained **90 days** after pilot end unless extended in writing; aligns with `TRANSCRIPT_RETENTION_POLICY_DAYS=90` on stack.
- **Export requests:** Lt. Rivera — coordination with RC ops within **5 business days**.
- **Deletion requests:** Chief Okonkwo + agency counsel — written request to `privacy@rapidcortex.us`.
- **Legal hold:** Agency counsel — `counsel@metro-ecc.example.gov`

---

## H. Incidents and outages

| Severity | Definition (agency) |
|----------|---------------------|
| **P1** | Rapid Cortex unavailable during live 911 operations for > 5 min |
| **P2** | Multilingual or analyze failures affecting > 25% of active calls |

**Runbook addendum:** Floor falls back to CAD/voice-only; supervisors notify RC Pilot Desk within 15 min of P1.

---

## I. Training sign-off

| Audience | Trainer | Date completed |
|----------|---------|----------------|
| Dispatchers (12) | Lt. Rivera | 2026-07-28 |
| Supervisors (4) | Lt. Rivera + RC SE | 2026-07-29 |
| Admins (2) | Dana Chen | 2026-07-27 |

Checklists on file: [PILOT_DISPATCHER_CHECKLIST.md](../training/PILOT_DISPATCHER_CHECKLIST.md), [PILOT_SUPERVISOR_CHECKLIST.md](../training/PILOT_SUPERVISOR_CHECKLIST.md), [PILOT_AGENCY_ADMIN_CHECKLIST.md](../training/PILOT_AGENCY_ADMIN_CHECKLIST.md).

---

## Modules in pilot scope (reference)

Per signed pilot scope agreement (fictional):

- Real-time transcription  
- AI incident analysis (assistive)  
- Supervisor monitoring / QA sample  
- Read-only CAD adapter (mock feed for training; read-only vendor sandbox week 3+)  
- **Excluded:** CAD write-back, NCIC, autonomous routing  

---

**Non-goals reminder:** This pilot does not imply CAD certification, full PSAP replacement, or formal compliance attestation — see [NON_GOALS.md](../go-to-market-sales/NON_GOALS.md).
