# Production security checklist

**Last reviewed:** 2026-09-19 (60-day refresh) · **Owner:** Jeff Coleman  
Use before go-live and on a recurring cadence (60-day document review + quarterly access review). Technical snapshots: [soc2-evidence/2026-10](../evidence/soc2-evidence/2026-10/README.md). Policy: [POL-03](./soc2/policies/03-access-control-policy.md).

**Not a SOC 2 Type II report.** Checking a box here is operating evidence, not an attestation.

## Identity & access

- [x] Cognito: **MFA ON** for the production pool `us-east-1_0z6tA6WBs` (`MfaConfiguration=ON`, evidence 2026-09-17) — all product users, not only privileged roles. Agencies own TOTP device possession (CUEC).
- [ ] IAM: hardware or virtual MFA on **human** IAM users in account `158961537080`.
- [ ] Self-signup **off** unless business requires it (`NEXT_PUBLIC_ENABLE_PUBLIC_SIGNUP`, server flags).
- [ ] JWT authorizer enabled on HTTP API for all non-public routes.
- [ ] `ALLOW_UNAUTHENTICATED_API` **unset** in production Lambdas.
- [ ] Privileged roles (`rcsuperadmin`, `rcadmin`, `rcitadmin`) listed in the latest [access-review-log](./soc2/evidence/access-review-log.md).

## Network & edge

- [ ] `HttpApiCorsAllowedOrigins` — explicit origins, not `*`.
- [ ] WAFv2 attached: rate limiting + AWS Managed Core rule set + optional geo restriction; WAF logging on.
- [ ] CloudFront / ALB TLS 1.2+ only; valid certificates.

## Data plane

- [x] DynamoDB PITR on for prod/pilot tables (live lock-in: `DDB_ENABLE_PITR=true` via `scripts/lib/soc2-live-production-overrides.sh`; 182/182 sampled 2026-09-17).
- [ ] S3: encryption at rest + public access block on all application buckets.
- [ ] S3 object ownership / ACLs disabled where possible (BucketOwnerEnforced) — evaluate per bucket.
- [ ] Presigned URL TTLs short (minutes); one-time upload tokens where applicable.

## Application

- [ ] `NEXT_PUBLIC_CSP_ENFORCE=1` after CSP report-only review.
- [ ] `NEXT_PUBLIC_ENABLE_DEMO_SCRIPTED_CONTENT=false` on customer production (see `deployment-environment.ts`).
- [ ] BFF routes never forward raw upstream errors to browsers in prod.

## Observability

- [x] CloudTrail trail **`rapid-cortex-cloudtrail-prod`** logging (`IsLogging=true`). Do **not** set `EnableCloudTrail=true` on `rapid-cortex-dev` (would create a second Object Lock COMPLIANCE bucket). See [SYSTEM-BOUNDARY.md](./soc2/SYSTEM-BOUNDARY.md).
- [ ] CloudWatch log retention set (not indefinite).
- [ ] Security audit lines (`rc_audit` JSON from `safe-log.ts`) shipped to SIEM if required.

## Dependency & repo hygiene

- [ ] `npm audit` — document accepted risks or upgrade path.
- [ ] `npm run security:scan-secrets` in CI.
- [ ] No `.env` / `.pem` committed (`git ls-files` review).

## AWS governance (org level)

- [ ] AWS Config + Security Hub + GuardDuty enabled.
- [ ] CloudTrail organization trail to locked S3 + Object Lock where required (account already has `rapid-cortex-cloudtrail-prod`).
- [ ] IAM Access Analyzer enabled periodically.

## Rate limiting guidance (API Gateway)

- Use **throttling** on stage (burst + steady) per route where possible.
- WAF: count/block mode on sensitive paths (`/api/auth/*`, public token upload routes).

## Malware scanning (extension)

- [ ] Design async scan queue post-`confirmUpload` before dispatcher visibility — **document owner** before claiming compliance.
