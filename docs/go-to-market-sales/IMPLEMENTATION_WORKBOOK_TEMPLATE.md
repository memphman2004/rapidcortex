# Implementation workbook template (per agency)

**Copy** this file per pilot (e.g. `internal/workbooks/<agency>-<year>.md`). Do not commit agency-specific PII to a public repo.

## 1. Identity

| Field | Value |
|-------|-------|
| Agency legal name | |
| Agency `agencyId` (JWT `custom:agencyId`) | |
| Jurisdiction URL slug(s) | |
| Pilot window (start / end) | |

## 2. Points of contact

| Role | Name | Email | Phone / Teams | Hours |
|------|------|-------|-----------------|-------|
| Agency executive sponsor | | | | |
| Agency IT / security | | | | |
| Floor supervisor / comms lead | | | | |
| Training lead | | | | |
| Rapid Cortex pilot lead | | | | |
| Rapid Cortex on-call / escalation | | | | |

## 3. Technical references (no secrets in this table)

| Item | Value / link |
|------|----------------|
| Web base URL | |
| API base (if disclosed to agency) | |
| Cognito user pool id (public id ok) | |
| Region(s) | |
| Stack / stage name | |
| Hosted docs base (`NEXT_PUBLIC_DOCUMENTATION_BASE_URL`) | |

## 4. Governance checkpoints

| Checkpoint | Owner | Target date | Done |
|------------|-------|-------------|------|
| SOW / assistive AI alignment | | | ☐ |
| Privacy / retention decision | | | ☐ |
| Protocol approval path | | | ☐ |
| Multilingual scope | | | ☐ |

## 5. User-role mapping (pilot start)

| Display name | Email | `custom:role` | Notes |
|--------------|-------|---------------|-------|
| | | dispatcher | |
| | | supervisor | |
| | | admin | |

## 6. Multilingual (if in scope)

| Field | Choice |
|-------|--------|
| Languages in pilot | |
| Strict validation expected? | |
| Secrets owner (agency vs RC) | |

## 7. Training & go-live

| Milestone | Date | Owner |
|-----------|------|-------|
| Kickoff ([PILOT_KICKOFF_CHECKLIST.md](./PILOT_KICKOFF_CHECKLIST.md)) | | |
| Technical smoke ([PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)) | | |
| Dispatcher training ([TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md)) | | |
| First live exercise | | |

## 8. Feedback loop

| Retro date | Top themes | `KNOWN_LIMITATIONS` update needed? |
|------------|------------|-------------------------------------|
| | | ☐ |

## Related

- [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md)
- [AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md)
