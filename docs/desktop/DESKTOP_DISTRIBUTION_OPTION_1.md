# macOS distribution — Option 1 (enterprise: Developer ID + notarization)

This document describes **direct distribution** of the native macOS app **outside the Mac App Store**. The Rapid Cortex **Admin Portal** issues **short-lived presigned HTTPS URLs** for the DMG stored in **private S3** (`ASSETS_BUCKET`); there is **no** permanent public download URL.

> **Scope:** The Swift/Xcode **project is not in this monorepo** (see `docs/DESKTOP_CONNECTION_AUDIT.md`). Steps below are what operators and CI must run where the macOS app **does** live.

## Operator checklist (end-to-end)

1. **Xcode → Archive** — Release build, **Developer ID Application** signing, **Hardened Runtime** on.
2. **Developer ID sign** — Distribute from Organizer (or export signed `.app`).
3. **Notarize** — `notarytool submit` … `--wait` until **Accepted**.
4. **Staple** — `xcrun stapler staple` on the signed `.app` (and follow Apple guidance if you also staple the DMG).
5. **Export `.dmg`** — e.g. `hdiutil create` → `RapidCortex-1.0.0.dmg` (name must match `DESKTOP_MACOS_ARTIFACT_NAME` if you override it).
6. **Publish for Admin Portal** — Upload the DMG to **private** S3 under your chosen key (e.g. `desktop/releases/RapidCortex-1.0.0.dmg`), set stack/Lambda env **`DESKTOP_MACOS_S3_KEY`** (and optional `DESKTOP_MACOS_SHA256`, etc.), redeploy. There is no separate “upload file” button in the portal yet; the portal **surfaces** the build once S3 + env are correct.
7. **Admins download** — In the web app: **Settings** (`/admin/settings`) → **Downloads** (`/admin/settings/downloads`) → **Desktop Apps** → **Download for Mac** (presigned link, expires quickly; refresh the page to get a new link if needed).

## 1. Xcode build (Release)

1. Open the macOS app workspace in Xcode.
2. Select the **Release** configuration and **Any Mac (Apple Silicon, Intel)** destination.
3. **Signing:** set **Signing Certificate** to **Developer ID Application** (not “Apple Development” and not Mac App Store profiles).
4. Enable **Hardened Runtime** on the app target (**Signing & Capabilities** → **Hardened Runtime**).
5. **Product → Archive**; in the Organizer window, **Distribute App** → **Developer ID** → export a **signed** `.app` (or proceed to notarization from Organizer if using the integrated flow).

## 2. Developer ID signing (not Mac App Store)

- Use an **Apple Developer Program** team with **Developer ID Application** certificates installed in Keychain (CI: import via **match** or encrypted secrets).
- Entitlements plist must be minimal and accurate (network client, any required hardened-runtime exceptions documented with security review).

## 3. Notarization (`notarytool`)

Apple requires **notarization** for Developer ID–distributed apps on modern macOS.

1. Create an **App Store Connect API key** with **Developer** role (or use Apple ID + app-specific password legacy — prefer API key for CI).
2. Submit the **zip of the .app** or the **dmg** per Apple’s current `notarytool` documentation:

```bash
xcrun notarytool submit RapidCortex-1.0.0.zip \
  --apple-id "$APPLE_ID" \
  --team-id "$TEAM_ID" \
  --password "$APP_SPECIFIC_PASSWORD" \
  --wait
```

(Or use `--key` / `--key-id` / `--issuer` for API key auth — see `man notarytool`.)

3. On success, Apple returns a **submission ID**; poll until **status: Accepted**.

## 4. Staple the notarization ticket

After **Accepted**, staple the ticket to the **app bundle** (and optionally the DMG if Apple’s docs for your format require it):

```bash
xcrun stapler staple "Rapid Cortex.app"
```

Validate:

```bash
xcrun stapler validate "Rapid Cortex.app"
spctl --assess --verbose --type install "Rapid Cortex.app"
```

## 5. Create `RapidCortex-1.0.0.dmg`

Example with `hdiutil` (adjust volume names and paths):

```bash
hdiutil create -volname "Rapid Cortex" -srcfolder "Rapid Cortex.app" -ov -format UDZO "RapidCortex-1.0.0.dmg"
```

Optional: run `notarytool submit` on the DMG as well if your packaging pipeline requires DMG notarization (follow current Apple guidance for your Xcode/macOS target).

## 6. SHA-256 checksum (for admin UI)

```bash
shasum -a 256 RapidCortex-1.0.0.dmg
```

Record the hex digest for `DESKTOP_MACOS_SHA256` (stack env) so **Settings → Downloads → Desktop Apps** can display it.

## 7. Upload to S3 (makes the build available in Admin Portal)

Upload the DMG into the **same** bucket as **`ASSETS_BUCKET`** for the deployment (SAM already grants the desktop-release Lambda **S3 read** on that bucket).

Example key layout:

```text
desktop/releases/RapidCortex-1.0.0.dmg
```

```bash
aws s3 cp RapidCortex-1.0.0.dmg "s3://$ASSETS_BUCKET/desktop/releases/RapidCortex-1.0.0.dmg"
```

**Object ACL:** keep objects **private** (no public-read). Access is only via **`POST /api/admin/desktop-releases/signed-url`** (short-lived presigned GET), after metadata from **`GET /api/admin/desktop-releases`**.

## 8. Stack / Lambda configuration

Set (SAM **Globals** or per-environment overrides):

| Variable | Example | Purpose |
| --- | --- | --- |
| `DESKTOP_MACOS_S3_KEY` | `desktop/releases/RapidCortex-1.0.0.dmg` | Enables `available: true` and presigning |
| `DESKTOP_MACOS_VERSION` | `1.0.0` | Shown in admin UI |
| `DESKTOP_MACOS_RELEASED_AT` | `2026-04-25` (optional ISO) | Shown if set |
| `DESKTOP_MACOS_MIN_OS` | `13.0` | Minimum macOS |
| `DESKTOP_MACOS_SHA256` | `…` | Checksum display |
| `DESKTOP_MACOS_FILE_BYTES` | `0` | Optional override; otherwise HeadObject size |
| `DESKTOP_MACOS_ARTIFACT_NAME` | `RapidCortex-1.0.0.dmg` | Display / filename hint |
| `DESKTOP_DOWNLOAD_URL_TTL_SECONDS` | `300` | Presigned URL lifetime |

Redeploy the API stack so **`GetDesktopMacosReleaseFunction`** picks up values.

## 9. CloudFront (optional)

**Option A (implemented):** API returns **S3 presigned URL** — **no CloudFront required**.

**Option B (optional hardening):** Put a **private** CloudFront distribution in front of S3 and issue **CloudFront signed URLs** from a Lambda — more moving parts; only add if your security architecture requires CDN edge caching or additional logging.

## 10. Admin Portal download flow

1. Sign in to the **web app** as **Agency Admin** (`admin`) or **Platform Super Admin** (`platform_superadmin`).
2. Go **Admin** → **Settings** (Environment tab, `/admin/settings`) → open **Downloads** in the admin nav, or use **Desktop app downloads** on the Environment page → **`/admin/settings/downloads`**.
3. On **Desktop Apps**, review version, release date, file size, minimum macOS, checksum, and installation notes.
4. Click **Download for Mac** — the browser opens a **short-lived HTTPS** presigned S3 URL (not a permanent public link).

**Roles:** The API **denies** dispatchers, supervisors, analysts, etc. Map organizational **“IT Admin”** to `platform_superadmin` or agency `admin` in Cognito.

## 11. Security checklist

- [ ] DMG and `.app` are **Developer ID** signed with **Hardened Runtime**.
- [ ] **Notarized** and **stapled**.
- [ ] S3 object is **private**; no static website hosting exposing the DMG.
- [ ] Presigned TTL kept short (`DESKTOP_DOWNLOAD_URL_TTL_SECONDS`).
- [ ] No secrets in the macOS binary; OAuth client is **public client** pattern if using PKCE, or use short-lived tokens only in memory + Keychain.

## 12. Related code (this repo)

| Piece | Location |
| --- | --- |
| Presigned GET + metadata | `apps/api/src/services/desktopReleaseService.ts` |
| HTTP handler | `apps/api/src/handlers/admin/getDesktopMacosRelease.ts` |
| Admin UI | `apps/web/app/[jurisdiction]/(dispatch)/admin/settings/downloads/page.tsx` |
| SAM | `GetDesktopMacosReleaseFunction`, Globals `DESKTOP_*` in `infra/template.yaml` |
| Shared DTO | `packages/shared/src/desktop-releases.ts` |

## 13. Windows (`RapidCortexSetup.exe`)

Windows uses the same **`POST /api/admin/desktop-releases/signed-url`** flow with `{ "platform": "windows" }` once **`DESKTOP_WINDOWS_S3_KEY`** is set.
