# Seed role-based test accounts

Creates or updates **five** Cognito users for QA of dispatch, supervisor, admin, platform, and staff flows. Passwords are **never** logged or committed.

## Product vs marketing names

- The **platform** operator role in Cognito is **`custom:role=platform_superadmin`**, not the string `superadmin`. The test email is `superadmin@…` for convenience.
- The **platform** tenant id is **`custom:agencyId=__platform__`** (see `packages/shared`), not the literal `platform`.

## Prerequisites

- The pool should define **`custom:role`**, **`custom:agencyId`**, and **`custom:status`** (see `infra/template.yaml`). If your pool is older and lacks them, the seed script will attempt **`AddCustomAttributes`** (requires `cognito-idp:AddCustomAttributes` on the pool) before creating users.
- Same password policy as other seed scripts (12+ chars, upper, lower, number, symbol).
- MFA on the pool: first sign-in uses the temp password, then **password change** and **TOTP enrollment** as required by Cognito.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `AWS_REGION` | Yes | e.g. `us-east-1` |
| `COGNITO_USER_POOL_ID` | Yes | User pool id |
| `RAPID_CORTEX_TEST_TEMP_PASSWORD` | Yes | Shared temporary password for **new** users, or when reset is enabled |
| `RESET_RAPID_CORTEX_TEST_PASSWORDS` | No | Set to `true` to apply a new temporary password to **existing** users |

## Commands

```bash
export AWS_REGION=us-east-1
export COGNITO_USER_POOL_ID='<your_pool_id>'
export RAPID_CORTEX_TEST_TEMP_PASSWORD='<temporary-password>'

npm run seed:role-test-users
```

## Accounts

| Email | `custom:role` | `custom:agencyId` | Default post-login route* |
| --- | --- | --- | --- |
| `superadmin@appsondemand.net` | `platform_superadmin` | `__platform__` | `/[jurisdiction]/superadmin` |
| `admin@appsondemand.net` | `admin` | `test-agency` | `/[jurisdiction]/admin` |
| `supervisor@appsondemand.net` | `supervisor` | `test-agency` | `/[jurisdiction]/supervisor` |
| `dispatcher@appsondemand.net` | `dispatcher` | `test-agency` | `/[jurisdiction]/dispatcher` |
| `staff@appsondemand.net` | `staff` | `test-agency` | `/[jurisdiction]/staff` |

\*Jurisdiction slug is your deploy’s `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` (default `example-city`).

## UI

Each route shows a **“Dashboard connected successfully”** strip with email, role, agency, and status (when present in the ID token). Deeper features remain on existing sub-routes (e.g. `/supervisor/qa`).

## Related

- [CREATE_FIRST_SUPER_ADMIN.md](./CREATE_FIRST_SUPER_ADMIN.md) — first platform operator (single account)
