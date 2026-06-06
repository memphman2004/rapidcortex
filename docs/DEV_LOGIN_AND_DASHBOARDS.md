# Dev: sign in and reach role dashboards

The web app gates dashboards with `hasRapidCortexDashboardAccess` (see `packages/shared/src/auth/session-product.ts`). Besides `custom:role`, `custom:agencyId`, and `custom:status=active`, tenant users need **subscription / plan** claims on the ID token. Without them, middleware sends users to `/{jurisdiction}/no-access` after a successful Cognito password sign-in.

## 1. Deploy API + configure the web app

- Deploy the SAM stack (see `scripts/deploy.sh`).
- Point the Next app at the same Cognito user pool and web app client as the API authorizer, for example in `apps/web/.env.local`:
  - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`
  - `NEXT_PUBLIC_COGNITO_CLIENT_ID`
  - `NEXT_PUBLIC_COGNITO_REGION`
  - `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` (login URL is `https://…/{slug}/login`)
  - `NEXT_PUBLIC_AUTH_PROXY=1` and `API_UPSTREAM_BASE=https://…` if you use the BFF proxy pattern

## 2. Update the Cognito pool (new custom attributes)

CloudFormation adds `custom:planId` and `custom:subStatus` to the user pool. **Deploy** (or update) the stack so those attributes exist before seeding.

Existing pools: if the stack update does not add attributes (rare edge case), add them once in the Cognito console or rerun the seed helper’s `ensureRapidCortexCustomAttributes`, which uses `AddCustomAttributesCommand` for any missing keys.

## 3. Seed QA users (per role)

Requires AWS credentials for the account that owns the pool.

Set a **temporary password** meeting Cognito pool policy (12+ chars with upper, lower, number, symbol). You can export it for the shell session or add `RAPID_CORTEX_TEST_TEMP_PASSWORD=...` to `apps/web/.env.local` (never commit real values).

```bash
export AWS_REGION=us-east-1   # same region as the pool
export COGNITO_USER_POOL_ID=us-east-1_xxxx
# Optional: reuse pool id / region already in Next env
set -a && [ -f apps/web/.env.local ] && . ./apps/web/.env.local && set +a
export COGNITO_USER_POOL_ID="${COGNITO_USER_POOL_ID:-$NEXT_PUBLIC_COGNITO_USER_POOL_ID}"
export AWS_REGION="${AWS_REGION:-${NEXT_PUBLIC_COGNITO_REGION:-us-east-1}}"
export RAPID_CORTEX_TEST_TEMP_PASSWORD='YourTemp#Pass12'

npm run seed:role-test-users
```

The script creates or updates accounts (emails in `scripts/seed-role-test-users.ts`) and sets for **non–platform-superadmin** users:

- `custom:planId=essential`
- `custom:subStatus=active`

so ID tokens satisfy `hasActivePaidRelationship` and dashboard access.

Optional: `RESET_RAPID_CORTEX_TEST_PASSWORDS=true` to force a new temporary password.

## 4. First sign-in (MFA)

The pool uses **TOTP MFA**. After password sign-in, complete **MFA enrollment** in the web UI when prompted (same as production).

## 5. Where each role lands

| Test account (pattern)   | Role               | Default dashboard URL   |
|-------------------------|--------------------|-------------------------|
| superadmin@…            | platform_superadmin | `/superadmin/dashboard` |
| admin@…                 | admin              | `/agency-admin/dashboard` |
| dispatcher@…            | dispatcher        | `/dispatcher/dashboard` |
| supervisor@…           | supervisor        | `/supervisor/dashboard` |
| analyst@…               | analyst           | `/qa/dashboard` |
| itadmin@…               | it_admin          | `/it-security/dashboard` |
| staff@…                 | staff             | `/responder/dashboard` |
| auditor@…               | readonly_auditor  | `/executive/dashboard` |

Use your seeded email addresses and jurisdiction slug from the login page.
