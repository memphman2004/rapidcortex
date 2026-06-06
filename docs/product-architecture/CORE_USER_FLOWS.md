# Core user flows (pilot)

Pilot assumption: **`NEXT_PUBLIC_AUTH_PROXY=1`** and **`API_UPSTREAM_BASE`** point at the **same** stack as Cognito (`docs/ENVIRONMENT_MATRIX.md`). When the API is **not** configured, the dispatcher UI stays **empty of fake incidents** unless **`NEXT_PUBLIC_OFFLINE_DEMO_MODE=1`** is explicitly set (local/sales only). **Do not** ship a live pilot without a configured API.

## Dispatcher — live workspace

| UI | API / behavior |
|----|----------------|
| `/<slug>/dashboard` | `GET /api/incidents` → queue; `?incident=` selection. |
| Incident detail strip | `GET /api/incidents/{id}`, `GET .../transcript`, `GET .../analysis` (newest analysis). |
| Transcript chunk player (simulated stream) | When enabled (`NEXT_PUBLIC_ENABLE_TRAINING_TRANSCRIPT_STREAM=1` or offline demo mode) and API configured: `POST .../transcript` per chunk; otherwise use `/demo` ([NON_GOALS.md](./NON_GOALS.md) §5). |
| Refresh AI | `POST .../analyze`; errors shown in Intelligence panel (`AnalyzeIncidentError`). |
| Dispatch actions | `PATCH /api/incidents/{id}` (`mark_reviewed`, `escalate_supervisor`). |

## Dispatcher / supervisor — history

| UI | API |
|----|-----|
| `/<slug>/history` | `GET /api/incidents` (filter client-side by status as implemented). |
| `/<slug>/history/[id]` | Same three GETs as dashboard detail. |

## Supervisor — review

| UI | API |
|----|-----|
| `/<slug>/review` | Uses incidents/analysis data per implementation (same tenant APIs). |
| `/<slug>/review/[id]` | Read paths for incident + transcript + analysis. |

## Admin

| UI | API |
|----|-----|
| `/<slug>/admin/pilot` | **Onboarding hub** — doc links (optional hosted base), admin shortcuts, agency **milestones** + GTM **phase** trackers (`localStorage`); no backend API. |
| `/<slug>/admin/configuration` | **Read-only** public web env + pilot flags + embedded `GET /api/integration/status` (same payload as Integrations). |
| `/<slug>/admin/users` | `GET/POST/PATCH` `/api/admin/users`, deactivate. |
| `/<slug>/admin/audit` | `GET /api/audit/events?limit=`. |
| `/<slug>/admin/integrations` | `GET /api/integration/status` (**admin** only). |
| `/<slug>/admin/settings` | **Operator map** — deploy-time env; not a live config API. |
| Platform agencies / billing | Under `admin/platform` and `admin/billing` — respective `/api/agencies` and billing routes; **RBAC** enforced in services. |

## Training / demo (non-live)

| UI | API |
|----|-----|
| `/<slug>/demo` | `GET /api/demo/scenarios`, `POST /api/demo/start` — **auth required**; not a substitute for production ingestion (`docs/NON_GOALS.md`). |

## Auth

| UI | API |
|----|-----|
| `/<slug>/login` | `POST /api/auth/signin`, `complete-new-password`, `session`, `refresh-cookies`. |
| Middleware | Protects `/dashboard`, `/history`, `/demo`, `/admin`, `/review`. |

## Verification checklist (pilot)

- [ ] `isApiConfigured()` **true** in production browser build.
- [ ] Create incident → appears in list → transcript POSTs persist → analyze returns **201** or structured error (not silent failure).
- [ ] Admin user CRUD only affects **same agency** (agency admin).
- [ ] Integration status loads for **admin**; forbidden for dispatcher (403).

See also [API_SURFACE.md](./API_SURFACE.md) and [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md).
