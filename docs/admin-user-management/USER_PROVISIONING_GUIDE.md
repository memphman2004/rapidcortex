# User provisioning guide

## Supported in-app (Admin → Users)

| Action | Outcome | Error handling |
|--------|---------|----------------|
| **Create user** | Cognito user with `email_verified=true`, `custom:agencyId`, `custom:role`, `FORCE_CHANGE_PASSWORD` | Form shows API error message (e.g. weak password, duplicate user, `FORBIDDEN`). |
| **Save** (directory row) | Patches `custom:agencyId` and/or `custom:role` when changed | Row shows error text on failure (e.g. `FORBIDDEN`, `INVALID_ROLE`, `USER_NOT_FOUND`). |
| **Deactivate** | `AdminDisableUser` — user cannot sign in | Button disabled if already disabled; confirm dialog; errors shown under actions. |

**Agency admin constraints (enforced in API):**

- May only create/update/deactivate users whose **existing** `custom:agencyId` matches their own (and new users must use the same agency id — the form field is read-only for agency admins).
- May assign roles **`dispatcher`**, **`supervisor`**, **`admin`** only ([`AdminUserService` assignable roles](../apps/api/src/services/adminUserService.ts)).

**Platform superadmin constraints (enforced in API):**

- May manage users across agencies; agency ID field remains editable in UI.
- May assign **`platform_superadmin`** only when the acting user is already `platform_superadmin`.
- Agency admins never see or assign `platform_superadmin` in the UI.

## Not supported in-app (document honestly)

| Need | What to do |
|------|------------|
| **Re-enable** after deactivate | Amazon Cognito **AdminEnableUser** or console; document who is allowed to run it. |
| Assign **`readonly_auditor`** or **`analyst`** | Cognito console/API until/if product UI adds support ([types](../packages/shared/src/types.ts)). |
| **Invite email** from Cognito | Current path uses `MessageAction: SUPPRESS` on create — deliver temp password via agency secure channel. |
| **MFA / password policy** changes | Cognito user pool settings — IT owner ([COGNITO_SELF_SIGNUP.md](./COGNITO_SELF_SIGNUP.md)). |

## After provisioning

1. User opens `/{slug}/login`, signs in with temp password, completes **new password** challenge if required.
2. Verify **Connections** strip shows API live ([USER_GUIDE.md](./USER_GUIDE.md)).
3. Spot-check **Audit** for `incident.*` / auth events after first actions.

## Related

- [ROLE_MAPPING_GUIDE.md](./ROLE_MAPPING_GUIDE.md)
- [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md)
