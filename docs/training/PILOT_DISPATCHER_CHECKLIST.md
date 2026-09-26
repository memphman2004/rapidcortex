# Pilot checklist — dispatcher

**Last reviewed:** 2026-09-19 (60-day refresh)

Use with [USER_GUIDE.md](../admin-user-management/USER_GUIDE.md) and the agency’s completed [AGENCY_PLAYBOOK_TEMPLATE.md](../admin-user-management/AGENCY_PLAYBOOK_TEMPLATE.md).

## Every shift

- [ ] Sign in at the **agency URL** provided by IT (not a personal bookmark to another tenant’s slug).
- [ ] Complete **MFA** (authenticator app or SMS) when prompted — production requires it.
- [ ] Confirm **connection strip**: API shows **Live backend** before working real incidents.
- [ ] Treat AI text as **suggestions** — agency policy and supervisor direction override software.

## When handling live incidents

- [ ] Verify **incident** agency and title match the call you are working.
- [ ] For **multilingual** calls, watch interpreter / low-confidence flags; follow agency SOP for interpreter services.

## If something breaks

- [ ] Note whether **API offline**, **503 MULTILINGUAL_CONFIG_INVALID**, or **analyze** errors — contact operations per [RUNBOOK.md](../operations-runbooks/RUNBOOK.md).

## Related

- Supervisor checklist: [PILOT_SUPERVISOR_CHECKLIST.md](./PILOT_SUPERVISOR_CHECKLIST.md)
