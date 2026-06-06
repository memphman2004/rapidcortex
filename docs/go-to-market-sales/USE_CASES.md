# Primary pilot use cases

Each use case assumes **authenticated** users, **agency-scoped** data, and **assistive** (non-authoritative) AI per [MVP_SCOPE.md](./MVP_SCOPE.md). UI ↔ API wiring: [CORE_USER_FLOWS.md](./CORE_USER_FLOWS.md).

## UC-1 — Triage with transcript and AI panel (dispatcher)

**Actor:** `dispatcher`  
**Goal:** Select an incident, read transcript lines (including multilingual badges when enabled), optionally refresh structured AI analysis, take notes / actions per agency policy.  
**Maturity:** **Live in pilot** when API + web env configured.  
**Does not:** Auto-dispatch, auto-CAD write, or replace dispatcher judgment.

## UC-2 — Supervisor second look (supervisor)

**Actor:** `supervisor`  
**Goal:** Review escalated or flagged incidents; validate AI summaries against SOP; use audit list where exposed.  
**Maturity:** **Live in pilot** (surfaces as implemented in web).  
**Does not:** Autonomous case closure without human action.

## UC-3 — Admin verifies health and users (admin)

**Actor:** `admin`  
**Goal:** Provision users with correct `custom:agencyId` / `custom:role`; open **Integrations** for `GET /api/integration/status`; sample **Audit**; use **Pilot hub** for onboarding trackers.  
**Maturity:** **Live in pilot**; integration panel reflects **admin-configured** multilingual/AI backend state.

## UC-4 — Academy / evaluation script (trainer or SE)

**Actor:** authenticated user with access to **`/demo`**  
**Goal:** Run scripted scenarios for training or **sales-consistent** evaluation—not live CAD ingest.  
**Maturity:** **Live in pilot** as isolated path ([NON_GOALS.md](./NON_GOALS.md) §5).  
**Does not:** Substitute for production incident creation workflows.

## UC-5 — Multilingual assist (when enabled)

**Actor:** dispatcher / voice pipeline integrator  
**Goal:** Language detection, STT, translation to English path, interpreter-review flags as implemented.  
**Maturity:** **Admin-configured** (tables, secrets, strict validation per stage) ([DEPLOYMENT_MULTILINGUAL_AWS.md](./DEPLOYMENT_MULTILINGUAL_AWS.md)).  
**Does not:** Remove interpreter judgment or guarantee accuracy ([KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md)).

## UC-6 — Protocol-aligned coaching

**Actor:** dispatcher  
**Goal:** View protocol pack–backed coaching where packs are approved and wired.  
**Maturity:** **Live in pilot** with **admin-configured** / agency-approved packs ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)).

## Related

- [FEATURE_MATRIX.md](./FEATURE_MATRIX.md)
- [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)
