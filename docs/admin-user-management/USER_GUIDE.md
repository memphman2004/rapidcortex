# Rapid Cortex — User guide

For **dispatchers**, **supervisors**, **agency administrators**, and **platform operators** using the web application (`apps/web`). Behavior matches **live API routes** documented in [API_SURFACE.md](./API_SURFACE.md) and [CORE_USER_FLOWS.md](./CORE_USER_FLOWS.md).

**County / city / municipality IT and comms leadership:** use **[JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md)** for install-on-screen, setup, maintenance, troubleshooting, and the recommended **download package** file list.

## What Rapid Cortex does

Rapid Cortex is a **browser-based co-pilot** for emergency communications workflows: **incidents**, **transcripts** (including **multilingual** segments when enabled), **AI-assisted analysis**, and **protocol-aligned coaching**. It sits **alongside** CAD, telephony, and radio—not as a replacement ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).

## URLs (jurisdiction slug)

Production is designed around **`www.rapidcortex.us`** with a **single path segment** for the jurisdiction (city, town, or county **name** as a slug), for example:

`https://www.rapidcortex.us/<slug>/dashboard`

Examples: `columbus`, `erie-county`, `upper-arlington`. Use **lowercase**, **hyphens** instead of spaces, and avoid reserved segments such as `api`.

- **Marketing / signup:** `https://www.rapidcortex.us/` (`/pricing`, `/signup`).
- **Default slug for CTAs:** `NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG` (see [INSTALLATION.md](./INSTALLATION.md)).

**Important:** The slug is for **URLs and branding**. **Authorization and tenant isolation** come from the **Cognito JWT** (`custom:agencyId`, `custom:role`) and the API—not from the slug alone.

## Signing in

1. Open your agency URL, e.g. `https://www.rapidcortex.us/<slug>/login`.
2. Sign in with **email and password** from your administrator (**Amazon Cognito** in pilot deployments).
3. Use the **training** vs **production** URL your IT team provides; do not mix environments.

### Roles (Cognito `custom:role`)

| Role | Typical use |
| --- | --- |
| **Dispatcher** (`dispatcher`) | Dashboard workspace: queue, transcript, intelligence, dispatch actions. |
| **Supervisor** (`supervisor`) | Review and escalation workflows; audit list where enabled. |
| **Agency admin** (`admin`) | Users, audit, integrations status, settings reference. |
| **Platform superadmin** (`platform_superadmin`) | Cross-agency tools where deployed. |
| **Read-only auditor** (`readonly_auditor`) | Read-focused; **cannot** create incidents. |

Exact RBAC per route: [API_SURFACE.md](./API_SURFACE.md). Admin workflows: [ADMIN_GUIDE.md](./ADMIN_GUIDE.md).

## Training (self-serve and classes)

- **Dispatcher:** [TRAINING_DISPATCHER.md](./TRAINING_DISPATCHER.md) — transcript badges (interpreter review, low confidence, STT/Tr %), Intelligence, uncertainty behavior.
- **Supervisor:** [TRAINING_SUPERVISOR.md](./TRAINING_SUPERVISOR.md)
- **Agency admin:** [TRAINING_ADMIN.md](./TRAINING_ADMIN.md)
- **Printable one-pager:** [QUICKSTART_CARD.md](./QUICKSTART_CARD.md) · **Day one:** [FIRST_DAY_CHECKLIST.md](./FIRST_DAY_CHECKLIST.md) · **Task steps:** [COMMON_TASKS.md](./COMMON_TASKS.md)
- **Trainer-led 20 min:** [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md)

## Pilot & onboarding (admins)

Agency **admin** users should start from **`/{slug}/admin/pilot`** (**Pilot hub** in the admin nav). It links the go-to-market documentation package, promise-vs-scope matrix, in-app admin shortcuts, **agency onboarding milestones** (ordered runbook tracker), and a **browser-local** GTM phase tracker for working sessions. Use **`/{slug}/admin/configuration`** for **read-only** web env + pilot flags + integration/AI/multilingual summary. Authoritative procedures: [AGENCY_ONBOARDING_RUNBOOK.md](./AGENCY_ONBOARDING_RUNBOOK.md), [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md), [GTM_PACKAGE.md](./GTM_PACKAGE.md), [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md). Product definitions for sales alignment: [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md), [FEATURE_MATRIX.md](./FEATURE_MATRIX.md).

## Connections strip (bottom of screen)

The **Connections** bar summarizes configuration:

- **Rapid Cortex API — Live backend** when `NEXT_PUBLIC_AUTH_PROXY=1` (cookie proxy to `API_UPSTREAM_BASE`) or `NEXT_PUBLIC_API_BASE` is set.
- **Offline / training** when neither is set: the **incident queue is empty** (no fake incidents) unless an engineer explicitly sets **`NEXT_PUBLIC_OFFLINE_DEMO_MODE=1`** for local demos ([ENVIRONMENT_MATRIX.md](./ENVIRONMENT_MATRIX.md)).

## Dispatcher workspace (`/<slug>/dashboard`)

| Area | Live behavior |
| --- | --- |
| **Incident queue** | `GET /api/incidents` — open incidents for your **agency** (`?incident=` selects detail). |
| **Detail** | `GET /api/incidents/{id}`, transcript, newest analysis. |
| **Transcript** | Segments from **API** (manual POST, voice/multilingual pipeline, or integrations). Lines may show **language**, **confidence**, **interpreter review**, and **fallback** badges when the backend populated those fields. |
| **Training stream** (toolbar) | Scripted chunks for drills; when the API is **live**, each chunk is **`POST .../transcript`** — not live radio. |
| **Intelligence** | `POST .../analyze` — structured errors (e.g. unchanged transcript) show with **error codes** and **`requestId`** when returned. |
| **Dispatch actions** | `PATCH /api/incidents/{id}` (`mark_reviewed`, `escalate_supervisor`). |

Treat transcript text as **sensitive operational data**. AI output is **decision support**, not orders ([MVP_SCOPE.md](./MVP_SCOPE.md)).

## Demo and training (`/<slug>/demo`)

Scripted **demo scenarios** (`GET /api/demo/scenarios`, `POST /api/demo/start`) for **training and walkthroughs**—auth required. The **demo** route is for exercises, not production CAD replacement ([NON_GOALS.md](./NON_GOALS.md)).

## History (`/<slug>/history`)

`GET /api/incidents` with client-side filters; row links to `/<slug>/history/[id]` for the same read paths as the dashboard.

## Supervisor review (`/<slug>/review`)

Second-line review of incidents that need attention per your SOP; software provides queues and detail views.

## Admin hub (`/<slug>/admin/...`)

See [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) for **Users**, **Audit**, **Integrations**, **Settings**, billing, and platform agency tools.

## Billing (where enabled)

Billing UIs depend on environment (e.g. Square). Treat as **production-sensitive**; follow finance process.

## Getting help

| Issue | Contact |
| --- | --- |
| Login / password / MFA | Agency IT or IdP admin ([SUPPORT_MODEL.md](./SUPPORT_MODEL.md)). |
| API offline / empty live data | Operations — [RUNBOOK.md](./RUNBOOK.md), [MONITORING_AND_OPS.md](./MONITORING_AND_OPS.md). |
| Wrong role or agency | Agency admin or platform operator ([ADMIN_GUIDE.md](./ADMIN_GUIDE.md)). |
| Outage or suspected breach | [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md). |
| CAD / radio / 911 vendor | **That vendor** — Rapid Cortex does not operate those systems. |

## Training and limitations

- **Quick training outline:** [TRAINING_QUICKSTART.md](./TRAINING_QUICKSTART.md)
- **Honest scope limits:** [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)

## Related documents

- [JURISDICTION_OPERATIONS_GUIDE.md](./JURISDICTION_OPERATIONS_GUIDE.md) — agency IT + admin: access, setup, maintenance, troubleshooting, download bundle.
- [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) — admin and platform workflows.
- [SUPPORT_MODEL.md](./SUPPORT_MODEL.md) — routing expectations.
- [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) — operational and security incidents.
- [CORE_USER_FLOWS.md](./CORE_USER_FLOWS.md) — screen → API mapping.
- [API_SURFACE.md](./API_SURFACE.md) — HTTP inventory + RBAC.
- [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) — pre-launch checklist.
- [INSTALLATION.md](./INSTALLATION.md) — environment configuration.
- [RUNBOOK.md](./RUNBOOK.md) — operator response to outages.
- [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md) — CAD integration posture.
