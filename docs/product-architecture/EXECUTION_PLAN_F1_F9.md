# Combined execution plan — F1–F9 (Build plan + checklist alignment)

This document **merges** the Feature Build Plan (architecture, order, acceptance) with the Feature Checklist posture (**✓ Have**, **~ Partial**, **B Build**, **→ Planned**, **N New**). It is the single place to decide **what to ship next** without duplicating foundations already marked **✓ Have**.

**Global rules** (from build plan): `agencyId` on all Dynamo access patterns, Zod from `packages/shared` before handler logic, RBAC at handler top via `rapid-cortex-security`, audit on meaningful mutations, full SAM surface (routes, IAM, tables, env, alarms), `NEXT_PUBLIC_ENABLE_*` UI gates, mocks for vendors, explicit IAM (no `*`), Secrets Manager ARNs only, multi-tenant isolation, **no cross-agency reads except active `IncidentShare`**, `sam validate --lint` after every template edit.

**N New** differentiators stay in [STEP8_NEW_DIFFERENTIATORS.md](./STEP8_NEW_DIFFERENTIATORS.md) until F1–F9 are stable.

---

## Legend

| Tag | Meaning |
|-----|--------|
| **✓** | Shipped in repo — **do not rebuild**; only patch for bugs, hardening, or checklist deltas. |
| **~** | Partial — extend only where a **current** phase item requires it. |
| **B** | Remaining build work for F1–F9 acceptance vs this doc + checklist. |
| **→** | Planned only if **strictly required** to unblock a higher-priority F item. |

---

## PHASE 0 — Foundation / gap audit (repo-confirmed)

### Authentication / tenancy — **✓**

- Cognito JWT / authorizer usage in API; Next middleware for `/admin`, `/supervisor`, `/shared-incoming`; `apps/web/app/api/backend/[[...path]]/route.ts` BFF proxy pattern; jurisdiction slug routes under `apps/web/app/[jurisdiction]/(dispatch)/`.

### Dispatcher workspace — **✓**

- Dashboard queue, transcript panel, AI panel, demo, history routes and components under dispatch shell.

### Supervisor / admin — **✓** (with **~** where noted)

- `/review`, `/admin/users`, `/admin/audit`, admin configuration, integration status; supervisor QA routes exist.

### AI / transcript — **✓**

- `AddTranscriptChunk`, `AnalyzeIncident`, Bedrock + provider chain, mock paths, auto-analyze N segments.

### Protocol — **✓**

- Protocol packs, hints, SOP detect handler path `POST /api/incidents/{id}/protocols/sop/detect`, agency SOP upload URL.

### Infrastructure — **✓** with **~**

- `infra/template.yaml`, core tables, S3 `AssetsBucket`, alarms for **many** Phase 1–2 Lambdas, stage params, CORS patterns.
- **~** Phase 4–5 Lambdas (caller card, performance, analytics, shares, aggregate): **alarms incomplete vs build plan** (see Phase 3/6).

### Integrations — **✓**

- `CadAdapter` + `MockCadAdapter`, health model, connector rollout, `/api/integration/status`.

### Repo layout (build plan §PHASE 0.1) — **✓**

- Web: `apps/web/app/[jurisdiction]/(dispatch)/…`, `apps/web/lib/api.ts`, handlers/services/repositories, `packages/shared/src/{qa,media,triage,wellness,sharing,caller-card,…}` present for shipped domains.

### Checklist vs canonical paths (intentional deltas)

| Build plan says | Repo ships | Action |
|-----------------|------------|--------|
| `GET /api/media/upload/{token}` | `GET /api/public/incident-media/t/{token}` + Next `media/upload/[token]` | **→** Document as canonical OR add alias routes only if customers require literal paths. |
| `GET /api/analytics/metrics` | `GET /api/admin/analytics/summary` (+ refresh, export.csv) | **→** Same: document canonical API; avoid duplicate metrics endpoints unless needed. |
| `GET /api/performance/team` | `GET /api/supervisor/performance/metrics` | **→** Document mapping; extend response shape if checklist requires extra fields. |
| `NEXT_PUBLIC_ENABLE_QA` etc. | `NEXT_PUBLIC_ENABLE_QA_SCORING`, `…_INCIDENT_MEDIA`, `…_SOP_PROTOCOL_AI`, `…_NON_EMERGENCY_TRIAGE`, `…_DISPATCHER_WELLNESS`, plus Phase 4 flags in `runtime-flags.ts` | **✓** Keep existing names; update **external** checklist to match [FEATURE_FLAGS.md](./FEATURE_FLAGS.md). |

---

## PHASE 1 — F1 Automated QA scoring

| Item | Status | Notes |
|------|--------|------|
| `packages/shared` QA types + Zod | **✓** | `packages/shared/src/qa/` |
| `qaService`, `qaRepository`, trigger scoring | **✓** | Post-analysis trigger path exists |
| HTTP routes `/api/qa/sessions`, templates CRUD, score | **✓** | See `infra/template.yaml` |
| Web: supervisor QA list/detail, admin templates | **✓** | Under `[jurisdiction]/(dispatch)/supervisor/qa` and `admin/qa/templates` |
| `QASessionsTable`, templates table, Lambdas, env | **✓** | Globals `QA_*` |
| Review queue QA badges / scorecard / coaching labels | **~** | Verify `/review` incident cards and **AI-generated** labeling on all coaching surfaces per acceptance. |
| `QASessionsTable` keys / GSIs vs checklist prose | **~** | Repo uses **PK `agencyId` + SK `sessionId`** (not a standalone `qaSessionId` PK). Table has **no GSI** in SAM today — add **`agencyId-createdAt-index`** (and optionally **`dispatcherId-createdAt-index`**) if acceptance or F9 rollups require efficient time/dispatcher queries without full partition scans. |
| Integration test: transcript → analysis → QA session | **~** | Extend if not end-to-end. |

**Do not rebuild:** core QA scoring pipeline, template CRUD, primary routes.

---

## PHASE 1 — F2 Caller media sharing

| Item | Status | Notes |
|------|--------|------|
| `packages/shared` incident media types + Zod | **✓** | `media/incident-media` |
| Handlers: request, list, confirm, upload-url (public) | **✓** | Includes `incidentMediaHttp` + `publicIncidentMediaHttp` |
| `mediaService`, token hash, presign, SNS/Twilio | **✓** | Secret ARN pattern |
| Web: request modal, gallery, `media/upload/[token]` | **~** | Verify consent UX, pending state, **AI labels** if any AI copy |
| `IncidentMediaTable`, TTL, IAM SNS/S3 | **✓** | |
| Audit `media.*` + phone redaction | **~** | Verify redaction on every audit path that logs phone |
| `SMS_PROVIDER` env name | **~** | Repo uses `INCIDENT_MEDIA_SNS_DIRECT`, Twilio secret ARN — align checklist or add alias env in SAM only if required |

**Do not rebuild:** media table, core public upload flow, presign pattern.

---

## PHASE 2 — F4 SOP-aware protocol AI

| Item | Status | Notes |
|------|--------|------|
| `sopService`, detect after N segments, patch incident | **✓** | |
| Agency SOP S3 + upload URL | **✓** | |
| Web: dismiss/override/steps, `/admin/protocols/sop` | **✓** | |
| `GET /api/incidents/{id}/protocol/detected` | **B** | Plan lists GET; repo may rely on **incident PATCH + embedded overlay** only — add GET **only if** UI or partners need it. |
| Real-time step highlighting from transcript | **~** | Tune detection / UX per acceptance |

**Do not rebuild:** `detectIncidentType` Lambda, SOP upload, overlay state on `Incident`.

---

## PHASE 2 — F3 Non-emergency triage AI

| Item | Status | Notes |
|------|--------|------|
| `triage.ts` shared, service, get + override | **✓** | Stored in analyses pattern |
| Web badge, queue tab, `/admin/triage/config` | **✓** | |
| Audit triage classified/overridden | **✓** | |
| `PATCH /api/incidents/{id}/triage` | **B** | Repo uses **`POST …/triage/override`** — add PATCH alias **only if** checklist mandates REST verb parity. |

**Do not rebuild:** triage pipeline, admin config, non-emergency queue tab.

---

## PHASE 2 — F5 Dispatcher trauma load monitoring

| Item | Status | Notes |
|------|--------|------|
| `trauma-flag` shared, wellness service/repo, scan on chunk | **✓** | |
| Supervisor-only list/ack, never dispatcher | **✓** | Enforce in API + web |
| `TraumaFlagsTable`, routes `/api/wellness/trauma-flags` | **✓** | Path uses `trauma-flags` not `flags` — document |
| `/admin/wellness`, SES optional | **~** | Confirm SES IAM gated by flag only |

**Do not rebuild:** keyword scan, supervisor API surface, table.

---

## PHASE 3 — Stabilization (F1–F5) — **B / ~**

Execute before treating Phase 4 as “done”:

1. **RBAC + Zod order** — Auth first, then Zod, on all POST/PATCH handlers (gap across some handlers).
2. **agencyId** — Add `ConditionExpression` on hot `GetItem` paths **if** checklist requires strict Dynamo-level tenant match (defense-in-depth).
3. **IAM** — Remove unnecessary `S3CrudPolicy` from Lambdas that do not touch S3 (Phase 4–5 drift).
4. **Alarms** — Add `Errors` alarms for **every** Lambda introduced in Phase 4–5 and scheduled `AggregateAnalyticsFunction`.
5. **Integration tests** — Full matrix: transcript→QA; media E2E; SOP detect; triage; trauma (extend existing tests).
6. **`sam validate --lint`** — CI gate on `infra/template.yaml`.
7. **Public routes audit** — Only public incident-media paths unauthenticated.

**Do not rebuild** F1–F5 features during stabilization—tighten only.

---

## PHASE 4 — F7 Caller data card

| Item | Status | Notes |
|------|--------|------|
| Address GSI on incidents | **✓** | `agencyId-callerAddressNormalized-index` (composite of agency + normalized string, not literal `agencyId#addr` PK — **document** design choice) |
| `getCallerCard` handler + service + mock CAD | **✓** | Handler file name `getCallerCard.ts`; uses `MockCadAdapter` |
| `PremiseNotesTable` | **✓** | |
| `POST /api/incidents/{id}/premise-notes` + Zod + audit | **B** | Repo has **read** via caller card + repo `putNote` **without** HTTP CRUD |
| UI: provenance, prior chips, add premise note | **B** | Panel exists; **manual note flow** + labels need completion |
| `CadCallerCardContext` vs plan `(phone, address)` | **→** | Extend adapter context when live CAD needs phone |

**Do not rebuild:** normalized address helper, GSI, caller card GET, table.

---

## PHASE 4 — F9 Dispatcher performance trends

| Item | Status | Notes |
|------|--------|------|
| `DispatcherCoachingNotesTable` | **✓** | GSI `agencyDispatcherKey-createdAt-index` |
| Supervisor-only metrics + detail + coaching POST | **✓** | Routes under `/api/supervisor/performance/…` |
| Web `/supervisor/performance` | **✓** | |
| Audit `performance.coaching_note.added` | **B** | Repo emits `dispatcher.coaching_note.created` — **rename or dual-write** to match checklist contract |
| QA-backed 30-day avg / charts from F1 | **~** | Current implementation uses **audit transcript_append** rollups — **extend** to join QA sessions where required by acceptance |
| `NEXT_PUBLIC_ENABLE_PERFORMANCE` | **B** | Repo uses `NEXT_PUBLIC_ENABLE_SUPERVISOR_PERFORMANCE` — align docs + admin Configuration |

**Do not rebuild:** coaching notes storage, supervisor RBAC, performance pages skeleton.

---

## PHASE 4 — F8 Leadership analytics

| Item | Status | Notes |
|------|--------|------|
| Aggregation + S3 cache | **✓** | `AdminAnalyticsService`, prefix `analytics/v1` |
| Admin-only, agency-scoped GET + refresh + CSV | **✓** | |
| Scheduled `AggregateAnalyticsFunction` | **✓** | `rate(1 day)` |
| Web `/admin/analytics` | **✓** | |
| PDF export | **B** | Stretch per prior phase; print/CSS or deferred |
| Cache TTL 1h | **~** | Current refresh is on-demand + nightly; add **TTL metadata** or `Cache-Control` policy if acceptance strict |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` | **B** | Repo uses `NEXT_PUBLIC_ENABLE_ADMIN_ANALYTICS` — align |

**Do not rebuild:** S3 summary JSON, refresh endpoint, CSV export.

---

## PHASE 5 — F6 Cross-jurisdiction incident sharing

| Item | Status | Notes |
|------|--------|------|
| `IncidentSharesTable`, `AgencySharePartnersTable`, TTL | **✓** | `ttlEpoch` attribute |
| Share create / list / revoke + incoming list | **✓** | |
| `resolveIncidentRead` for GET incident, transcript, analysis | **✓** | |
| Audit `share.created` / `share.revoked` | **✓** | Namespaced in security audit schema |
| Audit **`share.accessed`** | **B** | Emit on first successful cross-agency read of incident/transcript/analysis |
| `INCIDENT_SHARE_MAX_HOURS` cap | **B** | Enforce max TTL server-side from env (today ttlHours max 168 in Zod only) |
| Share scope (summary / transcript / media) | **B** | Repo shares **incident-level** access; **narrow scopes** if checklist requires |
| Platform UI `/admin/platform/agencies/[id]/share-partners` | **B** | API: `POST /api/agencies/{id}/share-partners`; **web** partner management not fully built |
| Watermarked read-only shared view | **~** | Incoming list + dashboard `?incident=`; add **banner/watermark** UX |

**Do not rebuild:** trust table, share records, core authorization gate.

---

## PHASE 6 — Final hardening / rollout

1. Full pass against **Global rules** (section top).
2. Tenancy regression suite: incident GET, transcript, analysis, media, QA, shares.
3. `sam validate --lint` + smoke scripts + **staging env matrix** ([FEATURE_FLAGS.md](./FEATURE_FLAGS.md), `scripts/dev-staging-phase2.env`).
4. **Rollout notes** artifact: new/changed tables + **migration order** for `IncidentsTable` GSI (already deployed in code—document for existing stacks).

---

## Env var matrix (checklist name → repo canonical)

Use **repo** names in SAM and web; update external checklist rows to match.

| Area | Checklist example | Repo / docs |
|------|-------------------|-------------|
| F1 | `NEXT_PUBLIC_ENABLE_QA` | `NEXT_PUBLIC_ENABLE_QA_SCORING` |
| F2 | `NEXT_PUBLIC_ENABLE_CALLER_MEDIA` | `NEXT_PUBLIC_ENABLE_INCIDENT_MEDIA` |
| F3 | `NEXT_PUBLIC_ENABLE_TRIAGE` | `NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE` |
| F4 | `NEXT_PUBLIC_ENABLE_AUTO_PROTOCOL` | `NEXT_PUBLIC_ENABLE_SOP_PROTOCOL_AI` |
| F5 | `NEXT_PUBLIC_ENABLE_WELLNESS` | `NEXT_PUBLIC_ENABLE_DISPATCHER_WELLNESS` |
| F6 | `INCIDENT_SHARE_MAX_HOURS` | **Add** if product wants hard cap separate from request body |
| F7 | `NEXT_PUBLIC_ENABLE_CALLER_CARD` | Matches + `ENABLE_CALLER_CARD` API |
| F8 | `NEXT_PUBLIC_ENABLE_ANALYTICS` | `NEXT_PUBLIC_ENABLE_ADMIN_ANALYTICS` |
| F9 | `NEXT_PUBLIC_ENABLE_PERFORMANCE` | `NEXT_PUBLIC_ENABLE_SUPERVISOR_PERFORMANCE` |

---

## Definition of done (F1–F9)

Work is complete when:

- [ ] Checklist **B** rows for F1–F9 are cleared without reimplementing **✓** areas.
- [ ] **No** `N` epics started (see STEP8 doc).
- [ ] All new/changed HTTP routes exist in **`infra/template.yaml`** with **minimal IAM**, **alarms**, **PITR** where policy requires.
- [ ] Zod + RBAC ordering and **audit** coverage match global rules.
- [ ] **Only** intended public routes skip JWT.
- [ ] `sam validate --lint` passes in CI on template changes.
- [ ] Integration tests cover the five Phase 3 flows **plus** Phase 4–5 critical paths (caller premise write, share access audit, analytics refresh).
- [ ] Rollout notes list: files touched, routes, tables, env, alarms, tests, known **→ Planned** URL/renaming follow-ups.

---

## Suggested implementation order (remaining **B** only)

1. **Phase 3 stabilization** — alarms, IAM trim, handler ordering, Dynamo conditions (if required), integration tests.
2. **F7** — `POST premise-notes`, Zod, audit, workspace UX (provenance + manual note).
3. **F9** — audit event name alignment + QA-derived metrics if acceptance demands.
4. **F8** — flag naming alignment + optional cache TTL metadata + PDF if pulled into F9 scope.
5. **F6** — `share.accessed` audit, max share hours env, scope model, platform share-partners UI, watermark.

This file is the **execution plan**; track day-to-day work in the issue tracker by **phase + F number** and link PRs here in the changelog section below.

### Changelog

| Date | Change |
|------|--------|
| 2026-04-21 | Initial combined plan from build plan + repo audit. |
