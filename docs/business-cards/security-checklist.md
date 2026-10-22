# Security checklist

Implemented:

- Private handlers call `getUserContext` before table access.
- Tenant mismatch on a profile or NFC card returns 404.
- Employee updates that change a locked field return 400 `field_locked`. `companyName`, primary email, and `website` are always locked.
- Public JSON is built by `toPublicProfile`. Internal ids and notes are not copied.
- Slug, phone, and URL checks reject reserved slugs, non-E.164 numbers, and `javascript:` / `data:` URLs.
- NFC redirects send `Cache-Control: no-cache`.
- Photo bucket blocks public access. Presigned PUT expires in 300 seconds and signs `ContentLength` up to 5 MB. The stored key must start with `biz-cards/{tenantId}/{profileId}/`.
- In-process rate limits on public reads, vCard downloads, analytics posts, and photo uploads.
- Audit rows store field names and a 7-year TTL.
- The web app already sends HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Frame-Options: DENY` on all routes.

Pending:

- API Gateway usage plans (limits today are per Lambda process).
- CloudFront OAC in front of the photo bucket. No distribution was created or edited.
- Host routing so `www.nexcortiq.us/card/{slug}` reaches the web app.
- Sharp/WebP resize after upload. Objects are stored in the uploaded type.
- Cognito `ListUsers` is not called. Admins paste the user id from the existing Users screen.
- Physical device checks.
