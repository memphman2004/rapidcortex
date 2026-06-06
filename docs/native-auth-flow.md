# Native app auth — Cognito Hosted UI (Authorization Code + PKCE)

This document describes the **native desktop** sign-in flow alongside the existing **web** password/MFA login (`/login`, `/api/auth/signin`, cookies). Nothing in the web login path was removed.

## Part 1 — What already existed (audit snapshot)

| Area | Location / notes |
|------|-------------------|
| Web password login | `apps/web/app/api/auth/signin/route.ts`, `apps/web/app/[jurisdiction]/login/login-form.tsx` |
| Cognito config (server) | `apps/web/lib/auth/cognito-config.ts`, `apps/web/lib/auth/verify-cognito.ts`, `apps/web/lib/auth/cognito-refresh.ts` |
| CSRF on auth APIs | `apps/web/lib/csrf.ts` — `/api/auth/native/token` is **excluded** (non-browser clients) |
| Native token BFF | `apps/web/app/api/auth/native/token/route.ts` (POST code exchange, PATCH refresh), rate limit + audit JSON logs **without** tokens |
| PKCE helpers | `apps/web/lib/auth/pkce.ts` + `pkce.test.ts` |
| Native env | `apps/web/.env.example` — `NEXT_PUBLIC_COGNITO_*`, `NEXT_PUBLIC_NATIVE_*`, `COGNITO_TOKEN_ENDPOINT` |
| macOS desktop | `apps/desktop-macos/…` — SwiftUI, Keychain, `CognitoWebAuthCoordinator`, URL schemes `rapidcortex` / `rapidcortex-desktop` in `Info.plist` |
| Windows desktop | `apps/desktop-windows/…` — WPF, DPAPI token store, prior **loopback** PKCE in `CognitoPkceAuth.cs` |
| Cognito IaC | `infra/template.yaml` — `CognitoUserPool`, `CognitoUserPoolClient` (web), optional callback params |

## End-user flow (system browser + return page)

1. User opens the native app and taps **Login**.
2. If `WEB_APP_BASE_URL` is configured (e.g. `https://rapidcortex.us`), the app opens the **default browser** to  
   `{WEB_APP_BASE_URL}/auth/native-login?code_challenge=…&state=…&redirect_uri=https://{host}/auth/return-to-app`.
3. That route **302** redirects to the **branded** Next.js **`/login?native=1&…`** (same PKCE `code_challenge`, `state`, `redirect_uri`, and `client_id` for the native Cognito app client).
4. User enters **email + password** on Rapid Cortex (same as web `/login`). After cookies/session are established, the browser is sent to Cognito **`/oauth2/authorize`** with the same PKCE parameters and **`prompt=none`** first (silent SSO when a Cognito Hosted UI cookie already exists).
5. If Cognito returns **`error=login_required`** (or similar) to `/auth/return-to-app`, the return page automatically retries **authorize without `prompt=none`** so the user can complete Hosted UI **once** if needed, then still land on the HTTPS callback.
6. Cognito redirects to **`/auth/return-to-app?code=…&state=…`** (HTTPS callback must be registered on the **native** Cognito app client).
7. The page shows **Open Rapid Cortex** and attempts `window.location = rapidcortex://oauth/callback?code=…&state=…`.
8. The OS opens the app via the **custom URL scheme**; the app verifies **state**, then **POST**s `{ code, codeVerifier, redirectUri }` to **`/api/auth/native/token`** (same `redirect_uri` string as step 2: the HTTPS return URL).
9. The BFF exchanges the code at Cognito **`/oauth2/token`** (no client secret), returns tokens JSON; the app stores them in **Keychain** (macOS) or **DPAPI** (Windows).

**Direct custom-scheme mode (no web base):** if `WEB_APP_BASE_URL` is **not** set on macOS, the app uses **`ASWebAuthenticationSession`** with `redirect_uri = COGNITO_REDIRECT_URI` (e.g. `rapidcortex://oauth/callback`) and exchanges tokens **directly** with Cognito (legacy dev path).

## Cognito console / IaC requirements

### App clients

- **Web client** (existing): `USER_PASSWORD_AUTH`, refresh, optional OAuth for other flows; may use a **client secret** if you enable `CognitoGenerateSecret`.
- **Native client** (new in SAM: `CognitoNativeUserPoolClient`): **no secret**, OAuth **code** flow + PKCE, Hosted UI scopes `openid` `email` `profile`.

### Callback URLs (native client)

Minimum (custom schemes):

- `rapidcortex://oauth/callback`
- `rapidcortex-desktop://oauth/callback`
- `rapidcortex-ios://oauth/callback`
- `rapidcortex-windows://oauth/callback`

Add **HTTPS** return page when using the browser bridge:

- `https://<your-next-public-host>/auth/return-to-app`  
  (Must match `nativeOAuthReturnToAppUrl()` from `NEXT_PUBLIC_SITE_URL` + `/auth/return-to-app`.)

Override stack parameters:

- `CognitoNativeCallbackUrls` — comma-separated list including the HTTPS URL above.
- `CognitoNativeLogoutUrls` — comma-separated logout URIs, e.g. `rapidcortex://logout/callback`, …

### Logout URLs (native client)

- `rapidcortex://logout/callback` (and platform-specific variants if you use them in Cognito **logout_uri**).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SITE_URL` | Derives allowed `https://…/auth/return-to-app` for token exchange + authorize `redirect_uri` allowlist |
| `NEXT_PUBLIC_COGNITO_DOMAIN` | Cognito hosted UI domain (https prefix optional) |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | Web app client (password login, middleware) |
| `NEXT_PUBLIC_COGNITO_NATIVE_CLIENT_ID` | Optional; native Hosted UI + `/api/auth/native/token` (defaults to web client id if unset) |
| `COGNITO_NATIVE_CLIENT_ID` | Server-side mirror for token route |
| `COGNITO_TOKEN_ENDPOINT` | Usually `https://<domain>/oauth2/token` |
| `NEXT_PUBLIC_NATIVE_REDIRECT_URI` | Default `rapidcortex://oauth/callback` (documentation / native builders) |
| `NEXT_PUBLIC_NATIVE_LOGOUT_URI` | Default `rapidcortex://logout/callback` |

### macOS `Secrets.plist` (additional keys)

| Key | Example |
|-----|--------|
| `WEB_APP_BASE_URL` | `https://www.rapidcortex.us` — enables **system browser** + BFF token exchange |
| `COGNITO_LOGOUT_URI` | `rapidcortex://logout/callback` |
| `API_BASE_URL`, `COGNITO_DOMAIN`, `COGNITO_CLIENT_ID`, `COGNITO_REDIRECT_URI` | Unchanged; use **native** client id in `COGNITO_CLIENT_ID` when using the SAM native client |

### Windows `appsettings*.json`

Add under `RapidCortex`:

- `WebAppBaseUrl` — same as `WEB_APP_BASE_URL` above (optional until Windows bridge UI is wired in your branch).
- `Cognito:LogoutUri` — optional; defaults to `rapidcortex://logout/callback` when implemented.

## macOS URL schemes

`Info.plist` → `CFBundleURLSchemes`: `rapidcortex`, `rapidcortex-desktop`.

SwiftUI: `.onOpenURL` in `RapidCortexDesktopApp` forwards `rapidcortex://oauth/callback?…` to `CognitoWebAuthCoordinator.handleOAuthCallbackURL`.

## Windows URI protocol

For a packaged app, register the `rapidcortex` protocol (MSIX / installer). For local dev, register a **URL protocol** handler pointing at your built `.exe`, or rely on the **loopback** flow in `CognitoPkceAuth` until protocol registration is complete.

## Security notes

- **No tokens** in structured audit logs for native exchange (only success/failure, request id, user agent).
- **redirect_uri** allowlist enforced server-side on `/api/auth/native/token`.
- **PKCE** required for code exchange; **state** verified in the app before exchange.
- Native apps must **not** embed a Cognito **client secret**.

## Manual test checklist

1. Open Rapid Cortex native app.  
2. Click Login.  
3. Browser opens **`/auth/native-login`**, then the **branded `/login`** page.  
4. Log in with email + password (same as web).  
5. Browser continues OAuth → lands on `/auth/return-to-app` then opens `rapidcortex://…`.  
6. App receives deep link.  
7. App exchanges code via `/api/auth/native/token`.  
8. Dashboard loads.  
9. Close and reopen app — session restores (refresh if JWT expired).  
10. Logout clears storage and opens Cognito `/logout`.  
11. Web: open `/login`, password + MFA still works.

### Negative tests

- Wrong **state** → exchange must not run (app error).  
- **redirect_uri** not allowlisted → HTTP 400 from BFF.  
- **Expired / reused code** → safe 502 / user-facing error, no token logging.

## Mobile / tablet blocking (Hosted UI & BFF)

Rapid Cortex **does not permit operational login from mobile browsers** for the console experience. Middleware and `/api/auth/native/token` honor `DISABLE_MOBILE_AUTH` / `NEXT_PUBLIC_DISABLE_MOBILE_AUTH` and `BLOCK_TABLET_AUTH` (see `docs/security/auth-device-restrictions.md`). Desktop native apps exchanging codes at **`/api/auth/native/token`** use non-mobile user agents and are unaffected; browser-based Hosted UI flows on phones are redirected before Cognito starts.

## Test commands

From repo root:

```bash
npm exec vitest run apps/web/lib/auth/pkce.test.ts apps/web/lib/auth/nativeAuthConfig.test.ts apps/web/lib/auth/native-token-route.test.ts
```

Device / middleware regression tests:

```bash
npm exec vitest run apps/web/lib/device/__tests__/isMobileRequest.test.ts apps/web/lib/device/__tests__/mobile-path-guards.test.ts apps/web/lib/device/__tests__/middleware-mobile-auth.test.ts
```

SAM lint (after editing `infra/template.yaml`):

```bash
cd infra && sam validate --lint
```

## Risks / TODOs

- **Windows** full `rapidcortex://` single-instance + BFF path is scaffolded in docs; extend `CognitoPkceAuth` / `App.xaml.cs` when you ship protocol registration.  
- **Two Cognito clients**: ensure JWT **issuer**/`aud` matches what your API expects (same user pool, different `client_id` in `aud` is possible — verify API authorizer accepts both app client ids if needed).  
- **NEXT_PUBLIC_SITE_URL** must match the HTTPS callback host registered in Cognito.
