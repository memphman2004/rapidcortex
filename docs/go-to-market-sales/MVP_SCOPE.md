# MVP scope — product definition (pilot-aligned)

**Canonical scope document** for what Rapid Cortex delivers in **MVP** and the **first controlled agency pilot**. Engineering build order and ticket-level detail remain in [phase-0/mvp-features.md](./phase-0/mvp-features.md). Boundaries and exclusions are in [NON_GOALS.md](./NON_GOALS.md).

## Pilot story (first agency)

A single public-safety communications organization runs Rapid Cortex **in the browser** as an **assistive layer** next to existing CAD, telephony, and radio: authenticated staff open their agency URL, work **agency-scoped incidents**, see **transcripts** (simulated, demo, or production-sourced per deployment), receive **structured AI analysis** (classification, summary, suggested questions, escalation signals—never dispatch authority), and see **protocol-aligned coaching** where packs are configured. **Supervisors** review flagged work; **admins** manage users and operational visibility (audit, integration status). Success is measured by **safe assistive use**, **operational credibility**, and **governance**—not feature breadth (see [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md)).

Columbus / Erie-style **single-agency** assumptions from early framing remain valid: dedicated environment discipline, training-heavy rollout, and SOP variance handled via agency configuration and playbooks—not universal multi-agency GA (see [NON_GOALS.md](./NON_GOALS.md)).

## Assistive AI — operational meaning

**Assistive AI** in this product means:

- Outputs are **decision support** for trained staff; they **do not** create dispatch decisions, medical diagnoses, or CAD/radio actions.
- Persisted AI fields are **schema-bound** (validated shapes); the product avoids presenting invented procedures as authoritative clinical or tactical doctrine.
- Staff and agency policy **override** any suggestion; UI and docs state this explicitly ([USER_GUIDE.md](./USER_GUIDE.md), [PILOT_GOVERNANCE.md](./PILOT_GOVERNANCE.md)).
- **Protocol phrases and stepwise operational guidance** shown as “protocol guidance” depend on **agency-approved protocol packs** and review rules—not on unconstrained LLM prose for those surfaces ([PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md)).

## Supported user roles (RBAC)

Roles are enforced via Cognito **`custom:role`** (and **`custom:agencyId`** for tenancy). Conceptual mapping:

| Role | MVP / pilot responsibility |
|------|----------------------------|
| **dispatcher** | Primary workspace: incidents, transcript, AI panel, protocol hints. |
| **supervisor** | Review queues, second look at escalations and flagged AI output per agency SOP. |
| **admin** | Agency users, settings surfaces, audit views, integration status; invites where APIs are enabled. |
| **platform_superadmin** | Rapid Cortex operators only; cross-agency capabilities guarded in API—**not** a general agency role. |

The URL jurisdiction **slug** is for routing and branding; **authorization is JWT + API**, not slug guessing ([USER_GUIDE.md](./USER_GUIDE.md), [phase-4/AUTH_AND_TENANCY.md](./phase-4/AUTH_AND_TENANCY.md)).

## In scope (MVP product surface)

1. **Dispatcher dashboard** — Incident queue, workspace, transcript panel, AI recommendation panel, protocol coach / timeline as implemented.
2. **Authentication** — Cognito-backed login; agency-scoped data access; role-gated navigation.
3. **Incidents** — Create, list, get; agency isolation on API paths.
4. **Transcripts** — Append and list timestamped segments; drives debounced / manual analysis triggers as implemented.
5. **AI analysis** — Provider abstraction with fallback; structured fields (e.g. category, urgency, confidence, questions, actions, summary, rationale, escalation).
6. **Protocol engine** — Pack-based selection; coaching copy and steps from packs; snapshots attached to analysis where implemented.
7. **Supervisor** — Review paths and read-only depth per sprint.
8. **Admin** — Users, audit log access, settings / integrations surfaces (connectors may be placeholders until vendor work completes).
9. **Audit events** — Mutations and sensitive reads logged with agency + actor + resource hints where implemented.
10. **Demo / training** — Scenario runner and simulated transcript for **non-live** training; isolated from pilot default operations ([NON_GOALS.md](./NON_GOALS.md#demo-and-training-paths-isolated)).
11. **Integration layer** — Adapter interfaces, health/status APIs, documented paths for CAD/audio (per [INTEGRATIONS_CAD_AND_MOTOROLA.md](./INTEGRATIONS_CAD_AND_MOTOROLA.md)).

## Deployment model

- **Web-first**: browser application; no native desktop client as primary delivery ([NON_GOALS.md](./NON_GOALS.md)).
- **Side-by-side**: intelligence layer beside CAD/phone/radio; no requirement to replace PSAP core systems in MVP.

## Related documents

| Document | Use |
|----------|-----|
| [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md) | Sales- and buyer-safe summary (defers here for scope) |
| [FEATURE_MATRIX.md](./FEATURE_MATRIX.md) | Feature **maturity** at a glance (defers here if conflict) |
| [phase-0/mvp-features.md](./phase-0/mvp-features.md) | Detailed feature list + **engineering build order** |
| [phase-0/product-one-pager.md](./phase-0/product-one-pager.md) | Narrative one-pager (tone, metrics—aligned with this scope) |
| [NON_GOALS.md](./NON_GOALS.md) | Explicit exclusions |
| [PILOT_READINESS_CHECKLIST.md](./PILOT_READINESS_CHECKLIST.md) | Launch readiness checklist |
| [PRIVACY_RETENTION_DECISIONS.md](./PRIVACY_RETENTION_DECISIONS.md) | What is stored, retention, export/delete expectations |
| [PROTOCOL_REVIEW_REQUIREMENTS.md](./PROTOCOL_REVIEW_REQUIREMENTS.md) | Governance for protocol-backed UI |
