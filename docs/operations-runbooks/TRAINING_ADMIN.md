# Agency admin training — live product paths

**Audience:** Cognito **`admin`** users for a pilot agency. Matches `apps/web` admin routes; **no screenshots**.

**Also read:** [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md), [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md), [ROLE_MAPPING_GUIDE.md](./ROLE_MAPPING_GUIDE.md).

## 1. First logins checklist

1. **`/<slug>/admin/pilot`** — walk onboarding milestones and doc links.
2. **`/<slug>/admin/configuration`** — confirm **API live**, **offline demo off**, expected **Cognito** public ids, integration summary (AI chain, multilingual issues = 0 when healthy).
3. **`/<slug>/admin/users`** — verify pilot roster; create missing accounts (see limits below).
4. **`/<slug>/admin/audit`** — confirm events appear after a test incident.

## 2. Users (`/<slug>/admin/users`)

- **Create user** — email, agency id (locked to **your** agency if you are an agency admin), role `dispatcher` | `supervisor` | `admin`, temp password. Success message confirms creation; deliver password via **agency secure channel** (email is suppressed from Cognito invite).
- **Save** on a row — updates `custom:agencyId` / `custom:role` when allowed; errors show **inline in red** under actions.
- **Deactivate** — disables sign-in; **re-enable is not in this UI** (Cognito console / `AdminEnableUser` per [USER_PROVISIONING_GUIDE.md](./USER_PROVISIONING_GUIDE.md)).

## 3. Common support tasks (admin)

| User report | You check | If not resolved |
|-------------|-----------|-----------------|
| “Cannot see admin pages” | Their `custom:role` is `admin` | IT adjusts Cognito attributes |
| “403 on Integrations” | They are `dispatcher` — expected | Explain; supervisors may still be blocked—only `admin` sees integration status |
| “API offline” | Configuration page + Connections | Escalate to platform / DevOps ([SUPPORT_MODEL.md](./SUPPORT_MODEL.md)) |
| “AI always errors” | Incident id + time + error text | Open ticket with `requestId`; see [TROUBLESHOOTING_GUIDE.md](./TROUBLESHOOTING_GUIDE.md) |

## 4. What admins do **not** do in the UI

- Change **Lambda AI or multilingual secrets** — internal ops ([AGENCY_CONFIGURATION_GUIDE.md](./AGENCY_CONFIGURATION_GUIDE.md)).
- Assign **`platform_superadmin`**, **`readonly_auditor`**, **`analyst`** — Cognito outside UI today.

## Related

- [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md) (admin segment)
- [QUICKSTART_CARD.md](./QUICKSTART_CARD.md)
