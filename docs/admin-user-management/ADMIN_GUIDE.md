# Rapid Cortex — Admin guide

For **agency administrators** and **platform operators** who manage users, review audit trails, and verify integration health. Dispatchers and supervisors should start with [USER_GUIDE.md](./USER_GUIDE.md).

## Roles and access (Cognito)

| Cognito `custom:role` | Product access |
| --- | --- |
| `dispatcher` | Dashboard, history, review (as implemented); **no** admin hub routes. |
| `supervisor` | Same as dispatcher plus **audit list** (`GET /api/audit/events`) where exposed in UI. |
| `admin` | Agency-scoped **users**, **audit**, **integrations status**, agency settings views. |
| `platform_superadmin` | Cross-agency platform tools (agencies, billing surfaces) where deployed; **must** pass explicit `agencyId` for tenant-scoped lists (see [API_SURFACE.md](./API_SURFACE.md)). |
| `readonly_auditor` | Read-oriented posture; **cannot** create incidents (API returns **403**). |
| `analyst` | Placeholder for future analyst workflows. |

Authorization is enforced in the **API** using JWT claims (`custom:agencyId`, `custom:role`). The URL **jurisdiction slug** is for routing and branding only.

## Admin hub routes (`https://www.rapidcortex.us/<slug>/admin/...`)

| Route | Purpose |
| --- | --- |
| `/admin` | Entry to admin sections (nav only if role allows). |
| `/admin/pilot` | **Pilot & onboarding hub** — GTM doc links, sales/scope matrix, admin shortcuts, demo vs production note, local onboarding tracker ([GTM_PACKAGE.md](./GTM_PACKAGE.md)). |
| `/admin/configuration` | **Read-only configuration** — browser `NEXT_PUBLIC_*` snapshot, pilot UX flags, embedded **integration status** (AI + multilingual summary). |
| `/admin/users` | List and manage users (Cognito-backed admin APIs). |
| `/admin/audit` | Agency-scoped audit timeline (sensitive fields redacted in list payloads). |
| `/admin/integrations` | **`GET /api/integration/status`** — multilingual strict-mode signals, AI tier labels, connector rollout flags (**admin-only**; dispatchers receive **403**). |
| `/admin/settings` | **Operator reference** for deploy-time configuration (not a live remote-config API). |
| `/admin/protocols` | Protocol pack management where enabled. |
| `/admin/billing` | Billing UI when Square or stubs are configured. |
| `/admin/platform/agencies` | Platform superadmin agency CRUD. |

## Typical workflows

### Onboard a new dispatcher

1. Create or invite the user (admin **Users** screen or Cognito console, per deployment).
2. Set **`custom:agencyId`** and **`custom:role`** = `dispatcher` (or `supervisor`).
3. Confirm they can open `/<slug>/login` and reach `/<slug>/dashboard` with **Connections** strip showing API **live** (see [USER_GUIDE.md](./USER_GUIDE.md)).

### Investigate “wrong agency” or permission errors

1. Decode JWT (dev tools / jwt.io in a secure environment) and verify **`custom:agencyId`** and **`custom:role`**.
2. Compare with incident `agencyId` in API or DynamoDB (operator access).
3. See [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) for escalation.

### Verify pilot readiness after a deploy

1. Run [`scripts/post-deploy-smoke.sh`](../scripts/post-deploy-smoke.sh) (optional: authenticated variables).
2. Open **Admin → Integrations** and confirm no unexpected `MULTILINGUAL_CONFIG_INVALID` counts for the stage.
3. Spot-check **Admin → Audit** for recent `incident.created` / analysis events.

## Setup and provisioning (canonical)

- [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) — admin hub map, preconditions, honest UI limits.
- [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md) — create / patch / deactivate; what is **not** in UI.
- [ROLE_MAPPING_GUIDE.md](./ROLE_MAPPING_GUIDE.md) — Cognito roles vs API vs provisioning UI.
- [CONFIGURATION_REFERENCE.md](./CONFIGURATION_REFERENCE.md) — who changes which class of settings.
- [PILOT_CONFIGURATION_MODEL.md](./PILOT_CONFIGURATION_MODEL.md) — global vs env vs agency vs role.
- [FEATURE_FLAGS.md](./FEATURE_FLAGS.md) — web vs Lambda toggles.
- [AGENCY_CONFIGURATION_GUIDE.md](./AGENCY_CONFIGURATION_GUIDE.md) — agency vs internal ops ownership.
- [ENVIRONMENT_CONFIGURATION_REFERENCE.md](./ENVIRONMENT_CONFIGURATION_REFERENCE.md) — long-form env listing.
- [TRAINING_ADMIN.md](./TRAINING_ADMIN.md) — admin-facing class material (live UI).

## Related documents

- [GTM_PACKAGE.md](./GTM_PACKAGE.md) — full onboarding / GTM index aligned with **Admin → Pilot hub**.
- [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md) — signed pilot → first use.
- [IMPLEMENTATION_WORKBOOK_TEMPLATE.md](./IMPLEMENTATION_WORKBOOK_TEMPLATE.md) — per-agency workbook (copy per tenant).
- [USER_GUIDE.md](./USER_GUIDE.md) — operator URLs and workspace behavior.
- [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) — who handles which ticket class.
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) — outages and security events.
- [AUDIT_EVENT_MATRIX.md](./AUDIT_EVENT_MATRIX.md) — audit vocabulary.
- [SECURITY_MODEL.md](./SECURITY_MODEL.md) — pilot-grade controls.
- [RUNBOOK.md](./RUNBOOK.md) — infrastructure operations.
