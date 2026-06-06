# Agency playbook template — pilot

**Copy this file** per agency (e.g. `playbooks/<agency>-pilot-2026.md` in your internal repo, or append to the SOW appendix). Fill every bracketed field before go-live. Step-by-step onboarding: [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md). Operational index: [GTM_PACKAGE.md](./GTM_PACKAGE.md). Canonical product scope: [MVP_SCOPE.md](./MVP_SCOPE.md). Non-goals: [NON_GOALS.md](./NON_GOALS.md).

---

## A. Agency identity

| Field | Value |
|--------|--------|
| Agency legal name | |
| Public safety org type (PSAP, ECC, etc.) | |
| Pilot window (start / end) | |

## B. URLs and environments

| Environment | Web base URL | API base (if disclosed) | Notes |
|-------------|--------------|------------------------|--------|
| Training / staging | | | |
| Pilot production | | | |

Default jurisdiction slug(s) in use:  

Password / MFA policy owner (IT contact):  

## C. Operational contacts

| Role | Name | Email / phone | Hours |
|------|------|-----------------|-------|
| Agency pilot executive sponsor | | | |
| IT / identity (Cognito) | | | |
| ECC supervision lead | | | |
| Medical director / protocol authority (if applicable) | | | |
| Rapid Cortex support (contract) | | | |

## D. Assistive AI and escalation (SOP alignment)

- Agency acknowledgment: AI output is **decision support only** ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)).
- When dispatchers must **stop** using AI suggestions (e.g. high-stakes divergence):  

- Supervisor **review SLA** for AI-flagged incidents:  

## E. Protocol guidance

- Named **protocol pack** version(s) approved for pilot:  

- Sign-off record for protocol content (link or attachment per [PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)):  

- Process when local SOP changes mid-pilot:  

## F. Data — classification and handling

- Agency classification for incident metadata, transcripts, analyses (reference [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)):  

- Approved channels for support tickets **without** attaching full transcripts unless policy allows:  

## G. Retention, export, and deletion

- Agency retention period / disposition for pilot data:  

- Named person for **export** or **deletion** requests to Rapid Cortex:  

- Legal hold point of contact (if different):  

## H. Incidents and outages

- Internal severity definitions for “Rapid Cortex unavailable during live ops”:  

- Link to agency runbook or addendum to [RUNBOOK.md](./RUNBOOK.md):  

## I. Training sign-off

| Audience | Trainer | Date completed |
|----------|---------|------------------|
| Dispatchers | | |
| Supervisors | | |
| Admins | | |

---

**Non-goals reminder:** This pilot does not imply CAD certification, full PSAP replacement, or formal compliance attestation—see [NON_GOALS.md](./NON_GOALS.md).
