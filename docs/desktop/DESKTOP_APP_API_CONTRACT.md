# Desktop app API contract (Phase 1)

This document describes how **native Rapid Cortex desktop clients** (macOS Swift, Windows WPF) are expected to talk to the **HTTP API** exposed behind **API Gateway**. It is **not** a guarantee of production readiness; Phase 1 covers shells, storage foundations, and manual smoke testing.

**Canonical web reference:** `apps/web/lib/api.ts` (route paths and response shapes). The browser may use `NEXT_PUBLIC_AUTH_PROXY=1` and cookies; **desktop apps do not** — they call the API Gateway base URL directly.

---

## 1. Base URL

- **Desktop:** use the **API Gateway stage URL** (or custom domain mapping to it) as `API_BASE_URL` / `ApiBaseUrl`.
- **Trailing slashes:** clients should normalize joins so `/api/...` resolves correctly whether or not the operator included a trailing slash.
- **No secrets in source:** per-environment values come from Xcode `Secrets.plist` (macOS), `appsettings.*.json` + optional `appsettings.Local.json` (Windows), and/or CI-injected environment variables — never committed production credentials.

---

## 2. Authentication flow (Cognito)

### 2.1 Target state

1. User launches **Cognito Hosted UI** (OAuth 2.0 authorization code + **PKCE** recommended for public/native clients).
2. User signs in; Cognito redirects to the app’s **custom URL scheme** registered on the app client (examples in-repo: macOS `com.rapidcortex.desktop://oauth`, Windows `rapidcortex-desktop://oauth`). Register **each** redirect URI you intend to ship; Hosted UI rejects unknown redirect URLs.
3. Client exchanges `code` + `code_verifier` at `https://<cognito-domain>/oauth2/token`.
4. Client stores **tokens securely** (macOS Keychain; Windows DPAPI-protected store or Credential Manager — see below).
5. Client calls APIs with **`Authorization: Bearer <id_token>`** (or the token type your API Gateway JWT authorizer is configured to validate — keep this aligned with `infra` / authorizer settings).

### 2.2 Phase 1 status

- **macOS:** `ASWebAuthenticationSession` opens Hosted UI with PKCE; the app **exchanges** the authorization `code` at `/oauth2/token` and stores **`id_token`** (and **`refresh_token`** when present) in Keychain. **Refresh-token rotation** is a follow-up. A **Debug-only** UI can still paste an `id_token` for smoke tests.
- **Windows:** opens the **system browser** with the authorize URL; a local **HttpListener** on `http://127.0.0.1:<port>/…` receives the redirect, then the app **exchanges** the `code` at `/oauth2/token` and stores **`id_token`** / **`refresh_token`** in a **DPAPI**-backed session file. Register the same loopback **Callback URL** in Cognito as in `appsettings` (default `http://127.0.0.1:8765/callback`). **Debug** builds may still paste an `id_token` for smoke tests; **Release** hides that panel.

---

## 3. Token storage

| Platform | Phase 1 mechanism | Notes |
| --- | --- | --- |
| macOS | Keychain (`KeychainTokenStore`) | Stores `id_token` (and reserved hooks for refresh token). Review keychain ACL / access groups for your org. |
| Windows | `ProtectedData` (CurrentUser) in `%LocalAppData%\RapidCortexDesktop\` | Convenience for Phase 1; migrate to Credential Manager or Windows broker if required. |

**Never** persist tokens in plain `UserDefaults`, loose JSON on disk without encryption, or logs.

---

## 4. Required HTTP headers

For **authenticated** routes:

- `Authorization: Bearer <id_token>` (trim whitespace; no `Basic` prefix).

For JSON bodies (future writes):

- `Content-Type: application/json`
- `Accept: application/json`

The web client may attach cookies when using the auth proxy; **desktop does not**.

---

## 5. Tenant / agency handling

The API derives user context from the JWT (see `apps/api/src/lib/auth.ts` and related helpers). Expect standard Cognito claims plus custom attributes such as:

- `custom:agencyId` — tenant/agency scope for most dispatcher/admin operations.
- Some **`platform_superadmin`** flows may pass explicit `agencyId` query parameters where the web app does the same.

**Desktop guidance:** do not invent agency identifiers client-side; rely on token claims and existing query patterns mirrored from `apps/web/lib/api.ts`.

---

## 6. Role handling

Roles are enforced server-side. Common values appear in shared types (`packages/shared`, security helpers). **Admin desktop download** APIs allow `admin`, `it_admin`, and `platform_superadmin` (see `docs/DESKTOP_DOWNLOAD_FLOW.md`).

Desktop Phase 1 does not implement local RBAC beyond what the API returns (401/403). Future phases can cache a read model of entitlements for UX gating.

---

## 7. Supported endpoints (Phase 1 smoke tests)

These are intentionally small and align with the scaffold UIs:

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Usually **none** | Connectivity / API ping. |
| `GET` | `/api/incidents` | **Bearer required** | Web shape: `{ items: Incident[] }` — desktop mapping is **Phase 2**. |

Additional routes should be ported **from** `apps/web/lib/api.ts` path-by-path as features are implemented.

---

## 8. Admin download infrastructure (separate concern)

Presigned macOS artifact download is exposed to privileged web admins (`GET /api/admin/desktop-releases`, `POST /api/admin/desktop-releases/signed-url`). **Native apps are distributed through that channel**; this document focuses on **runtime API** usage after installation.

---

## 9. Future realtime / WebSocket plan

- **Today:** incident refresh in the web app is primarily **HTTP-driven** (polling/refetch); no stable public WebSocket contract was promoted for desktop parity at Phase 1.
- **Future:** if the API adds a first-class realtime channel (WebSocket or SSE), document:
  - URL / stage,
  - subprotocol or message framing,
  - authentication (likely `Sec-WebSocket-Protocol` bearer, query token, or short-lived signed URL — **TBD**),
  - reconnect + backoff expectations.

Desktop clients should prefer **one shared contract** (OpenAPI or shared package) before implementing realtime.

---

## 10. Phase boundaries (explicit)

Phase 1 includes: **app shell**, **login/OAuth foundation**, **API client foundation**, **secure token storage foundation**, and **documentation**. It **excludes**: production hardening, signed installers, auto-update, full OAuth token refresh, incident model binding, and org-specific compliance sign-off.
