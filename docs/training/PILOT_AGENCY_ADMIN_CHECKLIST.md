# Pilot checklist — agency administrator

**Last reviewed:** 2026-09-19 (60-day refresh)

Use with [USER_GUIDE.md](../admin-user-management/USER_GUIDE.md), [PILOT_READINESS_CHECKLIST.md](../deployment-infrastructure/PILOT_READINESS_CHECKLIST.md), and [PILOT_READINESS.md](../deployment-infrastructure/PILOT_READINESS.md).

## Before go-live

- [ ] Confirm every user has the correct **Cognito** `custom:role` and `custom:agencyId` (`normalizeSessionRole()`; no leftover `commsupervisor` / `platform_superadmin` as the live value).
- [ ] Confirm every floor user completed **MFA enrollment** (TOTP or SMS) on the production pool.
- [ ] Open **Admin → Integrations** and verify **multilingual config issues = 0** and expected AI/STT tiers.
- [ ] Confirm **audit** access policy with your legal/IT contact.

## Week one

- [ ] Review **new user** invites and deactivated accounts.
- [ ] Spot-check **audit log** for unexpected `INTEGRATION` or admin events.
- [ ] Escalate AI or voice failures to NexCort iQ support with **approximate time** and **incident id** (no PII in email subject if policy requires).

## Ongoing

- [ ] After protocol or SOP changes, align **dispatcher** ([PILOT_DISPATCHER_CHECKLIST.md](./PILOT_DISPATCHER_CHECKLIST.md)) and **supervisor** ([PILOT_SUPERVISOR_CHECKLIST.md](./PILOT_SUPERVISOR_CHECKLIST.md)) training with floor expectations.
