# Rapid Cortex Desktop (macOS)

SwiftUI app with **Cognito Hosted UI** (PKCE), **`/oauth2/token` exchange**, **Keychain** storage for `id_token` / `refresh_token`, and API calls with `Authorization: Bearer <id_token>`.

**Release builds** hide the debug “paste id_token” panel. **Phase 2+:** refresh-token rotation, typed models, signed distribution (see `docs/DESKTOP_DISTRIBUTION_OPTION_1.md`).

## Open in Xcode

```bash
cd apps/desktop-macos
open RapidCortexDesktop/RapidCortexDesktop.xcodeproj
```

Select the **RapidCortexDesktop** scheme, pick **My Mac**, then **Run** (⌘R).

## Configuration (`Secrets.plist`)

1. Copy `RapidCortexDesktop/Config/Secrets.example.plist` to `RapidCortexDesktop/RapidCortexDesktop/Secrets.plist` (same folder as `Info.plist`; **gitignored**).
2. In Xcode: **File → Add Files…** pick `Secrets.plist`, then in **Build Phases → Copy Bundle Resources** ensure **RapidCortexDesktop** is checked so `Bundle.main` loads it.
3. Fill keys (see `Secrets.example.plist`):

| Key | Example |
|-----|--------|
| `API_BASE_URL` | `https://xxxx.execute-api.us-east-1.amazonaws.com` (no trailing slash required) |
| `COGNITO_REGION` | `us-east-1` |
| `COGNITO_DOMAIN` | `your-prefix.auth.us-east-1.amazoncognito.com` (you may paste `https://…`; the app strips the scheme) |
| `COGNITO_CLIENT_ID` | App client ID (public client, no secret on device) |
| `COGNITO_REDIRECT_URI` | Must match **exactly** the native app client’s **Allowed callback URLs** in Cognito. For stacks using the default `CognitoNativeCallbackUrls`, use **`rapidcortex-desktop://oauth/callback`** (see `infra/template.yaml`). Using a scheme not listed in `Info.plist` `CFBundleURLSchemes` (e.g. `com.rapidcortex.desktop://…` without registering it) causes `redirect_mismatch` or a broken return to the app. |
| `WEB_APP_BASE_URL` | Next.js origin (e.g. `https://rapidcortex.us` or `https://www.rapidcortex.us`). When set, sign-in uses the **system browser** + `/auth/native-login` (→ branded `/login`) + `/auth/return-to-app` + BFF `/api/auth/native/token`. When omitted, the app uses **embedded** `ASWebAuthenticationSession` + direct Cognito token exchange (dev / fallback). |
| `COGNITO_LOGOUT_URI` | Optional; default **`rapidcortex-desktop://logout/callback`** for Cognito `/logout` (must match Cognito **Allowed sign-out URLs**). |
| `ENABLE_NATIVE_MAPKIT` | `1` or `true` — **native Apple Maps** hospital routing (toolbar **Hospital map** + **Maps** tab). Requires API `ENABLE_HOSPITAL_ROUTING` and hospital capacity data. Uses system MapKit (no MapKit JS JWT). |

4. **Cognito app client (console):** add the same **Callback URL** as `COGNITO_REDIRECT_URI` on the **native** (PKCE, no secret) client, matching `CognitoNativeCallbackUrls` from deploy (defaults include `rapidcortex-desktop://oauth/callback`). For the browser bridge, also register `https://{your-web-host}/auth/return-to-app` on that native client (see `docs/native-auth-flow.md`).
5. Build configuration: **Debug** / **Staging** / **Release** sets `RC_ENVIRONMENT` in `Info.plist`, or override with scheme environment variables (`API_BASE_URL`, …).

6. **Reload configuration** in the app after editing `Secrets.plist`, then **Sign in with Cognito**.

## Sign-in flow

**With `WEB_APP_BASE_URL` set (recommended):**

1. User taps **Sign in with Cognito (Hosted UI)** → **default browser** opens `{WEB_APP_BASE_URL}/auth/native-login?…` → **302** to **`/login?native=1&…`** (branded email/password).
2. After successful sign-in, the browser continues **Cognito `/oauth2/authorize`** (PKCE **S256**, `prompt=none` when possible) → redirect to **`/auth/return-to-app`** → page opens **`rapidcortex://oauth/callback?code=…&state=…`**.
3. App receives the deep link → **POST** `{ code, codeVerifier, redirectUri }` to `{WEB_APP_BASE_URL}/api/auth/native/token` → tokens stored in **Keychain** → **Dashboard**.

**Without `WEB_APP_BASE_URL`:** embedded `ASWebAuthenticationSession` + direct `https://<cognito-domain>/oauth2/token` exchange (same PKCE), callback `COGNITO_REDIRECT_URI`.

## Debugging

- **Console.app**: filter subsystem `com.rapidcortex.desktop`, categories `auth` and `session`.
- Common issues: **`redirect_mismatch`** (redirect URI not listed on the Cognito native client, or typo vs `Secrets.plist`), API base URL wrong, `invalid_grant` (wrong `code_verifier` or redirect URI), expired code.

## Ship a `.dmg` to downloads hosting

From the repo root:

```bash
./scripts/package-macos-dmg.sh              # → dist/RapidCortex.dmg (local archive signing only)
./scripts/publish-macos-dmg.sh prod 1.0.0   # package + S3 + latest.json
```

### Manual DMG from an Xcode-exported `.app`

If you already exported **`RapidCortexDesktop.app`** (e.g. to the Desktop), build a compressed DMG and upload **`latest`** + **`latest.json`** from the repo root:

```bash
# Adjust -srcfolder / output .dmg path and version as needed.
hdiutil create -volname "Rapid Cortex" \
  -srcfolder ~/Desktop/RapidCortexDesktop.app \
  -ov -format UDZO \
  ~/Desktop/RapidCortex-1.0.1.dmg

./scripts/upload-desktop-downloads.sh prod mac ~/Desktop/RapidCortex-1.0.1.dmg 1.0.1
```

Requires **`jq`**, AWS CLI, and the **`rapid-cortex-downloads-<env>`** stack (see `docs/desktop-downloads.md`). For production channels, prefer **Developer ID + notarization** first (`macos-distribution-build.sh`); Gatekeeper will treat an unsigned or un-notarized DMG harshly on end-user Macs.

### Developer ID + notarization (outside Mac App Store)

Use **`scripts/macos-distribution-build.sh`** (or **`publish-macos-dmg.sh`** when `APPLE_DEVELOPER_ID`, `APPLE_TEAM_ID`, `APPLE_ID`, and `APPLE_APP_PASSWORD` are set). The script archives with **Developer ID Application**, re-signs the bundle with **`codesign`** (hardened runtime + entitlements), builds a **UDZO** `.dmg`, runs **`notarytool submit --wait`**, then **`stapler staple`**.

Required environment:

| Variable | Purpose |
|----------|--------|
| `APPLE_DEVELOPER_ID` | Full **codesign** identity string, e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_TEAM_ID` | 10-char Team ID (`DEVELOPMENT_TEAM` + `notarytool --team-id`) |
| `APPLE_ID` | Apple ID email for **notarytool** |
| `APPLE_APP_PASSWORD` | App-specific password from [appleid.apple.com](https://appleid.apple.com) |

Optional: `SKIP_NOTARIZE=1` to sign + DMG only. Optional: `OUTPUT_DIR`, `DMG_FILENAME`, `CONFIGURATION`.

CI can also set **`RUN_MAC_DISTRIBUTION_BUILD_BEFORE_UPLOAD=1`** when invoking **`upload-desktop-downloads.sh`** so the DMG at **`FILE_PATH`** is rebuilt/signed/notarized immediately before upload.

See `docs/desktop-downloads.md`.

## Further reading

- `docs/DESKTOP_APP_API_CONTRACT.md` — API + auth contract
- `docs/DESKTOP_DOWNLOAD_FLOW.md` — admin presigned macOS download (separate from local dev)
