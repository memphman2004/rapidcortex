# Vertical onboarding packets (S3)

Customer-facing packets live under the Rapid Cortex **assets** bucket:

```
s3://{AssetsBucket}/onboarding-packets/campus/
s3://{AssetsBucket}/onboarding-packets/venue/
s3://{AssetsBucket}/onboarding-packets/hospital/
s3://{AssetsBucket}/onboarding-packets/transit/
s3://{AssetsBucket}/onboarding-packets/psap/
```

RC Superadmin, RC Admin, and RC IT see **every** folder from **RC Admin → Onboarding packets**.

Agency / campus / venue / hospital / transit **admins** see only their vertical.

## What belongs here

Shareable discovery and go-live files: what Rapid Cortex is and is not, what to collect, roles, integrations, and checklists.

Do **not** put credentials, internal pricing workbooks, or unsigned MSAs in these folders.

CAD write-back, Clery auto-file, and automatic lockdown are **never** enabled by these documents.

## Publish after deploy

```bash
# from repo root — uses DataLayer AssetsBucket output
bash scripts/sync-onboarding-packets-s3.sh staging
bash scripts/sync-onboarding-packets-s3.sh dev
```

Until the first sync, dashboards show the **built-in** packet shipped in the API (same markdown as this tree). Extra PDFs you drop in S3 appear alongside those files.

## Source files

Edit markdown in this directory, then sync. The in-app catalog is `packages/shared/src/onboarding/onboarding-packets.ts` — keep titles in sync when you add a file.
