# Business cards — codebase audit

Audit completed before the business-card code was added. Paths are relative to the repo root.

## App shell

- Next.js **16.3.6**, App Router, in `apps/web`. The marketing site is a separate Next.js app with `output: "export"`, so public card pages that need a per-person server render live on the web app.
- Dashboard shell with sidebar and header: `apps/web/components/dashboards/dashboard-shell.tsx`. Sidebar: `apps/web/components/navigation/role-nav-sidebar.tsx`. Nav data: `apps/web/lib/navigation/role-nav.ts`.
- Account control in the header: `apps/web/components/ui/user-identity-bar.tsx`, rendered by `apps/web/components/dashboards/top-nav.tsx`. It is an identity row with sign-out, not a menu component.
- Notices already render in the shell through `apps/web/components/notices/ActiveNoticesBanner.tsx`. There is no separate post-login redirect banner system. Post-login destinations are in `apps/web/lib/auth/post-login-redirect.ts`.
- Brand on the signed-in shell uses Inter (`dashboard-shell.tsx`) and the square mark from `@/lib/site` (`SITE_SQUARE_ICON_PATH`). The public-card gold `#c9a84c` is the product spec color. A search of web CSS did not find that hex already tokenized.

## Auth

- There is no function named `verifyJwt`. Private handlers call `getUserContext(event)` in `apps/api/src/lib/auth.ts`.
- Signature: `getUserContext(event: APIGatewayProxyEventV2, options?: { skipNetworkAccess?: boolean }): Promise<UserContext | null>`.
- Role comes from `custom:role`, then `preferred_role`, then the first known `cognito:groups` entry. `normalizeSessionRole()` preserves campus, venue, transit, hospital, and call-assist roles.
- Tenant id is `custom:agencyId` (`UserContext.agencyId`). `rcsuperadmin` may fall back to the platform agency id. Business cards use that value as `tenantId` and do not accept a tenant id from the request body.
- There is no Cognito group named `admin` or `employee`.
- Agency administrator role string: `agencyadmin`. IT administrator: `agencyit`. Platform operators: `rcadmin`, `rcsuperadmin`, `rcitadmin`.
- Product admin role strings: `CAMPUS_ADMIN`, `VENUE_ADMIN`, `TRANSIT_ADMIN`, `HOSPITAL_ADMIN`, `CALL_ASSIST_ADMIN`.
- A signed-in dispatcher, supervisor, analyst, or the matching product seat is the employee for their own card.

## Tenant config and feature flags

- Agency records live in the agencies table. Key is `agencyId`. The display name field is `name` (`packages/shared/src/tenancy/agency.ts`, read by `AgencyRepository.get`).
- Per-tenant product flags today are fields on tenant config (for example campus `escortIq.enabled`) plus env flags. `featureEnabled(name, defaultWhenUnset = true)` in `apps/api/src/lib/env.ts` defaults operational flags **on**. Exceptions that default **off** include `ENABLE_ESCORT_IQ` and `ENABLE_CAMPUS_ALERTS`.
- Web nav hides items with `NavItem.feature` via `filterRoleNavByFeatures` and `isNavFeatureEnabled`. Hidden means omitted, not grayed out.
- SSM prefix in this repo is `rapid-cortex/...`, not `/nexcortiq/prod/...`. The business-card stack adds `/nexcortiq/{stage}/business-cards/*` as new parameters only.
- User profile fields already on the token: `email`, `custom:firstName`, `custom:lastName`, `displayName`, `custom:agencyId`, role. There is no existing digital-card record.

## API and data

- HTTP API v2. Routes are `AWS::ApiGatewayV2::Route` resources attached to an existing `HttpApiId`. Path style is `/api/...`.
- Lambdas use `getUserContext`, Zod, and `apps/api/src/lib/response.ts` (`ok`, `forbidden`, `notFound`, `jsonStatus`). Correlation headers: `withCorrelationHeaders`.
- DynamoDB is multi-table. Physical names look like `rapid-cortex-{name}-{stage}`. New tables go in a nested stack with `DeletionPolicy: Retain`. GSIs are named explicitly.
- The API package depends on a vendored `rapid-cortex-shared` tarball. Business-card code therefore lives under `apps/api/src/lib/business-cards` so it ships in the Lambda bundle without rebuilding that tarball.
- Tests: Vitest, included from `apps/**/*.{test,spec}.ts`. Playwright is not a repo test runner.
- SAM: nested stacks under `infra/nested/`, parent `infra/template.yaml`. QR/NFC is `infra/nested/stack-app-sam-qr.yaml`. Builds use the API makefile and `CodeUri: ../../apps/api/`. `sam build` must use an internal-drive `--build-dir` (`/tmp/sam-build` is acceptable).

## Existing NFC tool

- This is the safety-point QR/NFC programmer, not a business-card writer.
- HTTP handler: `apps/api/src/handlers/qr-nfc/qrNfcHttp.ts` (`QrNfcHttpFunction`). Routes under `/api/qr-nfc`.
- Table: `rapid-cortex-qr-nfc-codes-{stage}`.
- Record: `QRNFCRecord` in `packages/shared/src/qr-nfc/types.ts` (`agencyId`, `nfcEnabled`, `nfcTagId`, `url`, `nfcWriteLog`).
- Writes are logged as `QRNFCWriteEvent` (`devicePlatform` ios or android, `writeMethod` `native_nfc`, `tagType`). Programming is done from the native apps, then logged on the location record.
- Access: `packages/security/src/qr-nfc-access.ts`. Manage roles include platform admins, `agencyadmin`, `agencyit`, and campus/venue/transit admins. Program roles also include campus security/dispatch, venue security, and transit security.
- Dashboard entry from agency admin nav: `/{jurisdiction}/admin/qr-codes`.
- It does **not** assign a person profile, revoke a business-card URL, or serve `/card/{slug}`.

## Integration choice

Path B. Business-card admin links to the existing QR/NFC screen and stores assignment, programmed/verified status, and revocation on the new business-card table. The QR/NFC Lambda, table, and routes are unchanged.

## Route mapping

The spec’s `/dashboard/...` and `/api/v1/...` paths do not match this app. Implemented paths:

- Employee: `/{jurisdiction}/profile/business-card` (and the same suffix on campus, venue, transit, hospital, call-assist, and RC admin bases).
- Admin: `/{base}/admin/business-cards`, `/{base}/admin/nfc-cards`, `/{base}/admin/analytics/business-cards`.
- API: `/api/business-cards/...`, `/api/admin/business-cards/...`, `/api/admin/nfc-cards/...`, `/api/public/business-cards/...`, `/api/public/c/{cardId}`.
- Public pages: `/card/{slug}`, `/c/{cardId}`, `/c/revoked`, `/c/inactive` on the web app. `www.nexcortiq.us` still needs a host route before those URLs exist on the marketing domain. No existing CloudFront distribution was changed.
