# Demo debt inventory — pilot vs training surfaces

This document tracks **demo-oriented** behavior in the repo and how it is **gated**, **disabled**, **implemented**, or **documented as a non-goal** for first-agency pilot hardening.

| Area | Location / pattern | Pilot stance | Resolution |
|------|-------------------|--------------|------------|
| Mock incident queue | `apps/web/lib/queries.ts` + `isOfflineDemoDataEnabled()` | **Off by default** | Only returns mock list/detail/transcript/analysis when `NEXT_PUBLIC_OFFLINE_DEMO_MODE=1`; otherwise empty/errors with explicit message to configure API. |
| Scripted transcript on dashboard | `TranscriptChunkPlayer` in `dashboard-workspace.tsx` | **Off by default** when API configured | Gated by `isTrainingTranscriptToolbarEnabled()` (`NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM=1` or offline demo mode). When the API is live but the flag is off, copy points to `/demo` or the env flag. When the API is **not** wired and offline demo is off, a strip explains how to configure the API or opt into local mock mode. |
| `/demo` route & demo API | `apps/web/app/**/demo`, `/api/demo/*`, `DemoRunner` | **Non-goal for live ops** | Documented in [NON_GOALS.md](./NON_GOALS.md) §5; isolated from production incident creation. |
| Top bar agency/email | `components/dispatch/top-bar.tsx` | No fake tenant | Replaced hard-coded “Demo Communications” / `demo@…` with loading/empty/auth-not-configured states; API badge says **Offline** instead of “Mock data”. |
| Default jurisdiction slug | `lib/marketing-links.ts`, sign-out redirect | No `demo` tenant implication | Fallback slug is **`example-city`**; sign-out reuses `defaultJurisdictionSlug()`. |
| Transcript panel label | `transcript-panel.tsx` | Accurate wording | Header **Transcript** (not “Live transcript”) while streaming indicator still reflects activity. |
| Admin retention sample | `admin/settings/page.tsx` | Neutral sample id | `getDefaultPolicy("tenant-default")` instead of `agency-demo`. |
| Admin home “Environment” card | `admin/page.tsx` | Honest description | Copy describes read-only operator map, not “deployment placeholders”. |
| Supervisor operator list | `supervisor-workspace.tsx` | Honest placeholder | Bullet text no longer says “demo”; states presence not wired. |
| Agency billing UI | `admin/billing/agency/[agencyId]/page.tsx` | Honest partial product | Square section reframed as read-only external IDs with pointer to `NON_GOALS.md`; plan-change helper text warns about dev placeholders without a subscription id. |
| Webhook ingress card | `admin/integrations/page.tsx` | Roadmap labeled | Section titled “Webhook ingress (roadmap)” with policy-oriented copy. |
| Build-time workspace probe | `lib/phase1-workspace.ts` | Naming hygiene | Return field `sharedScenarioCatalogSize` (still counts `DEMO_SCENARIO_CATALOG` from shared package — name only). |
| Marketing home feature bullets | `(marketing)/page.tsx` | Intentional sales/training | Describes `/demo` as academy — acceptable; not the signed-in pilot shell. |
| `mock-dashboard-store`, `showcase` | `apps/web/lib/mock-dashboard-store.ts`, showcase routes | Non-pilot / layout | Not linked from pilot-critical nav; treat as internal or sales-only; expand this row if any pilot link is added. |
| Lambda AI `mock` provider | SAM defaults / `PRIMARY_PROVIDER` | Staging/dev only | [ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md); pilot/prod mappings use real providers; `AI_ALLOW_MOCK_ONLY_IN_PROD` is escape hatch only. |
| GTM / onboarding packaging | `docs/GTM_PACKAGE.md`, **Admin → Pilot hub** | Pilot operations | Centralizes evaluation → support lifecycle; optional `NEXT_PUBLIC_DOCUMENTATION_BASE_URL` for hosted doc links ([GTM_PACKAGE.md](./GTM_PACKAGE.md)). |

## What was fixed (this pass)

- Dashboard transcript trainer **default-off** for API-configured hosts unless `NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM=1` (still on automatically with offline demo mode for local-only), plus an **explicit no-API** transcript strip when neither API nor offline demo is enabled.
- Top bar **removed fake agency/email** and **renamed** the no-API badge to **Offline** with a truthful tooltip.
- **Default slug** fallback **`example-city`** and shared helper for sign-out redirect.
- **Transcript** panel title de-implies “live” ingest.
- Admin **retention** sample tenant id, **environment** card copy, **supervisor** operator bullet, **billing** Square/plan copy.
- **Docs**: `NON_GOALS.md` §5, `ENVIRONMENT_MATRIX.md`, `INSTALLATION.md` (including repaired “Related documents” list), `.env.example` alignment.
- **Inventory**: this file.

## What was deferred

- **Full Square OAuth / subscription sync** — remains a product/build backlog item; UI now states pilot cut and points to non-goals.
- **Live operator presence** on supervisor view — needs WebSocket/Cognito telemetry; placeholder section retained with honest copy.
- **Webhook ingress** — still placeholder component from integrations package; roadmap section only.
- **Showcase / mock-dashboard-store** — no behavioral change; confirm no pilot CTA links (spot-check before pilot marketing).

## Remaining product-risk areas

- **Misconfiguration**: pilot host with missing `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` lands on `example-city` URLs until fixed — acceptable fail-safe but must be in deploy checklist.
- **Billing API semantics**: plan changes may hit development placeholders when Square ids are absent — operators must verify API responses/logs.
- **AI provider chain**: incorrect Lambda env could still select `mock` in non-dev stages if someone overrides SAM — guarded by process/docs, not UI.
- **Training paths**: `/demo` and optional dashboard stream remain **legitimate** training vectors; pilot comms should clarify they are not production CAD ingest.
