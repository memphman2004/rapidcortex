# Rapid Cortex CJIS Compliance Gap Audit

## Executive Summary

Rapid Cortex shows a strong CJIS-aligned foundation in core IAM/RBAC concepts, tenant-aware authorization helpers, Cognito MFA/password controls in IaC, and documented security operations intent. However, the repository evidence also shows critical gaps that prevent CJIS-sensitive pilot readiness today: incomplete enforceable retention/deletion controls, missing explicit immutable audit evidence, incomplete client-side hardening controls (notably explicit CSP/CSRF strategy), and multiple items that require AWS account-level validation (CloudTrail, WAF enablement by environment, KMS policy posture, alarm routing, and deployment-time settings).

This report is strict and evidence-based from repository artifacts only. It does not assume out-of-band controls exist unless they are encoded or documented with verifiable implementation detail.

## Overall Readiness Status

**PARTIAL / PILOT ONLY**

Rationale: core controls exist, but P0 blockers remain for CJIS-sensitive usage and several controls require AWS environment validation before pilot authorization.

## Important Disclaimer

**This is a technical readiness audit, not CJIS certification or legal approval.**

## Evidence Table

| Area | Status | Evidence Found | Gap | Recommended Fix | Priority |
| --- | --- | --- | --- | --- | --- |
| Cognito auth + token verification | PARTIAL | `apps/api/src/lib/auth.ts` verifies JWT (`jwtVerify`) and maps `custom:role`, `custom:agencyId`, `custom:status`; `infra/template.yaml` sets Cognito authorizer defaults | API has unauthenticated bypass code path (`ALLOW_UNAUTHENTICATED_API=true`) with warning-only guard in non-dev | Hard-fail startup in non-dev if `ALLOW_UNAUTHENTICATED_API=true`; add CI assertion | P0 |
| MFA + password policy | PARTIAL | `infra/template.yaml` Cognito UserPool has `MfaConfiguration: "ON"`, `EnabledMfas: SOFTWARE_TOKEN_MFA`, password complexity rules | Needs runtime proof users are enrolled and active pools enforce these settings | Validate deployed pool config and enrollment reports per environment | NEEDS AWS VALIDATION |
| Role-based access control | PASS | `packages/security/src/authorization-service.ts`, `apps/api/src/lib/authz.ts`, handler role checks across `apps/api/src/handlers/*` | Distributed checks can drift over time | Add route-level authorization regression tests for all sensitive endpoints | P1 |
| Tenant isolation | PARTIAL | `packages/security/src/tenant-access-guard.ts`, `apps/api/src/lib/incidentReadAccess.ts`, repository access patterns in `apps/api/src/services/incidentService.ts` | Public tokenized flows and cross-jurisdiction sharing increase exposure if misconfigured | Add negative cross-tenant integration tests for all incident/media/share routes | P0 |
| Superadmin controls | PARTIAL | `packages/shared/src/tenancy/principal.ts` and platform checks in `apps/api/src/services/platformCommandService.ts` | Platform-superadmin inference can rely on agency sentinel; enforceability needs review | Require explicit platform role + sentinel; add tests preventing accidental escalation | P1 |
| Least privilege IAM | PARTIAL | Function-scoped policies in `infra/template.yaml`; deploy policy in `infra/iam/sam-deploy-policy.json` | Broad wildcards remain (e.g., deploy policy broad service actions, optional broad secrets mode) | Remove broad modes in non-dev; scope actions/resources to exact ARNs | P0 |
| Inactive user handling | PARTIAL | `custom:status` mapped in `apps/api/src/lib/auth.ts`; seed scripts set status | No clear global enforcement of disabled/inactive account status at auth gate | Enforce `custom:status` in API/web auth middleware and deny non-active users | P0 |
| Session expiration + lockout | PARTIAL | Cookie max-age handling in `apps/web/lib/auth/apply-auth-cookies.ts`; Cognito handles auth challenges | Explicit lockout policy evidence not found in repo; session timeout policy not centrally defined | Document and enforce session/lockout baseline aligned to agency policy | P1 |
| Admin action auditability | PARTIAL | `apps/api/src/lib/writeAdminAudit.ts`, `apps/api/src/repositories/auditRepository.ts`, event types in `packages/security/src/audit-schema.ts` | Authentication lifecycle events (`LOGIN_FAILURE`, etc.) not clearly emitted by auth routes | Emit and test auth success/failure/logout and privileged action events | P0 |
| API route protections | PARTIAL | `infra/template.yaml` sets default Cognito authorizer; explicit public routes have `Authorizer: NONE` | Public routes need strict threat model, expiry/rate limits, and abuse monitoring proof | Document each public route control set; add automated abuse tests | P1 |
| Encryption in transit | PASS | API custom domain TLS policy in `infra/template.yaml`; CloudFront min TLS in `infra/web-hosting-template.yaml` | Need deployment evidence for all active domains | Validate active domain policy/cipher posture | NEEDS AWS VALIDATION |
| Encryption at rest (DynamoDB/S3) | PARTIAL | Dynamo tables defined in `infra/template.yaml`; web bucket encryption in `infra/web-hosting-template.yaml` | Primary API assets/media bucket encryption not explicit in all relevant resources | Add explicit `BucketEncryption` + TLS-only bucket policies + KMS strategy | P0 |
| Secrets handling | PARTIAL | Secrets loaded via `apps/api/src/lib/runtimeSecrets.ts`; secret parameters in `infra/template.yaml` | Optional wildcard secrets access mode exists | Remove wildcard secrets mode outside local/dev | P0 |
| Media/video/transcript protections | PARTIAL | Token-hash storage + presigned URL flows in `apps/api/src/services/mediaService.ts`; media repositories | No malware scanning pipeline evidence; lifecycle retention not complete | Add object scanning workflow + retention lifecycle controls | P0 |
| Audit log redaction | PARTIAL | Redaction helper in `apps/api/src/lib/auditDisplay.ts` | Key-name-based redaction can miss sensitive free text | Add schema allowlist and sensitive field classifier | P1 |
| Immutable logging / SIEM readiness | NOT FOUND | No in-repo CloudTrail immutable sink/IaC evidence | Cannot demonstrate tamper-evident retention from repo alone | Establish immutable audit export to locked store/SIEM and document controls | P0 |
| CloudTrail coverage | NOT FOUND | No CloudTrail IaC in reviewed templates | Accountability and forensic baseline unverifiable | Configure org/account trails with log integrity and retention lock | P0 |
| CloudWatch retention posture | PARTIAL | `infra/template.yaml` includes explicit `RetentionInDays` for some log groups | Not guaranteed for all groups/functions/environments | Standardize retention per log class via IaC | P1 |
| CJI-like data map | PARTIAL | Incident/transcript/media/silent-text flows in `apps/api/src/services/*`, repositories, AI prompts in `apps/api/src/ai/prompts.ts` | Data classification labels and handling tiers not fully enforced end-to-end | Add formal data classification matrix + policy-based controls in code | P0 |
| AI provider data exposure | FAIL | `apps/api/src/ai/prompts.ts` sends full transcript + incident/agency IDs; providers in `apps/api/src/ai/providers/{openaiAdapter,anthropicAdapter,bedrockAdapter}.ts` | Sensitive content may flow to third-party AI services without enforced minimization/redaction | Implement pre-provider de-identification and agency provider policy gates | P0 |
| STT/translation provider risk | PARTIAL | Multi-provider orchestration in `apps/api/src/voice/*`; provider factories include AWS/Google/Azure | Fallback can spread data across multiple providers; per-agency hard controls unclear | Add provider allowlists + single-provider high-sensitivity mode | P0 |
| Retention/disposal | FAIL | `docs/TRANSCRIPT_RETENTION_POLICY.md`, `docs/PRIVACY_RETENTION_DECISIONS.md`, comments in `apps/api/src/lib/env.ts` indicate non-enforced transcript deletion | No fully enforced automated retention/deletion for core CJI-bearing records | Build retention executor + legal hold support + deletion audit events | P0 |
| DynamoDB TTL scope | PARTIAL | TTL for some tables (e.g., share/media paths) in `infra/template.yaml` | Core incident/transcript/analysis/audit retention controls incomplete | Expand retention policy implementation across all data stores | P0 |
| WAF and rate limiting | PARTIAL | WAF resources + rate limit params in `infra/template.yaml`; guidance in `docs/PILOT_AWS_DEFENSE.md` | Enabled state per environment not guaranteed | Enforce WAF-on for pilot/prod in deployment policy checks | P1 |
| Public bucket / edge config | NEEDS AWS VALIDATION | Empty-bucket and hosting state observed operationally; web hosting template exists | Runtime bucket policies/OAC/public access block posture unverifiable from repo snapshot | Validate CloudFront OAC + S3 BlockPublicAccess + access logs | NEEDS AWS VALIDATION |
| CORS policy | PARTIAL | `infra/template.yaml` supports `HttpApiCorsAllowedOrigins`; deploy script passes env | Misconfiguration risk if wildcard used outside dev | Add stage guard rejecting wildcard CORS in non-dev | P1 |
| Env separation (dev/stage/prod) | PARTIAL | Stage-aware scripts in `scripts/deploy.sh`; parameters in template | No hard governance gate preventing insecure values in prod/pilot | Add policy-as-code checks for production parameters | P1 |
| Backups/PITR | PARTIAL | PITR toggles and backup docs in `infra/template.yaml`, `docs/BACKUP_AND_RECOVERY.md` | Restore drill evidence not present | Execute and document restore drills with RTO/RPO evidence | P0 |
| Web client security headers | FAIL | No explicit CSP/header policy in `apps/web/next.config.ts` or `apps/web/middleware.ts` | Missing strong browser hardening baseline | Add strict CSP + standard headers and monitoring/report-only rollout | P0 |
| CSRF strategy | PARTIAL | HttpOnly/SameSite cookies in `apps/web/lib/auth/apply-auth-cookies.ts` | No explicit CSRF token/origin enforcement pattern found | Add CSRF middleware for cookie-authenticated state-changing routes | P0 |
| Desktop token security | PASS | Keychain/DPAPI stores in macOS and Windows desktop code (`apps/desktop-macos/.../KeychainTokenStore.swift`, `apps/desktop-windows/.../ProtectedTokenStore.cs`) | Debug token paste flows exist in code paths/docs | Lock debug token paths behind strict non-prod build flags and checks | P1 |
| Incident response/runbooks | PARTIAL | `docs/INCIDENT_RESPONSE.md`, `docs/RUNBOOK.md`, `docs/ESCALATION_PATHS.md` | Drill/test evidence and closure metrics not evident | Add recurring tabletop + postmortem evidence workflow | P1 |
| Vulnerability/dependency scanning | PARTIAL | Recommended gates in `docs/deployment-infrastructure/CI_RELEASE_PIPELINE.md` (CI owned outside repo) | Dedicated SAST/DAST/dependency scanning integration not clearly present | Add CodeQL/SCA scanning and policy gating in your pipeline | P0 |
| Vendor/policy/contract readiness | PARTIAL | Governance docs (`docs/PILOT_GOVERNANCE.md`, `docs/SALES_BOUNDARIES.md`, `docs/PILOT_READINESS_CHECKLIST.md`) | Executed legal artifacts and personnel controls are not code-verifiable | Complete CJIS Security Addendum, agency contracts, training/background workflows | P0 |

## Top 10 CJIS Blockers

1. No verifiable immutable audit/forensic logging baseline in repo (CloudTrail + locked retention not evidenced).
2. Retention/deletion for transcript/incident/analysis data is not fully enforceable by code today.
3. AI pipeline sends sensitive transcript context and identifiers without mandatory minimization/redaction.
4. Web security hardening lacks explicit CSP and full header baseline.
5. CSRF protections are not explicitly enforced beyond SameSite cookies.
6. Optional insecure runtime mode (`ALLOW_UNAUTHENTICATED_API`) is warning-only outside dev.
7. IAM and secrets policies include broad/wildcard options that are not least-privilege CJIS posture.
8. Public/media/tokenized endpoints need stronger abuse-control test coverage and validation evidence.
9. Environment-level controls (WAF enabled, CORS strictness, encryption/KMS posture) require AWS verification.
10. Vulnerability scanning and security release gates are not fully codified in CI evidence.

## Required Engineering Fixes

- Enforce fail-closed auth settings in non-dev (`ALLOW_UNAUTHENTICATED_API` hard fail).
- Add mandatory account status enforcement (`custom:status`) at auth gate.
- Implement explicit CSRF middleware/checks for cookie-authenticated write routes.
- Add strict CSP/security headers for web app routes.
- Add AI payload minimization/de-identification before provider calls.
- Add provider policy enforcement (single-provider mode for high-sensitivity agencies).
- Expand audit event coverage for auth lifecycle and privileged actions.
- Implement retention executor + legal-hold model + deletion audit events.
- Add malware/scanning controls for uploaded media and document flows.
- Add integration tests for cross-tenant denial and public-token abuse limits.

## Required AWS Configuration Fixes

- Validate and enforce WAF enabled for pilot/prod stacks.
- Validate CloudTrail organization/account trails, integrity validation, and long-term retention.
- Enforce explicit S3 encryption + TLS-only access + Block Public Access for all sensitive buckets.
- Validate DynamoDB/S3 KMS key selection and key policies for CJIS-sensitive environments.
- Enforce strict CORS origins in non-dev/pilot/prod.
- Ensure CloudWatch log retention classes are standardized and documented.
- Validate SNS alert subscriptions and run alarm/fire drill checks.
- Validate backup/PITR and execute restore drills with documented evidence.

## Required Policy / Contract / Operational Fixes

- Execute CJIS Security Addendum and agency legal agreements before sensitive pilot.
- Establish personnel screening/background checks and annual security awareness controls.
- Define support-access controls (just-in-time, approval trails, session recording where applicable).
- Publish incident notification timelines and breach communication SOP with agency sign-off.
- Maintain vendor/subprocessor inventory with approved data flow boundaries.
- Define and enforce access review cadence (quarterly least-privilege + dormant account review).

## AI Provider Risk Assessment

- **Current Risk:** High for CJIS-sensitive content if external LLM/STT/translation providers receive raw or over-detailed payloads.
- **Evidence:** `apps/api/src/ai/prompts.ts`, `apps/api/src/ai/providers/*`, `apps/api/src/voice/*`.
- **Risk Modes:**
  - Third-party retention/processing uncertainty.
  - Multi-provider fallback increasing data spread.
  - Error logging potential leakage.
- **Required Controls before CJIS-sensitive pilot:**
  - Mandatory redaction/de-identification layer.
  - Per-agency provider allowlist with policy enforcement.
  - Provider-specific data handling agreements and retention configurations.
  - Human-review fallback workflow and override tracking for sensitive decisions.

## Pilot Readiness Recommendation

**Do not run a CJIS-sensitive pilot until all P0 items are closed and AWS validation items are evidenced.**

**Non-CJI limited pilot** may proceed only with explicit agency acceptance of residual risks, documented compensating controls, and strict scope boundaries.

## CJIS Pre-Pilot Checklist

- [ ] P0 engineering controls implemented and tested (auth fail-closed, CSRF, CSP, retention, AI minimization).
- [ ] WAF enabled and verified in pilot environment.
- [ ] CloudTrail + immutable retention evidence collected.
- [ ] KMS/encryption-at-rest and TLS controls verified in deployed stacks.
- [ ] Cross-tenant denial and public-token abuse tests passed.
- [ ] Auth/audit event coverage verified for login failure/success and admin actions.
- [ ] Backup + restore drill completed with documented RTO/RPO.
- [ ] Incident response tabletop executed and action items closed.
- [ ] Vulnerability scanning enabled with triage SLA and release gate.
- [ ] CJIS legal/policy artifacts executed (security addendum, agency agreements, support controls).

## Appendix: Files Reviewed

- `apps/api/src/lib/auth.ts`
- `apps/api/src/lib/authz.ts`
- `apps/api/src/lib/incidentReadAccess.ts`
- `apps/api/src/lib/runtimeSecrets.ts`
- `apps/api/src/lib/auditDisplay.ts`
- `apps/api/src/lib/writeAdminAudit.ts`
- `apps/api/src/services/incidentService.ts`
- `apps/api/src/services/platformCommandService.ts`
- `apps/api/src/services/mediaService.ts`
- `apps/api/src/services/silentTextService.ts`
- `apps/api/src/services/multilingualCallService.ts`
- `apps/api/src/voice/stt/sttOrchestrator.ts`
- `apps/api/src/voice/translation/translationProviderFactory.ts`
- `apps/api/src/voice/aws/awsTranscribeSttProvider.ts`
- `apps/api/src/voice/google/googleSpeechSttProvider.ts`
- `apps/api/src/voice/google/googleTranslationProvider.ts`
- `apps/api/src/voice/azure/azureSpeechSttProvider.ts`
- `apps/api/src/voice/azure/azureTranslatorProvider.ts`
- `apps/api/src/ai/aiConfig.ts`
- `apps/api/src/ai/prompts.ts`
- `apps/api/src/ai/providers/openaiAdapter.ts`
- `apps/api/src/ai/providers/anthropicAdapter.ts`
- `apps/api/src/ai/providers/bedrockAdapter.ts`
- `apps/api/src/repositories/auditRepository.ts`
- `apps/web/lib/auth/apply-auth-cookies.ts`
- `apps/web/lib/auth/verify-cognito.ts`
- `apps/web/lib/auth/roles.ts`
- `apps/web/middleware.ts`
- `apps/web/next.config.ts`
- `apps/web/app/api/auth/signin/route.ts`
- `apps/web/app/api/auth/signout/route.ts`
- `apps/web/app/api/auth/session/route.ts`
- `apps/web/app/api/auth/refresh-cookies/route.ts`
- `apps/web/app/api/backend/[[...path]]/route.ts`
- `apps/desktop-macos/RapidCortexDesktop/RapidCortexDesktop/KeychainTokenStore.swift`
- `apps/desktop-macos/RapidCortexDesktop/RapidCortexDesktop/CognitoWebAuthCoordinator.swift`
- `apps/desktop-macos/RapidCortexDesktop/RapidCortexDesktop/LoginView.swift`
- `apps/desktop-windows/src/RapidCortexDesktop.Wpf/Services/ProtectedTokenStore.cs`
- `apps/desktop-windows/src/RapidCortexDesktop.Wpf/Services/CognitoPkceAuth.cs`
- `infra/template.yaml`
- `infra/web-hosting-template.yaml`
- `infra/iam/sam-deploy-policy.json`
- `docs/deployment-infrastructure/CI_RELEASE_PIPELINE.md`
- `docs/SECURITY_MODEL.md`
- `docs/AUTH_OPERATIONS.md`
- `docs/AUDIT_EVENT_MATRIX.md`
- `docs/PILOT_AWS_DEFENSE.md`
- `docs/BACKUP_AND_RECOVERY.md`
- `docs/MONITORING_AND_OPS.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/ESCALATION_PATHS.md`
- `docs/PRIVACY_RETENTION_DECISIONS.md`
- `docs/TRANSCRIPT_RETENTION_POLICY.md`
- `docs/AI_PROVIDER_CONFIGURATION.md`
- `docs/PILOT_GOVERNANCE.md`
- `docs/PILOT_READINESS_CHECKLIST.md`
- `docs/SALES_BOUNDARIES.md`
- `docs/NON_GOALS.md`
- `docs/NEXT_DEPLOY_BLOCKERS.md`
