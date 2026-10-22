# Business card API

Private routes require a Cognito bearer token. `getUserContext` supplies `tenantId`, user id, and role. Disabled tenants receive `403` `{ "error": "feature_not_enabled" }` except `GET /api/business-cards/status`, which returns `{ "enabled": false, "hasProfile": false }`.

Writes send `version`. A mismatch returns `409` `{ "error": "version_conflict" }`.

## Employee

- `GET /api/business-cards/status`
- `GET /api/business-cards/me`
- `PUT /api/business-cards/me` creates the caller’s card when none exists, otherwise updates it
- `POST /api/business-cards/me/publish`
- `POST /api/business-cards/me/photo` → `{ uploadUrl, key, expiresIn }`
- `POST /api/business-cards/me/photo/complete` → `{ key }`
- `DELETE /api/business-cards/me/photo`
- `GET /api/business-cards/me/qr` → `{ pngDataUrl, downloadPngDataUrl, svgString, url }`
- `GET /api/business-cards/me/analytics`

`companyName`, `website`, and the primary email are rejected when the body tries to change them.

## Admin

Role must be `agencyadmin`, `agencyit`, `rcadmin`, `rcsuperadmin`, `rcitadmin`, `CAMPUS_ADMIN`, `VENUE_ADMIN`, `TRANSIT_ADMIN`, `HOSPITAL_ADMIN`, or `CALL_ASSIST_ADMIN`.

- `GET|POST /api/admin/business-cards`
- `GET|PUT /api/admin/business-cards/{profileId}`
- `POST /api/admin/business-cards/{profileId}/photo` and `/photo/complete`
- `PATCH /api/admin/business-cards/{profileId}/status` body `{ status, version, reason? }`
- `PATCH /api/admin/business-cards/{profileId}/locks`
- `GET /api/admin/business-cards/{profileId}/analytics`
- `GET /api/admin/business-cards/{profileId}/audit`
- `GET|PUT /api/admin/business-cards/settings`
- `GET /api/admin/business-cards/audit`
- `GET /api/admin/analytics/business-cards`
- `GET|POST /api/admin/nfc-cards`
- `GET /api/admin/nfc-cards/{cardId}`
- `PATCH /api/admin/nfc-cards/{cardId}/assign` body `{ profileId, version }`
- `PATCH /api/admin/nfc-cards/{cardId}/revoke` body `{ reason, version }`
- `PATCH /api/admin/nfc-cards/{cardId}/status` body `{ status, version }`

## Public

No bearer token. Limits are enforced in the Lambda process: profile GET 60/min/IP, event POST 30/min/IP, vCard 20/min/IP, photo POST 5/min/user.

- `GET /api/public/business-cards/by-slug/{slug}`
- `GET /api/public/business-cards/{publicProfileId}`
- `GET /api/public/business-cards/{publicProfileId}/contact.vcf`
- `POST /api/public/business-cards/{publicProfileId}/event`
- `GET /api/public/c/{cardId}` → `302` `/card/{slug}`, `/c/revoked`, or `/c/inactive`

Public JSON includes `publicProfileId`, `slug`, `displayName`, public contact fields, `companyName`, `cardTheme`, and `permanentUrl`. It does not include `cognitoUserId`, `profileId`, `tenantId`, `lockedFields`, `version`, `createdBy`, `updatedBy`, or internal notes.

vCard 3.0 uses CRLF, UTF-8, 75-octet folding, and escaped `\`, `;`, `,`, and newlines.
