# Cognito account provisioning model (AWS)

Rapid Cortex uses an **admin-controlled** onboarding model by default:

- Rapid Cortex platform staff creates the municipality tenant and first admin account.
- Municipality admins create additional users for their own agency.
- Public self-service sign-up is disabled in both Cognito and web UI by default.

## What the SAM template does

| Setting | Purpose |
|---------|---------|
| **`AdminCreateUserConfig.AllowAdminCreateUserOnly: true`** | Enforces **admin-created accounts** at the user-pool level. |
| **Password policy** | Minimum **12** characters with upper, lower, number, and symbol — mirrored in `apps/web/lib/auth/cognito-password-policy.ts` and the sign-up / new-password API routes. |
| **`CognitoPostConfirmationFunction`** | PostConfirmation trigger remains for compatibility with controlled internal self-signup tests. |
| **`CognitoPostConfirmationInvokePermission`** | Allows `cognito-idp.amazonaws.com` to invoke the Lambda for this user pool. |
| **App client** (`GenerateSecret: false`, `ALLOW_USER_PASSWORD_AUTH`) | Matches the cookie sign-in flow and admin-provisioned user login in `/{slug}/login`. |
| **MFA (TOTP)** | User pool **`MfaConfiguration: ON`** with **`SOFTWARE_TOKEN_MFA`** — every user must enroll an authenticator app on first successful password authentication. The web app completes **`MFA_SETUP`** via **`/api/auth/mfa/associate`** and **`/api/auth/mfa/complete-setup`**, and **`/api/auth/mfa/verify-login`** on subsequent sign-ins. |

If you use a **confidential app client** (`COGNITO_CLIENT_SECRET`), the same secret is required for refresh-token exchange: the server derives **`SECRET_HASH`** from the username in the (possibly expired) ID token cookie.

**Existing pools:** turning MFA on requires every account to complete **MFA_SETUP** (or already have TOTP) before Cognito returns tokens. Plan a short communication window before changing production.

## Stack parameters (testing compatibility)

| Parameter | Default | Notes |
|-----------|---------|--------|
| **`SelfSignupDefaultAgencyId`** | `self-signup-pending` | Used only for controlled self-signup testing paths. Not part of normal production onboarding. |
| **`SelfSignupDefaultRole`** | `dispatcher` | Used only for controlled self-signup testing paths. |

Override at deploy time only if you intentionally run self-signup testing:

```bash
sam deploy --parameter-overrides DeploymentStage=prod SelfSignupDefaultAgencyId=your-agency-id
```

Normal production onboarding should rely on admin-created users with explicit `custom:agencyId` and `custom:role`.

## Build and deploy prerequisites

1. **Install trigger dependencies** (required before `sam build`):

   ```bash
   npm install --prefix infra/cognito-post-confirmation
   ```

   `./scripts/deploy.sh` runs this automatically before `sam build`.

2. **Web environment** — set `NEXT_PUBLIC_COGNITO_*` to the same pool and app client as the stack outputs (`UserPoolId`, `UserPoolClientId`, region). The stack also exports **`SelfSignupDefaultAgencyIdValue`** (the effective placeholder agency id). See **`docs/INSTALLATION.md`**.

3. **Optional `COGNITO_CLIENT_SECRET`** — only if the app client has a secret.

## Email delivery

By default Cognito sends verification email from **Cognito** (limited for production scale). For production volumes and branding, configure **Amazon SES** in the Cognito console (or add `EmailConfiguration` to the template) so the user pool sends mail through your verified domain.

## Operational checklist (production)

- [ ] Keep Cognito pool in admin-create mode (`AllowAdminCreateUserOnly: true`).
- [ ] Keep web flags set to disable public signup:
  - `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=0`
  - `ENABLE_PUBLIC_SIGNUP=false`
- [ ] Rapid Cortex platform staff creates first municipality admin with explicit:
  - `custom:agencyId=<tenant-agency-id>`
  - `custom:role=admin` (or `platform_superadmin` for Rapid Cortex internal staff only)
- [ ] Municipality admins create additional users in-app (agency-scoped RBAC enforced).

### Controlled internal self-signup testing (optional)

If you explicitly need to test self-signup flows in a non-production environment:

- enable web flags:
  - `NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP=1`
  - `ENABLE_PUBLIC_SIGNUP=true`
- ensure a safe placeholder agency strategy (for example `self-signup-pending`) and corresponding agency record exists.

## Related code

- `infra/template.yaml` — `CognitoUserPool`, `CognitoPostConfirmationFunction`, parameters.
- `infra/cognito-post-confirmation/handler.mjs` — trigger implementation.
- `apps/web/app/api/auth/signup/route.ts` — `SignUpCommand`.
- `apps/web/app/api/auth/confirm-signup/route.ts` — `ConfirmSignUpCommand`.
