# Agency setup checklist (agency + Rapid Cortex)

Use alongside [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md). Checkboxes are **shared**—assign an owner (A = agency, R = Rapid Cortex, J = joint).

## A. Contacts & governance (J)

- [ ] Executive sponsor named (A).
- [ ] IT / security contact named (A).
- [ ] Floor supervisor / training lead named (A).
- [ ] Rapid Cortex pilot lead named (R).
- [ ] [AGENCY_PLAYBOOK_TEMPLATE.md](./AGENCY_PLAYBOOK_TEMPLATE.md) copy started (J).

## B. Inputs (A → R)

- [ ] Primary jurisdiction slug + public URLs (A).
- [ ] `agencyId` / jurisdiction slug follows `locality-state` naming (e.g. `atlanta-ga`, `erie-pa`) (A/R).
- [ ] Pilot window + change window preferences (A).
- [ ] Privacy / retention posture or “follow RC defaults” decision (A / counsel).
- [ ] Protocol pack approval path (A).
- [ ] Multilingual in/out of pilot scope + languages (A).
- [ ] User list with emails and roles (`dispatcher` / `supervisor` / `admin`) (A).

## C. Technical baseline (R, validated by A/IT)

- [ ] Stack deployed; web env matches [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md) (R).
- [ ] Cognito pool + app client; MFA policy communicated (R / A).
- [ ] `NEXT_PUBLIC_OFFLINE_DEMO_MODE` **not** set on pilot web host unless sandbox-only (R).
- [ ] CORS origins correct for pilot web origin (R).
- [ ] Integration status endpoint healthy for admin test user (R).

## D. Provisioning (R or agency admin)

- [ ] Agency `agencyId` aligned with JWT claims strategy (R).
- [ ] Admin users live; **Admin → Pilot hub** reachable (A admin).
- [ ] Pilot dispatcher/supervisor accounts created ([ADMIN_GUIDE.md](./ADMIN_GUIDE.md)) (A admin with R support).

## E. Readiness for first class (J)

- [ ] [PILOT_KICKOFF_CHECKLIST.md](./PILOT_KICKOFF_CHECKLIST.md) complete.
- [ ] [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md) scheduled or delivered.
- [ ] [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) acknowledged by floor supervision (A).

## Definition of done

All sections **A–E** checked with named owners and dates → proceed to go-live validation ([PILOT_VALIDATION_CHECKLIST.md](./PILOT_VALIDATION_CHECKLIST.md)).
