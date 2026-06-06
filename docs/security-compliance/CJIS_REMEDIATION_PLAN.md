# Rapid Cortex CJIS Remediation Plan

This plan translates the CJIS gap audit into implementation workstreams. It is a readiness plan, not a certification statement.

## P0 Implementation Status (This Iteration)

- **Implemented:** fail-closed unauthenticated API bypass (`ALLOW_UNAUTHENTICATED_API` throws outside local/dev).
- **Implemented:** backend active-status enforcement for authenticated API users (`custom:status=active` required by handlers; inactive/missing returns `403` with `User account is not active.`).
- **Implemented:** strict web security headers in Next.js (`CSP`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, production `HSTS`).
- **Implemented:** CSRF/origin checks for cookie-auth write routes under `apps/web/app/api/auth` via shared origin enforcement helper and `APP_ALLOWED_ORIGINS`.
- **Implemented:** AI/STT provider data minimization and policy controls (`sanitizeForProvider`, provider allowlist/single-provider enforcement, and prompt/provider sanitization logging).
- **In Progress:** long-term AWS-native SSR runtime migration (CloudFront + WAF + ALB + ECS Fargate stack defined in `infra/web-ssr-infra-template.yaml`; deployment workflow and runbook added).
- **Partially Implemented:** public tokenized media route hardening (token-shape guards + tests for missing/invalid token).

## Evidence: Files Changed

- `apps/api/src/lib/auth.ts`
- `apps/api/src/lib/response.ts`
- `apps/api/src/lib/auth.test.ts`
- `apps/api/src/lib/publicToken.ts`
- `apps/api/src/lib/publicToken.test.ts`
- `apps/api/src/handlers/handlerTestUtils.ts`
- `apps/api/src/handlers/publicTokenGuards.handler.integration.test.ts`
- `apps/api/src/handlers/demoScenarios.ts`
- `apps/api/src/handlers/startDemoScenario.ts`
- `apps/api/src/handlers/*` (authenticated handlers updated with active-status guard using `isUserAccountActive`)
- `apps/api/src/handlers/media/getUploadUrl.ts`
- `apps/api/src/handlers/media/confirmUpload.ts`
- `apps/api/src/handlers/media/joinLiveSession.ts`
- `apps/api/src/handlers/media/liveHeartbeat.ts`
- `apps/api/src/handlers/silentTextPublicHttp.ts`
- `apps/api/src/handlers/videoAssistPublicHttp.ts`
- `apps/web/next.config.ts`
- `apps/web/lib/security/origin-protection.ts`
- `apps/web/lib/security/origin-protection.test.ts`
- `apps/web/app/api/auth/signin/route.ts`
- `apps/web/app/api/auth/signout/route.ts`
- `apps/web/app/api/auth/signup/route.ts`
- `apps/web/app/api/auth/confirm-signup/route.ts`
- `apps/web/app/api/auth/resend-signup-code/route.ts`
- `apps/web/app/api/auth/complete-new-password/route.ts`
- `apps/web/app/api/auth/mfa/associate/route.ts`
- `apps/web/app/api/auth/mfa/complete-setup/route.ts`
- `apps/web/app/api/auth/mfa/verify-login/route.ts`
- `apps/api/src/ai/sanitization.ts`
- `apps/api/src/ai/providerPolicy.ts`
- `apps/api/src/ai/prompts.ts`
- `apps/api/src/ai/providers/openaiAdapter.ts`
- `apps/api/src/ai/providers/anthropicAdapter.ts`
- `apps/api/src/ai/providers/bedrockAdapter.ts`
- `apps/api/src/voice/stt/sttOrchestrator.ts`
- `apps/api/src/voice/translation/translationProviderFactory.ts`
- `infra/web-ssr-infra-template.yaml`
- `scripts/deploy-web-ssr.sh`
- `docs/deployment-infrastructure/CI_RELEASE_PIPELINE.md`

## Verification Commands

- `npm run typecheck`
- `npm run build`
- `npm audit`

## Remaining Gaps After This Iteration

- Retention/disposal automation for incidents/transcripts/analysis (legal hold + deletion evidence) remains open.
- Immutable audit/forensic pipeline and CloudTrail evidence remains open.
- AI/STT provider data minimization and agency provider policy enforcement remains open.
- Upload malware scanning/quarantine pipeline remains open.
- IAM wildcard reduction and AWS account-level validation tasks remain open.

## P0 Fixes Required Before Any CJIS-Sensitive Pilot

1. **Fail-closed authentication configuration**
   - [x] Block startup/request handling in non-dev if `ALLOW_UNAUTHENTICATED_API=true`.
   - [x] Enforce `custom:status` checks at auth boundary to block inactive accounts.
   - Suggested code targets:
     - `apps/api/src/lib/auth.ts`
     - `apps/web/lib/auth/verify-cognito.ts`

2. **Mandatory web app security baseline (CSP + CSRF)**
   - [x] Add strict CSP and baseline security headers.
   - [x] Add explicit CSRF/origin validation for cookie-authenticated write routes.
   - Suggested code targets:
     - `apps/web/next.config.ts`
     - `apps/web/middleware.ts`
     - `apps/web/app/api/auth/*`

3. **Retention and disposal enforcement**
   - Implement automated deletion/retention executor for transcript/incident/analysis data.
   - Add legal hold model and deletion audit trail.
   - Suggested code targets:
     - `apps/api/src/lib/env.ts`
     - `apps/api/src/repositories/*`
     - `infra/template.yaml` (scheduler + params)

4. **AI/STT/translation data minimization guardrails**
   - Add de-identification/minimization layer before any provider call.
   - Enforce per-agency provider policy (allowlist; optionally single-provider mode for high sensitivity).
   - Suggested code targets:
     - `apps/api/src/ai/prompts.ts`
     - `apps/api/src/ai/providers/*`
     - `apps/api/src/voice/*`

5. **Audit completeness and immutable evidence path**
   - Emit login success/failure/logout and privileged admin action events consistently.
   - Export critical audit trails to immutable storage/SIEM destination.
   - Suggested code targets:
     - `packages/security/src/audit-schema.ts`
     - `apps/web/app/api/auth/*`
     - `apps/api/src/lib/writeAdminAudit.ts`

6. **AWS baseline validation hard gate**
   - No CJIS-sensitive pilot unless WAF/CORS/KMS/encryption/CloudTrail/alert routing are validated and evidenced.

## P1 Fixes Required Before Production

1. **IAM least-privilege hardening**
   - Remove wildcard or broad fallback modes.
   - Tighten secrets and model access permissions by ARN.
   - Targets: `infra/template.yaml`, `infra/iam/sam-deploy-policy.json`.

2. **Media and upload risk controls**
   - Add malware scanning pipeline for uploaded assets.
   - Add lifecycle expiration policies for media and STT staging prefixes.
   - Targets: `apps/api/src/services/mediaService.ts`, `infra/template.yaml`.

3. **CloudWatch and audit retention consistency**
   - Standardize retention by log class and ensure all groups are managed.
   - Targets: `infra/template.yaml`, operations docs.

4. **Cross-tenant and public-token abuse test suite**
   - Add automated security tests for token misuse, sharing abuse, and cross-tenant denial.
   - Targets: `apps/api/src/handlers/*`, integration test harness.

5. **Release governance and vulnerability management**
   - Add SAST/SCA policy gates in CI and approval controls for production.
   - Targets: CI pipeline definition (maintained outside this repo), org branch/environment policies.

## P2 Improvements

1. Build CJIS control evidence matrix mapped to code, AWS controls, and policy artifacts.
2. Add automated conformance checks (IaC policy scanners, drift checks).
3. Expand redaction from key-name matching to schema-driven sensitive data classification.
4. Add periodic tabletop and restore drill automation/report templates.
5. Build agency-level compliance dashboard for control status and evidence links.

## Suggested AWS Services and Configurations

- **CloudTrail + CloudTrail Lake** with integrity and long retention.
- **AWS Config + Security Hub + GuardDuty** with compliance dashboards and alerting.
- **AWS WAF** mandatory for pilot/prod APIs.
- **KMS CMKs** for sensitive data stores with key policies and rotation strategy.
- **S3 Block Public Access + bucket policies + Object Lock (where required)**.
- **AWS Macie** (optional) for sensitive data discovery in S3.
- **AWS Backup** with tested restore workflows and retained evidence.
- **EventBridge Scheduler/Lambda** for retention/deletion enforcement workflows.

## Suggested Code Changes

1. Add `assertSecureRuntimeConfig()` guard executed at cold start for non-dev.
2. Implement CSRF middleware for all state-changing web API routes.
3. Introduce `sanitizeForProvider()` utility for AI/STT/translation payloads.
4. Introduce `auditAuthEvent()` utilities and mandatory hooks in signin/signout/challenge routes.
5. Add retention engine with per-entity retention policy config and legal hold exceptions.
6. Add policy tests that fail CI if insecure env flags appear in non-dev templates/config.

## Suggested Cursor Follow-Up Prompts

### 1) Auth hardening
“Implement a fail-closed non-dev auth configuration in `apps/api/src/lib/auth.ts` that throws if `ALLOW_UNAUTHENTICATED_API=true`, and enforce `custom:status=active` for all authenticated users. Add tests.”

### 2) CSP + CSRF
“Add strict CSP and security headers in `apps/web/next.config.ts` and implement CSRF/origin checks for cookie-authenticated POST routes under `apps/web/app/api/auth`. Include tests.”

### 3) Retention executor
“Build a retention/deletion workflow for incidents, transcripts, analyses, and related artifacts using EventBridge + Lambda, with legal hold support and deletion audit events.”

### 4) AI minimization
“Create a sanitization layer before provider calls in `apps/api/src/ai` and `apps/api/src/voice` that removes direct identifiers and enforces per-agency provider policy.”

### 5) Audit completeness
“Add and wire auth audit events (`login.success`, `login.failure`, `logout`) across web auth routes and ensure they are queryable from existing audit APIs.”

### 6) IAM least privilege
“Tighten `infra/template.yaml` and `infra/iam/sam-deploy-policy.json` to remove wildcard permissions where possible and scope Secrets/Bedrock access to explicit ARNs.”

### 7) Upload security
“Implement malware scanning pipeline for uploaded media and enforce quarantine/deny workflow before any processing.”

### 8) CI security gates
“Add dependency and static security scanning to your CI pipeline with fail-on-high policy and documented triage process (see `docs/deployment-infrastructure/CI_RELEASE_PIPELINE.md`).”
