# Phase 2 — Dashboard UI with mock / live demo data

**Goal:** Product proof in the browser — sales demo and UX validation without blocking on integrations.

## Implemented UI

- **Shell:** `TopBar` (agency, role, API/mock pill, **environment badge**), `SideNav`, main column + **`ConnectionStatusStrip`** (API + planned integrations).
- **Dashboard:** Selectable incidents (`IncidentCard` / queue), **`IncidentTimelineStrip`**, transcript with **`TranscriptLine`**, simulated chunk player, **`AiRecommendationPanel`** with **`ConfidenceMeter`**, **`AiRecommendationCard`**, **`SummaryCard`**, **`DispatchActionPanel`**, protocol coach when present.
- **Data:** `lib/mock-data.ts` + aggregated **`lib/mock-dashboard-store.ts`**; React Query in `DashboardWorkspace` with **error banner** when loads fail.
- **Routes:** Login, dashboard, history + detail, demo runner, supervisor, admin — all under **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`** (`apps/web/app/[jurisdiction]/`).

## Exit criteria

- Looks like a **credible operations product** on mock data.
- **Selectable incidents**, transcript playback, AI refresh / panel updates, demo scenarios.
- Optional: point `NEXT_PUBLIC_AUTH_PROXY=1` + API at deployed stack for **live** data (Phase 3 contract).
