# Production security checklist

Use before go-live and on a recurring cadence (e.g. quarterly).

## Identity & access

- [ ] Cognito: MFA enforced for privileged roles (admin, it_admin, platform_superadmin) per policy.
- [ ] Self-signup **off** unless business requires it (`NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP`, server flags).
- [ ] JWT authorizer enabled on HTTP API for all non-public routes.
- [ ] `ALLOW_UNAUTHENTICATED_API` **unset** in production Lambdas.

## Network & edge

- [ ] `HttpApiCorsAllowedOrigins` — explicit origins, not `*`.
- [ ] WAFv2 attached: rate limiting + AWS Managed Core rule set + optional geo restriction.
- [ ] CloudFront / ALB TLS 1.2+ only; valid certificates.

## Data plane

- [ ] DynamoDB PITR on for prod/pilot tables.
- [ ] S3: encryption at rest + public access block on all application buckets.
- [ ] S3 object ownership / ACLs disabled where possible (BucketOwnerEnforced) — evaluate per bucket.
- [ ] Presigned URL TTLs short (minutes); one-time upload tokens where applicable.

## Application

- [ ] `NEXT_PUBLIC_CSP_ENFORCE=1` after CSP report-only review.
- [ ] `NEXT_PUBLIC_ENABLE_DEMO_SCRIPTED_CONTENT=false` on customer production (see `deployment-environment.ts`).
- [ ] BFF routes never forward raw upstream errors to browsers in prod.

## Observability

- [ ] CloudWatch log retention set (not indefinite).
- [ ] Security audit lines (`rc_audit` JSON from `safe-log.ts`) shipped to SIEM if required.

## Dependency & repo hygiene

- [ ] `npm audit` — document accepted risks or upgrade path.
- [ ] `npm run security:scan-secrets` in CI.
- [ ] No `.env` / `.pem` committed (`git ls-files` review).

## AWS governance (org level)

- [ ] AWS Config + Security Hub + GuardDuty enabled.
- [ ] CloudTrail organization trail to locked S3 + Object Lock where required.
- [ ] IAM Access Analyzer enabled periodically.

## Rate limiting guidance (API Gateway)

- Use **throttling** on stage (burst + steady) per route where possible.
- WAF: count/block mode on sensitive paths (`/api/auth/*`, public token upload routes).

## Malware scanning (extension)

- [ ] Design async scan queue post-`confirmUpload` before dispatcher visibility — **document owner** before claiming compliance.
