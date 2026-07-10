# Pilot checklist — agency administrator

Use with [USER_GUIDE.md](../admin-user-management/USER_GUIDE.md), [PILOT_READINESS_CHECKLIST.md](../deployment-infrastructure/PILOT_READINESS_CHECKLIST.md), and [PILOT_READINESS.md](../deployment-infrastructure/PILOT_READINESS.md).

## Before go-live

- [ ] Confirm every user has the correct **Cognito** `custom:role` and `custom:agencyId`.
- [ ] Open **Admin → Integrations** and verify **multilingual config issues = 0** and expected AI/STT tiers.
- [ ] Confirm **audit** access policy with your legal/IT contact.

## Week one

- [ ] Review **new user** invites and deactivated accounts.
- [ ] Spot-check **audit log** for unexpected `INTEGRATION` or admin events.
- [ ] Escalate AI or voice failures to Rapid Cortex support with **approximate time** and **incident id** (no PII in email subject if policy requires).

## Ongoing

- [ ] After protocol or SOP changes, align **dispatcher** ([PILOT_DISPATCHER_CHECKLIST.md](./PILOT_DISPATCHER_CHECKLIST.md)) and **supervisor** ([PILOT_SUPERVISOR_CHECKLIST.md](./PILOT_SUPERVISOR_CHECKLIST.md)) training with floor expectations.
