# Pilot readiness checklist — run log

**Instructions:** when executing [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md), copy this file per run (e.g. `PILOT_READINESS_RUN_RESULTS-2026-04-23-pilot.md`) or append dated sections here. Mark each line **PASS** / **FAIL** / **N/A** with **owner** and **evidence** (log URL, commit SHA, console screenshot, ticket).

| # | Checklist item (summary) | Result | Notes |
|---|---------------------------|--------|--------|
| 1.1 | Agency SOW / assistive use |  |  |
| 1.2 | MVP / NON_GOALS acknowledged |  |  |
| 1.3 | Roles + `custom:agencyId` |  |  |
| 1.4 | Human-in-the-loop communicated |  |  |
| 1.5 | Protocol review process |  |  |
| 1.6 | Privacy / retention signed |  |  |
| 1.7 | Agency playbook complete |  |  |
| 2.1 | Environments deployed |  |  |
| 2.2 | CORS not `*` in production |  |  |
| 2.3 | Secrets configured |  |  |
| 2.4 | `REVISION` / `GIT_SHA` on Lambdas |  |  |
| 3.1 | Next.js API connected |  |  |
| 3.2 | No offline demo mode on live pilot |  |  |
| 3.3 | Post-deploy smoke green |  |  |
| 4.1 | AI not mock-only in prod (unless explicit) |  |  |
| 4.2 | Provider IAM / secrets |  |  |
| 5.1 | Multilingual table + validation |  |  |
| 5.2 | `GET /api/integration/status` clean |  |  |
| 6.1 | `ALLOW_UNAUTHENTICATED_API` posture |  |  |
| 6.2 | Audit route exercised |  |  |
| 7.1 | Alarms + SNS / on-call |  |  |
| 7.2 | On-call knows health + alarm semantics |  |  |
| 8.1 | `npm run build` + `sam validate` |  |  |
| 8.2 | Staging pilot test executed |  |  |
| 9.1 | Onboarding / admin runbooks |  |  |
| 9.2 | Admin pilot hub walkthrough |  |  |
| 9.3 | Admin training checklist |  |  |
| 9.4 | Dispatcher training checklist |  |  |
| 10.1 | USER_GUIDE with agency URL |  |  |
| 10.2 | Risk register reviewed |  |  |

**Infra / security extras (pilot program):**

| Item | Result | Notes |
|------|--------|--------|
| WAF on API (`EnableApiWaf=true`) |  | [PILOT_AWS_DEFENSE.md](./PILOT_AWS_DEFENSE.md) |
| `SnsEmailSubscription` confirmed |  |  |
| `TRANSCRIPT_RETENTION_POLICY_DAYS` / parameter set (if required) |  | [TRANSCRIPT_RETENTION_POLICY.md](./TRANSCRIPT_RETENTION_POLICY.md) |
| Cognito callback URLs = web + desktop + staging |  |  |

**Sign-off:** _______________________ **Date:** __________
