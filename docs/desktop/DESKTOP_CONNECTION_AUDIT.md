# Desktop connection audit (Option B: native macOS + native Windows)

**Audit date:** 2026-04-25  
**Repository:** Rapid Cortex monorepo (`apps/web`, `apps/api`, `packages/*`, `infra/`)

## Executive summary

| Client | Connected end-to-end? | Rationale |
| --- | --- | --- |
| **A. macOS (Swift)** | **PARTIAL (Phase 1 scaffold)** | An Xcode **SwiftUI** project now exists under `apps/desktop-macos/`. It can ping `/api/health`, call `/api/incidents` when an `id_token` is present, and store tokens in **Keychain**. **Cognito Hosted UI token exchange is not implemented** — end-to-end Hosted UI login is still incomplete. |
| **B. Windows (.NET WPF)** | **PARTIAL (Phase 1 scaffold)** | A **.NET 8 WPF** solution exists under `apps/desktop-windows/`. It mirrors the macOS shell (config, DPAPI token file, HTTP client, connectivity indicator). **WPF must be built on Windows**; Cognito token exchange is also **not implemented** yet. |

**C. Minimum safe fixes applied in-repo (this pass):**

- Authenticated **admin API**: `GET /api/admin/desktop-releases` (metadata, no URLs) + `POST /api/admin/desktop-releases/signed-url` (presigned S3 GET, audited).
- **Admin UI:** **Settings** → **Downloads** → **Desktop Apps** (`/admin/settings/downloads`), plus admin nav tab **Downloads** and a link from the Environment (Settings) page.
- **Shared contract types:** `DesktopReleasesOverviewResponse`, `DesktopSignedUrlResponse`, etc. in `packages/shared/src/desktop-releases.ts`.
- **SAM:** `GetDesktopMacosReleaseFunction` + Globals for `DESKTOP_*` env vars.
- **Documentation:** this file and `docs/DESKTOP_DISTRIBUTION_OPTION_1.md`.

Native apps now live in **`apps/desktop-macos/`** and **`apps/desktop-windows/`** (Phase 1) and should reuse the same contracts as `apps/web/lib/api.ts` (Bearer `Authorization: Bearer <idToken>`, paths under `/api/...`). The browser-only Next BFF at `/api/backend/...` applies when `NEXT_PUBLIC_AUTH_PROXY=1` — **desktop must not depend on that proxy.**

---

## 1. macOS Swift app — findings

### Located project/workspace

- **Result:** **Found (Phase 1).** `apps/desktop-macos/RapidCortexDesktop/RapidCortexDesktop.xcodeproj`
- **Open:** `cd apps/desktop-macos && open RapidCortexDesktop/RapidCortexDesktop.xcodeproj`
- **Build (CLI):** `xcodebuild -project RapidCortexDesktop/RapidCortexDesktop.xcodeproj -scheme RapidCortexDesktop -configuration Debug -destination 'platform=macOS' build`

### API base URL

- **Web reference:** `apps/web/lib/api.ts` — `NEXT_PUBLIC_API_BASE` **or** `NEXT_PUBLIC_AUTH_PROXY=1` → `/api/backend` (cookie + server proxy).
- **Desktop implication:** native apps should call the **API Gateway base URL** directly with **Cognito ID token** in `Authorization: Bearer …` (same as upstream Lambdas expect). Do **not** embed production URLs in source; use build-time xcconfig / Info.plist per environment.

### Authentication (Cognito)

- **Web:** `apps/web` uses hosted auth routes and/or Amplify-style flows (see `app/api/auth/*`, session cookies when proxying).
- **Desktop (Phase 1):** `CognitoWebAuthCoordinator` opens **Hosted UI** via `ASWebAuthenticationSession` with **PKCE** (authorize step). **`/oauth2/token` exchange and refresh are not wired** — see `docs/DESKTOP_APP_API_CONTRACT.md`.

### Login/session persistence

- **Phase 1:** `KeychainTokenStore` persists `id_token`. **Debug-only** UI can paste a token for API smoke tests until OAuth exchange exists.

### Dashboard data from APIs

- **Web:** `fetchIncidents`, `fetchIncident`, etc. in `apps/web/lib/api.ts`.
- **Desktop (Phase 1):** raw `GET /api/incidents` preview string only — **no typed models** yet.

### WebSocket / live incident updates

- **Web:** No dedicated `wss://` incident channel was found in components; supervisor copy mentions WebSocket as future (`supervisor-workspace.tsx`). Dispatch refresh appears HTTP-driven.
- **Desktop gap:** align with **actual** web behavior (polling/HTTP refetch) unless/until a shared WebSocket API is added to the backend.

### Environment switching (dev/stage/prod)

- **Phase 1:** Xcode build configurations **Debug** (`RC_ENVIRONMENT=development`), **Staging** (`staging`), **Release** (`production`) + optional `Secrets.plist` + scheme env `RC_ENVIRONMENT` overrides.

### Secure token storage (Keychain)

- **Phase 1:** implemented (`KeychainTokenStore`).

### Hardcoded production secrets

- **Repo scan:** example plist / appsettings contain **placeholders only**. **Do not** commit real `Secrets.plist` or `appsettings.Local.json`.

---

## 2. Windows .NET app — findings

- **Solution:** `apps/desktop-windows/RapidCortexDesktop.sln`
- **Project:** `apps/desktop-windows/src/RapidCortexDesktop.Wpf/RapidCortexDesktop.Wpf.csproj` (**net8.0-windows**, **WPF**)
- **Run:** `dotnet run --project src/RapidCortexDesktop.Wpf/RapidCortexDesktop.Wpf.csproj` **on Windows** (WPF does not build on macOS/Linux hosts).
- **Token storage (Phase 1):** `ProtectedData` (CurrentUser) via `ProtectedTokenStore` — see `docs/DESKTOP_APP_API_CONTRACT.md` for migration notes.

---

## 3. Shared backend contract

| Topic | Status |
| --- | --- |
| Same routes as web | **Web is canonical.** Use `apps/web/lib/api.ts` path strings as the checklist. |
| JWT / Cognito headers | API handlers use `getUserContext` from JWT authorizer (`apps/api/src/lib/auth.ts`). Desktop: **`Authorization: Bearer <id_token>`** (or access token if your API authorizer is configured for it — match API Gateway JWT authorizer config). |
| Tenant / agency | Claims `custom:agencyId`, `custom:role` on token; some routes require `agencyId` query for `platform_superadmin`. |
| Roles | `packages/shared/src/types.ts` + `packages/security/src/index.ts` — `isAdminRole` covers `admin` and `platform_superadmin`. Desktop admin downloads also accept **`it_admin`** at the API boundary — align client UX with the same role matrix as the web admin portal. |

**New endpoint (this audit):**

- `GET /api/admin/desktop-releases` / `POST /api/admin/desktop-releases/signed-url` — **`admin`**, **`it_admin`**, **`platform_superadmin`** only.

---

## 4. Realtime / live operations

- **Backend:** No first-class public WebSocket contract was identified for incident streaming in this pass.
- **Desktop:** Implement refresh using the same strategy as web (HTTP), or add a dedicated realtime channel in the API later.

---

## 5. Build + release readiness

| Item | Status |
| --- | --- |
| macOS `.dmg` / Xcode | **Scaffold in repo** — Xcode project under `apps/desktop-macos/`. Packaging remains **Phase 2+** — see `DESKTOP_DISTRIBUTION_OPTION_1.md`. |
| Windows `.exe` / `.msi` | **Scaffold in repo** — `dotnet publish` produces binaries; **signed installers are Phase 2+**. |
| Versioning / updater | **Not in repo.** Sparkle / WinSparkle / custom — TBD. |
| Package names `RapidCortex.dmg` / `RapidCortexSetup.exe` | **Configurable** via `DESKTOP_MACOS_ARTIFACT_NAME` (default `RapidCortex-1.0.0.dmg` to match Option 1 naming). |
| Admin portal downloads | **Implemented** — Admin → **Downloads** → macOS section. |

---

## 6. Security / compliance

| Topic | Notes |
| --- | --- |
| HTTPS / WSS | Presigned URLs are **HTTPS** S3. API must remain **HTTPS** only in production. |
| Local data | Native apps should minimize cache; encrypt any offline store if added. |
| Logs / PII | Do not log tokens, transcripts, or PII from desktop clients; align with CJIS logging expectations in `packages/security` docs. |
| Crash / telemetry | If added, scrub tokens and incident payloads from reports. |

---

## C. Phase 1 desktop paths (in-repo)

| Area | Path |
| --- | --- |
| macOS app + Xcode project | `apps/desktop-macos/RapidCortexDesktop/` |
| Windows WPF solution | `apps/desktop-windows/` |
| Shared desktop HTTP/auth notes | `docs/DESKTOP_APP_API_CONTRACT.md` |

**Still missing before “production connected” desktop:**

1. Cognito **`/oauth2/token`** exchange, refresh rotation, and session errors surfaced in-product.
2. Typed API client / models (or generated OpenAPI client — spec not in repo today).
3. Windows **presigned** download handler parity for `.exe` (if/when artifacts land in S3).
4. Realtime strategy parity (HTTP vs future WebSocket).

---

## Fixes completed (this change set)

| Area | Files |
| --- | --- |
| API | `apps/api/src/handlers/admin/getDesktopMacosRelease.ts`, `apps/api/src/services/desktopReleaseService.ts`, `apps/api/src/lib/env.ts` |
| SAM | `infra/template.yaml` (`GetDesktopMacosReleaseFunction`, Globals `DESKTOP_*`) |
| Shared types | `packages/shared/src/desktop-releases.ts`, `packages/shared/src/index.ts` |
| Web | `apps/web/lib/api.ts`, `apps/web/app/.../admin/layout.tsx`, `apps/web/app/.../admin/settings/page.tsx`, `apps/web/app/.../admin/settings/downloads/page.tsx` |
| Tests | `apps/api/src/handlers/admin/getDesktopMacosRelease.handler.integration.test.ts` |
| macOS desktop (Phase 1) | `apps/desktop-macos/**` (SwiftUI, Xcode project, Keychain store, `ApiClient`, Hosted UI **authorize** stub) |
| Windows desktop (Phase 1) | `apps/desktop-windows/**` (WPF, DPAPI token file, `HttpClient` wrapper, Hosted UI **browser** stub) |
| Docs | `docs/DESKTOP_APP_API_CONTRACT.md`, updates in this audit file |

---

## Test commands

```bash
cd "/path/to/Rapid Cortex"
npm run build -w rapid-cortex-shared
rsync -a --delete packages/shared/dist/ apps/api/node_modules/rapid-cortex-shared/dist/
npx vitest run apps/api/src/handlers/admin/getDesktopMacosRelease.handler.integration.test.ts
npm run build -w rapid-cortex-api
npm run build -w rapid-cortex-web
```

```bash
cd infra && sam validate
```

---

## Build commands (native scaffolds)

**macOS:** open `apps/desktop-macos/RapidCortexDesktop/RapidCortexDesktop.xcodeproj` in Xcode, or use `xcodebuild` as above. Release packaging remains **Phase 2+** — see `docs/DESKTOP_DISTRIBUTION_OPTION_1.md` (Developer ID, `notarytool`, DMG).

**Windows (on a Windows machine):** `dotnet publish apps/desktop-windows/src/RapidCortexDesktop.Wpf/RapidCortexDesktop.Wpf.csproj -c Release`; sign installers with your org’s code-signing cert when you reach that milestone.

---

## Remaining work (priority)

1. Implement Cognito **`/oauth2/token`** + refresh for both desktops; remove reliance on pasted `id_token` smoke tests.
2. Port critical `apps/web/lib/api.ts` calls into shared thin clients; add contract tests against **staging**.
3. Decide realtime strategy; if WebSocket is added to API, document URL and auth in `DESKTOP_APP_API_CONTRACT.md`.
4. Wire **Windows** presigned download (mirror macOS handler) when `RapidCortexSetup.exe` is published to S3.
5. CI agents: build WPF on **windows-latest**; build macOS on **macos-latest** with Xcode pinned to your org’s version.

---

## D. What is connected vs placeholder (Phase 1)

| Item | macOS | Windows |
| --- | --- | --- |
| API base URL from config | Yes (`Secrets.plist` + env) | Yes (`appsettings.*.json` + env) |
| `GET /api/health` | Yes | Yes |
| `GET /api/incidents` with Bearer | Yes (raw body) | Yes (raw body) |
| Typed `Incident` models | **No** | **No** |
| Hosted UI **authorize** | Yes (`ASWebAuthenticationSession`) | Yes (default browser) |
| OAuth **token exchange** | **No** | **No** |
| Secure token storage | Keychain | DPAPI file |
| Online/offline indicator | `NWPathMonitor` | `NetworkChange` + timer |
| Production signing / installers | **No** | **No** |
