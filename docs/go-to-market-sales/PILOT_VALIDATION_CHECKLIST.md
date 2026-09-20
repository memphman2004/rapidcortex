# Pilot validation checklist

**Last reviewed:** 2026-09-19 (60-day refresh) · **Owner:** Jeff Coleman

Use this list before widening access to a new agency or jurisdiction. It complements [INSTALLATION.md](../deployment-infrastructure/INSTALLATION.md), [DEPLOYMENT.md](../deployment-infrastructure/DEPLOYMENT.md), and [MONITORING_AND_OPS.md](../operations-runbooks/MONITORING_AND_OPS.md). Operational onboarding context: [GTM_PACKAGE.md](./GTM_PACKAGE.md) and in-app **Admin → Pilot hub**.

## Pre-flight (same day as go-live)

- [ ] **Stack outputs** recorded: `HttpApiUrl`, `UserPoolId`, `UserPoolClientId`, `OpsAlertsTopicArn`, `PilotOperationsDashboardName`.
- [ ] **Cognito MFA ON** for the production pool (`MfaConfiguration=ON`) — spot-check one user TOTP challenge ([AUTH_OPERATIONS.md](../product-architecture/AUTH_OPERATIONS.md)).
- [ ] **SNS subscription** active on `OpsAlertsTopic` (email, Chatbot, or paging bridge).
- [ ] **CloudWatch dashboard** opens and shows recent traffic for the stage.
- [ ] **CORS** `HttpApiCorsAllowedOrigins` matches real web origins (not `*` in pilot).
- [ ] **Web env** `NEXT_PUBLIC_API_BASE` or auth proxy + `API_UPSTREAM_BASE` aligned with stack URL.
- [ ] **`NEXT_PUBLIC_OFFLINE_DEMO_MODE` is unset** (or not `1`) so operators never see a fake incident queue on pilot hosts.
- [ ] **Multilingual** secrets and `MULTILINGUAL_STRICT_VALIDATION` per [LANGUAGE_TRANSLATION_CONFIGURATION.md](../product-architecture/LANGUAGE_TRANSLATION_CONFIGURATION.md).
- [ ] **Post-deploy smoke:** `./scripts/post-deploy-smoke.sh <stage> <region>` — **pass**.
- [ ] **Authenticated smoke (recommended):** set `SMOKE_TEST_USERNAME` / `SMOKE_TEST_PASSWORD` for a pilot test user; script must pass `/api/me` and accept `/api/integration/status` 200 or 403.
- [ ] **Synthetic script dry run:** `API_BASE_URL=<HttpApiUrl> ./scripts/synthetic-api-health.sh` — **pass**.
- [ ] **DynamoDB PITR** enabled for the stage (live lock-in on `deploy.sh dev`).

## Functional smoke (manual, first operator session)

- [ ] Sign-in web app **with MFA**; jurisdiction slug resolves.
- [ ] **Create incident** (dispatcher).
- [ ] **List / open incident**; tenant cannot see other agency IDs (spot-check with two test accounts if available).
- [ ] **Append transcript** segment; verify list/history UI updates.
- [ ] **Multilingual:** start language session, post audio chunk (or smallest test clip policy allows); verify segments and English path in UI.
- [ ] **AI analyze:** manual analyze returns structured result or documented error (e.g. transcript unchanged).
- [ ] **Admin:** integrations page loads for admin-capable user; audit page lists recent events.

## Performance sanity (optional same week)

- [ ] `./scripts/pilot-load-smoke.sh` with expected `CONCURRENCY` / `REQUESTS` — no sustained 5xx.
- [ ] Review **Lambda concurrent executions** and **IntegrationLatency** on dashboard during a busy exercise.

## Post-incident / rollback readiness

- [ ] Team knows **git tag** or artifact ID of last known-good API + web deploy.
- [ ] [RUNBOOK.md](../operations-runbooks/RUNBOOK.md) rollback section reviewed; **DynamoDB PITR** enabled for stage.
- [ ] [BACKUP_AND_RECOVERY.md](../operations-runbooks/BACKUP_AND_RECOVERY.md) restore drill scheduled within 30 days (SOC 2 SOP: [restore-drill.md](../security-compliance/soc2/processes/restore-drill.md)).

## Sign-off

- [ ] Product / ops owner name: ________________
- [ ] Date: ________________
