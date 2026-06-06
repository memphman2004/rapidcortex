# HTTP API surface (pilot)

Source of truth for routes: **`infra/template.yaml`** (HTTP API events) and **`apps/api/src/handlers/*.ts`**. All authenticated routes use the **JWT authorizer** unless noted **NONE**. Tenancy: **`custom:agencyId`** on the JWT; **`platform_superadmin`** may require explicit `agencyId` query/body where documented.

Legend: **RBAC** = who may call; **Audit** = typical `AUDIT_EVENT_TYPES` rows (see `packages/security/src/audit-schema.ts`).

## Health & identity

| Method | Path | Auth | RBAC | Audit |
|--------|------|------|------|-------|
| GET | `/api/health` | NONE | — | — |
| GET | `/api/me` | JWT | any authenticated | — |

## Incidents & transcript (core pilot)

| Method | Path | Auth | RBAC | Validation | Audit |
|--------|------|------|------|------------|-------|
| GET | `/api/incidents` | JWT | agency users; **platform_superadmin** requires `?agencyId=` | — | — |
| POST | `/api/incidents` | JWT | dispatch-capable roles; **not** `readonly_auditor` | `createIncidentSchema` | `incident.created` |
| GET | `/api/incidents/{id}` | JWT | same agency / platform rules | — | — |
| PATCH | `/api/incidents/{id}` | JWT | dispatcher, supervisor, admin, platform | `patchIncidentDispatcherSchema` | `dispatcher.review_acknowledged` / `escalation.raised` |
| GET | `/api/incidents/{id}/transcript` | JWT | tenant + `AnalysisService`-style checks | — | — |
| POST | `/api/incidents/{id}/transcript` | JWT | tenant | `transcriptSegmentSchema`; multilingual strict gate | `transcript.segment_added` (+ translation audit when non-English) |
| POST | `/api/incidents/{id}/analyze` | JWT | tenant | orchestrator + Zod output | `analysis.created` / `analysis.failed` / `analysis.skipped` |
| GET | `/api/incidents/{id}/analysis` | JWT | tenant | — | — |

## Multilingual voice

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| POST | `/api/incidents/{id}/language-session/start` | JWT | strict multilingual env gate |
| POST | `/api/incidents/{id}/language-session/finalize` | JWT | same |
| GET | `/api/incidents/{id}/language-session/status` | JWT | same |
| POST | `/api/incidents/{id}/audio-chunks` | JWT | STT / translation pipeline; **201** new chunk, **200** idempotent replay same `sequence` |

## Admin & audit

| Method | Path | Auth | RBAC | Audit |
|--------|------|------|------|-------|
| GET | `/api/audit/events` | JWT | admin, supervisor, platform | — |
| GET | `/api/admin/users` | JWT | admin, platform | — |
| POST | `/api/admin/users` | JWT | admin, platform | `admin.user.create` |
| PATCH | `/api/admin/users` | JWT | admin, platform; agency admin same-agency only | `admin.user.update` |
| POST | `/api/admin/users/deactivate` | JWT | admin, platform; agency admin same-agency only | `admin.user.deactivate` |
| GET | `/api/integration/status` | JWT | **admin, platform only** | — |

## Agencies, invites, billing

| Method | Path | Auth | RBAC (summary) |
|--------|------|------|------------------|
| GET/POST | `/api/agencies` | JWT | list/create per `AgencyService` / platform |
| GET/PATCH | `/api/agencies/{id}` | JWT | agency admin or platform |
| GET/POST | `/api/agencies/{id}/invites` | JWT | admin + platform rules |
| GET/PATCH | `/api/agencies/{id}/billing-profile` | JWT | admin / billing |
| POST | `/api/agencies/{id}/billing/subscription/change` | JWT | admin |
| POST | `/api/agencies/{id}/billing/subscription/cancel` | JWT | admin |
| GET/POST | `/api/agencies/{id}/billing/invoices` | JWT | admin |
| GET/POST | `/api/agencies/{id}/billing/payment-methods` | JWT | admin |
| POST | `/api/agencies/{id}/billing/payment-methods/default` | JWT | admin |
| GET | `/api/billing/plans` | JWT | authenticated |
| POST | `/api/billing/square/webhook` | **NONE** | Square signature path (handler) |

## Demo (training — not live pilot default)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/demo/scenarios` | JWT |
| POST | `/api/demo/start` | JWT |

## Structured errors (AI)

`POST .../analyze` returns **non-2xx** JSON for controlled failures, e.g. `{ success: false, analysisStatus: "failed", errorCode, message, requestId }` — see `apps/api/src/handlers/analyzeIncident.ts` and `NormalizedAiError`.

## Related

- [CORE_USER_FLOWS.md](./CORE_USER_FLOWS.md) — UI ↔ API mapping.
- [phase-3/API_ROUTE_MAP.md](./phase-3/API_ROUTE_MAP.md) — earlier engineering map (may overlap).
- [AUTH_OPERATIONS.md](./AUTH_OPERATIONS.md) — auth edge cases.
