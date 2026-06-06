# API route map (HTTP API — `apps/api`)

**Pilot-oriented inventory (RBAC + audit notes):** [../API_SURFACE.md](../API_SURFACE.md).

Base URL: API Gateway stage URL (see `infra/template.yaml` output `HttpApiUrl`).  
Web app calls either **`NEXT_PUBLIC_API_BASE`** (direct) or **`/api/backend`** BFF proxy with cookies (`NEXT_PUBLIC_AUTH_PROXY=1`).

**Browser (Next.js) URLs** are separate: the product UI is served at **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`** (e.g. dashboard at `…/columbus/dashboard`). The table below lists **backend** HTTP API paths only (`/api/...`).

| Method | Path | Handler | Auth | Description |
|--------|------|---------|------|-------------|
| GET | `/api/health` | `health` | Optional | Liveness |
| POST | `/api/incidents` | `createIncident` | JWT | Create incident for caller’s agency |
| GET | `/api/incidents` | `listIncidents` | JWT | List incidents for agency (GSI) |
| GET | `/api/incidents/{id}` | `getIncident` | JWT | Get incident if same agency |
| POST | `/api/incidents/{id}/transcript` | `addTranscriptChunk` | JWT | Append transcript segment |
| GET | `/api/incidents/{id}/transcript` | `listTranscript` | JWT | List segments for incident |
| POST | `/api/incidents/{id}/analyze` | `analyzeIncident` | JWT | Run AI + persist analysis + audit |
| GET | `/api/incidents/{id}/analysis` | `getIncidentAnalysis` | JWT | Newest-first analyses |
| GET | `/api/demo/scenarios` | `demoScenarios` | Varies | List demo scenario metadata |
| POST | `/api/demo/start` | `startDemoScenario` | JWT | Seed demo incident + transcript |
| GET | `/api/audit/events` | `listAuditEvents` | JWT | Agency audit stream |
| GET | `/api/admin/users` | `adminListUsers` | Admin JWT | Cognito list users |
| POST | `/api/admin/users` | `adminCreateUser` | Admin JWT | Create user |
| PATCH | `/api/admin/users` | `adminUpdateUser` | Admin JWT | Update attributes |
| POST | `/api/admin/users/deactivate` | `adminDeactivateUser` | Admin JWT | Disable user |

> Exact admin paths may match `lib/api.ts` — align handlers and client on change.

## Response shape

- Success: JSON body (resource or `{ items: [...] }`).
- Error: `{ "error": "message" }` with 4xx/5xx (see `packages/shared` `apiErrorBodySchema`).
