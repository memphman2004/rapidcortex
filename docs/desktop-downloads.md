# Desktop app downloads

## Overview

Mac and Windows desktop clients are **not** server infrastructure: they authenticate with Amazon Cognito and call the deployed HTTP API. Installers ship as signed binaries you upload to Amazon S3; `infra/downloads-hosting.yaml` provisions a **versioned**, private bucket plus a **CloudFront** distribution (`DistributionDomainName` output) intended for HTTPS aliases such as **downloads.**_your-domain_.

## Canonical URLs

After you alias **`downloads.rapidcortex.us`** to the CloudFront distribution from `infra/downloads-hosting.yaml`, use:

| Artifact | HTTPS URL |
|----------|-----------|
| macOS installer | `https://downloads.rapidcortex.us/mac/latest/RapidCortex.dmg` |
| Windows installer | `https://downloads.rapidcortex.us/windows/latest/RapidCortexSetup.exe` |
| Update manifest | `https://downloads.rapidcortex.us/latest.json` |

**`latest.json`** at the bucket root (same object CloudFront serves as **`https://downloads.rapidcortex.us/latest.json`**) is the manifest desktop apps should poll. After each upload script run it includes **`updatedAt`**, semver **`version`**, **`url`**, **`sha256`**, optional **`releaseDate` / `releaseNotes`**, and **`minOSVersion`** per channel.

Minimal shape:

```json
{
  "mac": {
    "version": "1.0.0",
    "url": "https://downloads.rapidcortex.us/mac/latest/RapidCortex.dmg",
    "releaseDate": "2026-05-01T00:00:00Z",
    "releaseNotes": "https://rapidcortex.us/releases/mac/1.0.0",
    "minOSVersion": "11.0",
    "sha256": "…"
  },
  "windows": {
    "version": "1.0.0",
    "url": "https://downloads.rapidcortex.us/windows/latest/RapidCortexSetup.exe",
    "releaseDate": "2026-05-01T00:00:00Z",
    "releaseNotes": "https://rapidcortex.us/releases/windows/1.0.0",
    "minOSVersion": "10.0",
    "sha256": "…"
  },
  "updatedAt": "2026-05-01T00:00:00Z"
}
```

A developer-only scaffold also exists at **`apps/web/public/downloads/latest.json`** (same-origin **`/downloads/latest.json`**) for UI demos — runtime auto-update MUST use the CloudFront hostname above in production.

When you publish only one platform, **`scripts/upload-desktop-downloads.sh`** keeps the untouched side verbatim (stub objects include empty **`version`** placeholders until first publish).

Optional env: **`RELEASE_NOTES_BASE_URL`** (defaults to **`https://rapidcortex.us/releases`**) fills each **`releaseNotes`** URL (`…/{platform}/{version}`).

Override the public host embedded in **`url`** fields with **`DOWNLOADS_PUBLIC_BASE_URL`** if you serve from a staging CloudFront hostname.

## Hosting

| Component       | Purpose |
|----------------|---------|
| S3 bucket      | Objects under `mac/…`, `windows/…`, and root **`latest.json`** |
| CloudFront + OAC | HTTPS; map **`downloads.rapidcortex.us`** here |
| Route 53 ACM   | Certificate in **us-east-1** for the viewer hostname |

## Upload

Prerequisites: deploy the CloudFormation stack (example name `rapid-cortex-downloads-prod`).

Requires **`jq`** (merges **`latest.json`**).

```bash
./scripts/upload-desktop-downloads.sh prod mac ./dist/RapidCortex.dmg 1.0.0
./scripts/upload-desktop-downloads.sh prod windows ./dist/RapidCortexSetup.exe 1.0.0
```

**One-step macOS build + upload** (creates `./dist/RapidCortex.dmg`, then uploads and merges `latest.json`):

```bash
./scripts/publish-macos-dmg.sh prod 1.0.0
```

Override the stack name with `DOWNLOADS_STACK_NAME` if you used a different `--stack-name`.

## Build + sign (operator notes)

### macOS

Create the DMG from the Xcode project (writes **`dist/RapidCortex.dmg`** at the repo root):

```bash
./scripts/package-macos-dmg.sh
```

Uses **`xcodebuild archive`** (default **`Release`**) and **`hdiutil`**. Override with `CONFIGURATION=Staging` if needed. Requires Apple code signing as configured in the project (**Development Team**, hardened runtime).

For distribution outside the dev team, add **notarization** + **`stapler`** per Apple’s process (see `docs/desktop/DESKTOP_DISTRIBUTION_OPTION_1.md`).

### Windows

```bash
cd apps/desktop-windows
npm run build
# Authenticode signing + timestamping per your CA process.
```

## Authentication

- Cognito Hosted UI or device/OAuth flows already configured in the user pool.
- Callback examples: `rapidcortex-mac://oauth/callback`, `rapidcortex-windows://oauth/callback` (match your real app-client settings).

## Web surface

The marketing route `/downloads` lists public HTTPS links (`NEXT_PUBLIC_*_DOWNLOAD_URL`). Point those env vars at your CloudFront domain after you cut DNS.
