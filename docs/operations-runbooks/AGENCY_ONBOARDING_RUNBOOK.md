# Agency onboarding runbook — signed pilot to first use

**Companion checklists:** [AGENCY_SETUP_CHECKLIST.md](./AGENCY_SETUP_CHECKLIST.md), [PILOT_KICKOFF_CHECKLIST.md](./PILOT_KICKOFF_CHECKLIST.md), [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md).  
**Field guide for each jurisdiction (install, setup, maintenance, troubleshooting, ZIP manifest):** [JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md).  
**In-app trackers:** **Admin → Pilot hub** (`/{slug}/admin/pilot`) — milestones + GTM checklist (browser-local).

## 0. Preconditions

- [ ] Signed pilot agreement / SOW reflects **assistive** posture ([PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)).
- [ ] [MVP_SCOPE.md](./MVP_SCOPE.md) + [NON_GOALS.md](./NON_GOALS.md) acknowledged by agency leadership.
- [ ] **Agency points of contact** recorded: executive sponsor, IT/security, comms floor supervisor, training lead ([AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md)).

## 1. Required inputs from the agency

Collect in [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md):

- Jurisdiction slug(s) for URLs; primary **`NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG`** value.
- Pilot window dates; maintenance / change-freeze preferences.
- **Privacy / retention** decisions or pointers to counsel ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)).
- **Protocol** ownership: who approves packs and change control ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)).
- **Multilingual** intent: languages in scope; whether voice pipeline is in pilot or deferred ([LANGUAGE_TRANSLATION_CONFIGURATION.md](./LANGUAGE_TRANSLATION_CONFIGURATION.md)).
- **User-role mapping** at pilot start: counts per `dispatcher` / `supervisor` / `admin` ([ADMIN_GUIDE.md](./ADMIN_GUIDE.md)).

## 2. Required setup from Rapid Cortex team

- [ ] Deploy or confirm **pilot stack** + web env per [INSTALLATION.md](./INSTALLATION.md), [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md).
- [ ] **CORS** and **Cognito** app client aligned with web origin.
- [ ] **Secrets** and AI / multilingual provider config for agreed scope ([AI_PROVIDER_CONFIGURATION.md](./AI_PROVIDER_CONFIGURATION.md)).
- [ ] **Agency** row / tenant id used in JWT claims strategy documented for admins.
- [ ] **Smoke:** [PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md) relevant rows green.

## 3. Checkpoints (must not be skipped)

| Checkpoint | Decision / output |
|------------|-------------------|
| **Privacy & retention** | Agency posture captured; legal sign-off if required ([PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md)). |
| **Protocol** | Approved packs list + review owner ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)). |
| **Multilingual** | In scope / phased; secrets owner; strict validation expectation ([DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md)). |
| **Roles** | Mapping table approved; pilot users named ([COGNITO_SELF_SIGNUP.md](./COGNITO_SELF_SIGNUP.md) if used). |

## 4. Admin provisioning steps

1. Agency **admin** accounts created with `custom:role=admin` and correct `custom:agencyId`.
2. Open **`/{slug}/admin/pilot`** — walk milestones + doc links.
3. **Users** — create dispatcher/supervisor accounts; first-login password flow per pool policy.
4. **Integrations** — verify panel shows expected AI/multilingual posture for the stage.
5. **Audit** — confirm events appear after a test incident.

## 5. Training and first use

- Deliver [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md); distribute [USER_GUIDE.md](./USER_GUIDE.md) and [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md).
- First production-shaped session: create/list/open incident, append transcript, run analysis ([PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)).

## 6. Success criteria — “agency onboarded”

- [ ] At least **N** pilot users active per agreed role mix.
- [ ] **Connections** / integration status matches agreed “live” posture ([USER_GUIDE.md](./USER_GUIDE.md)).
- [ ] **Kickoff checkpoints** (privacy, protocol, multilingual, roles) **signed** in workbook or playbook.
- [ ] **Support path** agreed ([SUPPORT_MODEL.md](./SUPPORT_MODEL.md)).
- [ ] **Pilot success** review cadence scheduled ([PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md)).

## Related

- [GTM_PACKAGE.md](./GTM_PACKAGE.md)
- [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)
