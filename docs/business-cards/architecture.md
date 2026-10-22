# Business card architecture

`tenantId` is the Cognito `custom:agencyId`. Every private read and write includes it. A profile whose tenant does not match the caller returns 404.

## Records

One new table, `rapid-cortex-business-cards-{stage}`:

- Profile item `pk = PROFILE#{profileId}`, `sk = PROFILE#{profileId}`.
- Tenant list GSI `gsi1`: `TENANT#{tenantId}` / `PROFILE#{updatedAt}#{profileId}`.
- Slug GSI `gsi2` plus a `SLUG#{slug}` pointer so the public `/card/{slug}` URL has one owner. The pointer is global because the public URL has no tenant segment. Creating a slug that already exists returns 409 and does not name the other agency.
- User GSI `gsi3`: `USER#{cognitoUserId}`.
- Public id pointer `PUBLIC#{publicProfileId}` so public APIs never take the internal `profileId`.
- NFC item `NFC#{cardId}`.
- Event item `EVENT#{profileId}#{YYYY-MM}`.
- Audit item `AUDIT#{tenantId}#{YYYY-MM}` with a 7-year `ttl`. Changed field names only.
- Tenant settings `TENANT#{tenantId}` / `CONFIG`. `enabled` overrides the global flag.

Counters `totalViews`, `totalVcfDownloads`, `totalCallClicks`, `totalEmailClicks`, `totalWebClicks`, and `lastViewedAt` live on the profile and use an atomic `ADD`.

## Requests

The web app proxies `/api/business-cards`, `/api/admin/business-cards`, `/api/admin/nfc-cards`, and `/api/public/...` to API Gateway. Private Lambdas call `getUserContext` before any table call. Public Lambdas do not.

`/card/{slug}` and `/c/{cardId}` render on the Next.js server. NFC resolution redirects and sends `Cache-Control: no-cache`.

Photos upload with a 5-minute presigned PUT to `biz-cards/{tenantId}/{profileId}/{uuid}.{ext}` in a private bucket. The profile stores `photoKey` only after the client confirms the key. A CloudFront domain is optional (`BIZCARD_CLOUDFRONT_DOMAIN`). Until that domain is set, public responses omit `photoUrl` so the bucket host is not exposed. No existing CloudFront distribution was edited, and no new distribution was created.

## Feature flag

`ENABLE_BUSINESS_CARDS` defaults off. A tenant `CONFIG.enabled = true` turns the feature on for that agency only. `NEXT_PUBLIC_ENABLE_BUSINESS_CARDS` defaults off and hides the nav until it is set. The status call then hides the nav again when the tenant is off.

The nested stack is created only when the root parameter `IncludeBusinessCardsNestedStack` is `true` (default `false`).
