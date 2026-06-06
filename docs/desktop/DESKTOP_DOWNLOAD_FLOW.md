# Desktop download flow (public awareness vs secure distribution)

## Summary

- **Public visitors** can read **`/desktop`** on the marketing site to learn that Rapid Cortex Desktop exists for Mac and Windows. That page **does not** link to installers, S3, CloudFront, or any `.dmg` / `.exe` / `.msi` URL.
- **Authorized administrators** download installers only after signing into the web app: **Settings → Downloads → Desktop Apps**. The browser calls authenticated API routes; the API returns **short-lived presigned HTTPS URLs** for objects in **private S3** (`ASSETS_BUCKET`). Each signed-url request is **audited**.

## Public page (`/desktop`)

| Requirement | Implementation |
| --- | --- |
| Explains Mac + Windows | `apps/web/app/(marketing)/desktop/page.tsx` |
| Dispatch workstations + agency-controlled deployment | Same |
| Requires authorized account; installers not public | Same |
| CTAs: Request Pilot Access, Agency Login | Links to `/pricing` and jurisdiction login |
| No installer URLs | No `NEXT_PUBLIC_*` or hardcoded download URLs |

Navigation: marketing header includes a **Desktop** link (`marketingDesktopPath()` → `/desktop`).

## Secure admin flow

### Who may download

Roles allowed by the API (and mirrored in the admin UI):

- `platform_superadmin` (platform / “super admin”)
- `admin` (agency administrator)
- `it_admin` (IT administrator — assignable in Cognito; see admin **Users** UI)

Others see: **“Desktop downloads are available only to agency administrators and IT administrators.”** (exact copy on the downloads page for signed-in users without access).

### Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/desktop-releases` | Metadata for **macOS** and **Windows** cards (no presigned URLs). |
| `POST` | `/api/admin/desktop-releases/signed-url` | Body: `{ "platform": "macos" \| "windows" }`. Validates role, verifies object exists in S3, **writes audit**, returns presigned URL + TTL. |

Handlers: `apps/api/src/handlers/admin/getDesktopReleasesOverview.ts`, `postDesktopReleaseSignedUrl.ts`.  
Service: `apps/api/src/services/desktopReleaseService.ts`.

### Signed URL TTL

Controlled by **`DESKTOP_DOWNLOAD_URL_TTL_SECONDS`** (default **300** in SAM Globals). Keep this **short**; users can request a fresh URL from the admin page.

### Audit log (`desktop.installer.download_url_issued`)

Each successful `POST …/signed-url` writes an `AuditEvent`:

- `actorId` → Cognito `sub` (user id)
- `agencyId` → token `custom:agencyId`
- `details.role` → token role
- `details.platform` → `macos` | `windows`
- `details.version` → configured release version
- `details.artifactFileName` → file display name
- `type` → `AUDIT_EVENT_TYPES.DESKTOP_INSTALLER_DOWNLOAD_URL_ISSUED`

No transcript, caller, or incident payload is logged.

### Installer storage

- **Private S3** only (no public ACL, no static website listing).
- Keys set via Lambda env, e.g. **`DESKTOP_MACOS_S3_KEY`**, **`DESKTOP_WINDOWS_S3_KEY`** (under `ASSETS_BUCKET`).
- **CloudFront** is optional; the supported path is **API-issued S3 presigned GET** (HTTPS). If you later add CloudFront, use **signed URLs or signed cookies** — do not make the bucket public.

### Web client

- `fetchDesktopReleasesOverview()` and `postDesktopReleaseSignedUrl(platform)` in `apps/web/lib/api.ts`.
- No installer URLs are embedded in the frontend bundle.

### Desktop app runtime

The native app must **still authenticate** (Cognito / OIDC) before reading incidents — same as the web app; the installer alone grants no data access.

## Operator checklist

1. Build & notarize installers (see `docs/DESKTOP_DISTRIBUTION_OPTION_1.md`).
2. Upload to **private** S3 under the assets bucket.
3. Set **`DESKTOP_MACOS_S3_KEY`** / **`DESKTOP_WINDOWS_S3_KEY`** and optional checksum/size env vars; deploy API.
4. Verify **Admin → Settings → Downloads → Desktop Apps** shows cards and download buttons for an `admin` / `it_admin` / `platform_superadmin` test user.
5. Confirm audit rows for `desktop.installer.download_url_issued` in DynamoDB audit table.

## Related files

| Topic | Path |
| --- | --- |
| Public `/desktop` | `apps/web/app/(marketing)/desktop/page.tsx` |
| Admin downloads UI | `apps/web/app/[jurisdiction]/(dispatch)/admin/settings/downloads/page.tsx` |
| Shared DTOs | `packages/shared/src/desktop-releases.ts` |
| Audit constant | `packages/security/src/audit-schema.ts` |
| SAM | `GetDesktopReleasesOverviewFunction`, `PostDesktopReleaseSignedUrlFunction`, Globals `DESKTOP_*` in `infra/template.yaml` |
