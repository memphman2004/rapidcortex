# Campus SSO via Cognito Hosted UI (INT-023 / UM-015)

Rapid Cortex does **not** implement a custom SAML stack on `/api/auth/signin`. Indiana University and similar campuses authenticate through **Amazon Cognito Hosted UI**, which federates to Shibboleth, Azure AD, or Duo.

## Browser path

1. User clicks **Sign in with campus SSO** on `/login`.
2. `GET /api/auth/hosted-ui/start?next=/app/campus/{code}` stores PKCE cookies (`rc_hu_verifier`, `rc_hu_state`, `rc_hu_next`) and redirects to Cognito `/oauth2/authorize`.
3. Cognito sends the user to the configured IdP. MFA is enforced **at the IdP**.
4. Cognito redirects to `{origin}/api/auth/hosted-ui/callback` with `code` + `state`.
5. The callback exchanges the code (PKCE S256, optional `COGNITO_CLIENT_SECRET`), sets Rapid Cortex httpOnly auth cookies, and sends the user to the allowlisted `next` path.

`next` must be a same-origin relative path (`/…`). Open redirects are rejected.

## Cognito app client

Add this exact callback (per environment) to **CognitoCallbackUrls**:

```
https://{web-host}/api/auth/hosted-ui/callback
```

Do **not** add a SAML / OIDC identity provider name to the app client until the IdP resource exists in the user pool. Optional env `NEXT_PUBLIC_COGNITO_SSO_IDP` / `COGNITO_SSO_IDP` skips the Cognito IdP picker when the provider is live.

## JIT campus / role claims

Post-confirmation and admin provisioning already write `custom:agencyId` and `custom:role`. Campus tokens must go through `normalizeSessionRole()` **before** PSAP legacy migration so `CAMPUS_*` is not collapsed to dispatcher.

Disable a user in Cognito (or Admin → Users) to revoke access. **SCIM (UM-016) stays Roadmap.**

## Feature flags

| Variable | Default | Notes |
|----------|---------|-------|
| `NEXT_PUBLIC_ENABLE_HOSTED_UI_SSO` | On when unset | Hide the SSO button with `0` |
| `NEXT_PUBLIC_COGNITO_DOMAIN` / `COGNITO_DOMAIN` | Required | Hosted UI host |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Required | Web app client |
| `COGNITO_CLIENT_SECRET` | Optional | Confidential clients only |
| `NEXT_PUBLIC_COGNITO_SSO_IDP` | Optional | Cognito IdP name, e.g. `IU-Shibboleth` |

## Related

- [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md) — password + TOTP on custom routes
- [CAMPUS_SECURITY_EVENTS.md](./CAMPUS_SECURITY_EVENTS.md) — signed inbound campus events
