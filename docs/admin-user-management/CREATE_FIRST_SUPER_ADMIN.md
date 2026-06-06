# Create the first platform super admin

This repository expects the Cognito attribute **`custom:role=platform_superadmin`** (the literal `superadmin` is **not** a valid product role; it would be treated as an unknown role and downgraded in auth layers). The platform tenant id is **`__platform__`** (see `packages/shared/src/tenancy/constants.ts`), set as **`custom:agencyId`**.

Use the secure script at `scripts/create-superadmin.ts` to create or update the first platform operator. It **never** logs passwords.

## Prerequisites

- AWS credentials with `cognito-idp:AdminCreateUser`, `AdminUpdateUserAttributes`, `AdminSetUserPassword`, `AdminAddUserToGroup`, `AdminGetUser`, `AdminListGroupsForUser` on the target user pool.
- `COGNITO_USER_POOL_ID` (from your stack, e.g. `aws cloudformation describe-stacks` or `scripts/print-stack-outputs-for-web.sh`).
- **New in template:** `custom:status` is defined on the user pool. Deploy the updated `infra/template.yaml` (or add the attribute manually in Cognito) so `custom:status=active` can be stored.
- **MFA:** The default user pool in `infra/template.yaml` enables TOTP software MFA. After the first password change, the user must complete MFA enrollment on sign-in. Plan credentials accordingly.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `AWS_REGION` | Yes | e.g. `us-east-1` |
| `COGNITO_USER_POOL_ID` | Yes | User pool id |
| `RAPID_CORTEX_SUPERADMIN_TEMP_PASSWORD` | Yes when creating, or when `RESET_SUPERADMIN_PASSWORD=true` | Temporary password; **12+** chars, upper, lower, number, **symbol** (matches pool policy). **Do not commit.** |
| `RAPID_CORTEX_SUPERADMIN_EMAIL` | No | Default: `Support@appsondemand.net` |
| `RAPID_CORTEX_SUPERADMIN_STATUS` | No | Default: `active` (stored in `custom:status`) |
| `RESET_SUPERADMIN_PASSWORD` | No | Set to `true` to set a new temporary password on an **existing** user (uses the same temp password env var) |

## Commands (local or CI)

```bash
cd /path/to/rapid-cortex
npm install

export AWS_REGION=us-east-1
export COGNITO_USER_POOL_ID='us-east-1_XXXXX'
export RAPID_CORTEX_SUPERADMIN_TEMP_PASSWORD='<temporary_password_meets_pool_policy>'

npm run seed:superadmin
```

## Web app behavior (verification)

- JWT claims `custom:role=platform_superadmin` are recognized in `apps/web/lib/auth/verify-cognito.ts` and `apps/web/lib/auth/roles.ts`.
- `hasSubscriberManualAccess` allows platform super admins without a paid subscription flag (`apps/web/lib/auth/subscriber-access.ts`).
- After login, with no `from=` query, **`platform_superadmin` users are redirected to** `/[jurisdiction]/admin/platform/dashboard` (`login-form.tsx`). Other roles default to the dispatcher dashboard.

## Safety behavior

- If the user **already exists**, attributes are **updated** to match. The password is **not** changed unless `RESET_SUPERADMIN_PASSWORD=true`.
- The user is added to the Cognito group **`platform_superadmin`** (defined in `infra/template.yaml`) if missing.
- Passwords are **never** written to logs.

## Re-run after user exists

To refresh attributes only:

```bash
npm run seed:superadmin
```

To force a new temporary password (user will change on next sign-in):

```bash
export RESET_SUPERADMIN_PASSWORD=true
export RAPID_CORTEX_SUPERADMIN_TEMP_PASSWORD='<new_temporary_password>'
npm run seed:superadmin
```
