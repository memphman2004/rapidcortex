# MVP feature list and build order

**Product scope narrative** (pilot story, assistive AI, roles): [../MVP_SCOPE.md](../MVP_SCOPE.md). **Non-goals:** [../NON_GOALS.md](../NON_GOALS.md).

The numbered list below is the engineering feature checklist; keep it aligned when MVP_SCOPE changes.

## MVP scope (in scope)

1. **Dispatcher dashboard** — Incident queue, incident workspace, live transcript panel, AI recommendation panel, protocol coach strip, basic timeline / status.
2. **Demo mode** — Scenario runner with **simulated transcript streaming**; reset / canned flows for sales and UX.
3. **Public showcase (optional)** — Low-friction UI slice for demos at **`https://www.rapidcortex.us/<city-town-or-county-slug>/showcase`** where product policy allows.
4. **Cognito auth** — Login, session, **agency-scoped** data access, roles: dispatcher, supervisor, admin.
5. **Incidents API** — Create, list, get; agency isolation on all paths.
6. **Transcript API** — Append segments (timestamped, speaker-labeled); list history; triggers for analysis (debounced / manual refresh as implemented).
7. **AI analysis** — Provider abstraction with **fallback**; **Zod**-validated fields: category, urgency, confidence, nextQuestion, recommendedAction, summary, rationale, escalationFlag.
8. **Protocol engine** — Pack-based selection; current step + suggested phrase + escalation text from packs; attach snapshot to analysis.
9. **Supervisor** — Review queue / incident read with transcript + analyses (workflow depth as implemented per sprint).
10. **Admin** — User listing / basic admin actions; audit log viewer; settings placeholders (integrations, retention, compliance).
11. **Audit events** — Key actions logged (incident, transcript, analysis, admin) with agency + actor + resource hints.
12. **Integration placeholders** — Adapter interfaces + mock health for UI “integration status” strip.

## Build order (engineering)

1. **Contracts** — `packages/shared` types + Zod; API response shapes; constants.
2. **Web app shell** — `apps/web` routes under **`https://www.rapidcortex.us/<city-town-or-county-slug>/…`**, layout, role-gated nav.
3. **API + persistence** — `apps/api` Lambda handlers, Dynamo repositories, authz guards.
4. **Transcript sim → contract** — Same segment model as future Transcribe path.
5. **AI pipeline** — Providers + persistence + UI.
6. **Protocol packs** — `packages/protocols` as versioned surface (may re-export shared defaults initially).
7. **Supervisor / admin / audit** — Vertical slices with audit on each mutation.
8. **Integrations package** — Mock adapters + health API.

## Exit criteria (Phase 0 + MVP alignment)

- [ ] Stakeholders agree **MVP list** ([mvp-features.md](./mvp-features.md)) and **[NON_GOALS.md](../NON_GOALS.md)**.
- [ ] Pilot story for **Columbus / Erie** is written and demoable on **sim data**.
- [ ] **Build order** above is the default for tickets and PRs.
