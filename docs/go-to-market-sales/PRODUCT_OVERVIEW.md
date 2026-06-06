# Product overview (sales- and buyer-safe)

**Purpose:** explain Rapid Cortex **truthfully** to agencies, procurement, and executives without duplicating authoritative scope. When anything conflicts, **[MVP_SCOPE.md](./MVP_SCOPE.md)** and **[NON_GOALS.md](./NON_GOALS.md)** win.

## What Rapid Cortex is

A **browser-based co-pilot** for public-safety communications staff: **agency-scoped incidents**, **transcripts** (including multilingual segments when the deployment enables that pipeline), **structured AI-assisted analysis** (classification, summary, suggested questions, escalation signals—**not** dispatch authority), and **protocol-aligned coaching** where approved packs are configured. It runs **alongside** CAD, telephony, and radio—not as a replacement for those systems of record ([NON_GOALS.md](./NON_GOALS.md)).

## Who it is for (pilot)

- **911 / ECC dispatchers** and call-takers using the product as **decision support** next to existing tools.
- **Supervisors** doing second-line review and escalation alignment with agency SOPs.
- **Agency administrators** provisioning users and reviewing audit and integration health surfaces.
- **Rapid Cortex platform operators** (`platform_superadmin`) for cross-agency tasks where deployed—not a general agency end-user role ([MVP_SCOPE.md](./MVP_SCOPE.md)).

See **[IDEAL_CUSTOMER_PROFILE.md](./IDEAL_CUSTOMER_PROFILE.md)** for fit / non-fit.

## Assistive AI (operational definition)

Same definition as [MVP_SCOPE.md](./MVP_SCOPE.md): outputs are **decision support**; humans and agency policy **override**; protocol-backed instructional phrases require **agency-approved packs** ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)); persistence is **schema-bound**; failures surface **degraded** states—no silent invention.

## Supported roles (Cognito)

| `custom:role` | Pilot use |
|---------------|-----------|
| `dispatcher` | Primary workspace ([USER_GUIDE.md](./USER_GUIDE.md)). |
| `supervisor` | Review + audit surfaces as implemented. |
| `admin` | Users, audit, integrations status, settings reference, pilot hub. |
| `platform_superadmin` | Platform / billing / agencies where enabled. |
| `readonly_auditor` | Read-oriented; cannot create incidents ([ADMIN_GUIDE.md](./ADMIN_GUIDE.md)). |

Tenancy is **`custom:agencyId` + API enforcement**, not the URL slug alone.

## Feature maturity (how to read our materials)

| Label | Meaning |
|-------|---------|
| **Live in pilot** | In baseline pilot build; works when stack + env are correctly configured. |
| **Pilot-limited** | Shipped but constrained (e.g. read-only billing IDs, roadmap webhook card). |
| **Admin-configured** | Requires deliberate Lambda / secrets / table setup (e.g. multilingual, AI provider chain). |
| **Future / not included** | Not promised for first-agency pilot; may exist as interfaces or docs-only roadmap ([PILOT_VS_FUTURE_STATE.md](./PILOT_VS_FUTURE_STATE.md)). |

Authoritative row-by-row capability view: **[FEATURE_MATRIX.md](./FEATURE_MATRIX.md)**.

## What we do not do

See **[NON_GOALS.md](./NON_GOALS.md)** and **[SALES_SCOPE_MATRIX.md](./SALES_SCOPE_MATRIX.md)**. Short list: no replacement for CAD/911 SoR; no certification marketing claims; no guaranteed vendor-wide CAD certification in baseline pilot; no unconstrained self-serve multi-tenant GA.

## Related documents

| Document | Audience |
|----------|----------|
| [PILOT_OVERVIEW.md](./PILOT_OVERVIEW.md) | Pilot-specific lens |
| [USE_CASES.md](./USE_CASES.md) | Primary pilot stories |
| [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) | Honest boundaries |
| [IMPLEMENTATION_ASSUMPTIONS.md](./IMPLEMENTATION_ASSUMPTIONS.md) | What implementations must assume |
| [GTM_PACKAGE.md](./GTM_PACKAGE.md) | Onboarding / GTM index |
| [ADMIN_SETUP_GUIDE.md](./ADMIN_SETUP_GUIDE.md) | Admin hub workflows + configuration visibility |
| [phase-0/product-one-pager.md](./phase-0/product-one-pager.md) | Narrative one-pager (aligned; not a scope override) |
