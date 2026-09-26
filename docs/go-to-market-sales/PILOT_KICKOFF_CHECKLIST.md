# Pilot kickoff checklist (meeting-ready)

**Last reviewed:** 2026-09-19 (60-day refresh) · **Owner:** Jeff Coleman

Run in the **first joint session** after signature and before broad user access. Deep implementation steps live in [AGENCY_ONBOARDING_RUNBOOK.md](../operations-runbooks/AGENCY_ONBOARDING_RUNBOOK.md).

## Attendees (minimum)

- Agency: executive sponsor or delegate, IT/security, floor supervisor or training lead.
- NexCort iQ: pilot lead + implementation engineer.

## Decisions to capture (60–90 minutes)

| Topic | Decision recorded? | Doc / owner |
|-------|-------------------|-------------|
| Assistive AI + human-in-the-loop rules | ☐ | [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md) |
| In-scope vs out-of-scope recap | ☐ | [MVP_SCOPE.md](./MVP_SCOPE.md), [NON_GOALS.md](./NON_GOALS.md), [SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md) |
| Pilot URLs + slug + environments (pilot vs staging) | ☐ | Playbook §B ([AGENCY_PLAYBOOK_TEMPLATE.md](../admin-user-management/AGENCY_PLAYBOOK_TEMPLATE.md)) |
| **MFA enrollment** (TOTP/SMS) for every floor user | ☐ | [AUTH_OPERATIONS.md](../product-architecture/AUTH_OPERATIONS.md) |
| Privacy / retention checkpoint | ☐ | [PRIVACY_RETENTION_DECISIONS.md](../security-compliance/PRIVACY_RETENTION_DECISIONS.md) |
| Protocol pack approval owner | ☐ | [PROTOCOL_REVIEW_REQUIREMENTS.md](../security-compliance/PROTOCOL_REVIEW_REQUIREMENTS.md) |
| Multilingual: in pilot vs phased | ☐ | [LANGUAGE_TRANSLATION_CONFIGURATION.md](../product-architecture/LANGUAGE_TRANSLATION_CONFIGURATION.md) |
| Role mapping + pilot user list (`custom:role` / `custom:agencyId`) | ☐ | [ADMIN_GUIDE.md](../admin-user-management/ADMIN_GUIDE.md) |
| Support & escalation (L1/L2/L3) | ☐ | [SUPPORT_MODEL.md](../operations-runbooks/SUPPORT_MODEL.md) |
| Success metrics & retro cadence | ☐ | [PILOT_SUCCESS_AND_FEEDBACK.md](./PILOT_SUCCESS_AND_FEEDBACK.md) |
| Contract packet (DPA still draft / no Type II claim) | ☐ | [CONTRACT_PACKAGE_INDEX.md](./CONTRACT_PACKAGE_INDEX.md) |

## Outputs before leaving the room

- [ ] [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md) started or updated with owners/dates.
- [ ] Agency admins can open **`/{slug}/admin/pilot`** (smoke test).
- [ ] At least one admin completed **password + MFA** on the production pool.
- [ ] Next **three** working sessions scheduled (technical cutover, admin provisioning, training).

## Related

- [AGENCY_SETUP_CHECKLIST.md](../admin-user-management/AGENCY_SETUP_CHECKLIST.md)
- [PILOT_READINESS_CHECKLIST.md](../deployment-infrastructure/PILOT_READINESS_CHECKLIST.md)
