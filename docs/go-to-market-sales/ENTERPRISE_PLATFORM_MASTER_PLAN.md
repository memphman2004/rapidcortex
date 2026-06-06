# Rapid Cortex — Enterprise PSAP & Incident Command Master Plan

**Status:** Architecture + implementation blueprint (does not replace [MVP_SCOPE.md](./MVP_SCOPE.md) / [NON_GOALS.md](./NON_GOALS.md) until product governance adopts it).  
**Audience:** Engineering, security, PSAP operations, implementation partners.  
**Baseline product:** `apps/web` (Next.js, `/{jurisdiction}/…`), `apps/api` (Lambda + API Gateway), `packages/shared`, `packages/security`, `infra/template.yaml`, Cognito + `custom:agencyId` / `custom:role` tenancy ([AUTH_AND_TENANCY](./phase-4/AUTH_AND_TENANCY.md)).

---

## 0. How this extends Rapid Cortex (single platform)

| Principle | Enforcement |
|-----------|-------------|
| **One tenant graph** | Every new entity carries `agencyId`, optional `siteId` / `psapId`, `jurisdictionSlug`, and `correlationId` / `traceId`. |
| **One event vocabulary** | All domains emit `rc.v1.*` events to EventBridge; consumers never write peer DBs cross-domain. |
| **One shell UX** | Web (and desktop shells) load **Workspace Shell** — role picks layout preset; modules are dockable panels, not separate products. |
| **One auth story** | Cognito (or Gov IdP) → JWT claims extended with **capability scopes** (see §9), not parallel auth systems. |
| **One audit spine** | `AUDIT_EVENT_TYPES` extended; media + QA + IC have immutable append-only audit streams. |

---

## 1. Product architecture

### 1.1 Logical architecture (text diagram)

```
                    ┌─────────────────────────────────────────────────────────┐
                    │              Clients (unified UX shell)                  │
                    │  Web (Next.js)  │  Win (Electron)  │  macOS (Electron*)  │
                    └────────┬────────────────┬────────────────┬──────────────┘
                             │ HTTPS / WSS     │ HTTPS / WSS    │ HTTPS / WSS
                             ▼                 ▼                ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │              Edge: CloudFront + WAF + API Gateway        │
                    │  REST (HTTP API)  │  WebSocket API  │  Webhook ingress     │
                    └────────┬────────────────────┬──────────────┬─────────────┘
                             │                    │              │
        ┌────────────────────┼────────────────────┼──────────────┼────────────────────┐
        ▼                    ▼                    ▼              ▼                    ▼
 ┌──────────────┐   ┌─────────────────┐   ┌──────────────┐  ┌──────────┐      ┌─────────────┐
 │ rc-core-api  │   │ rc-realtime-*   │   │ rc-workers   │  │ rc-media │      │ rc-integrations│
 │ (Lambda mono │   │ (WS connect,    │   │ (SQS cons.)  │  │ ingest   │      │ (CAD, SMS,    │
 │  or split)   │   │  fanout, subs)  │   │              │  │ + KMS    │      │  vendor webhooks)│
 └──────┬───────┘   └────────┬────────┘   └──────┬───────┘  └────┬─────┘      └───────┬───────┘
        │                    │                   │             │                     │
        └────────────────────┴───────────────────┴─────────────┴─────────────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │            EventBridge (rc.v1.*)           │
                    └─────────────────────┬─────────────────────┘
                                          │
     ┌────────────┬────────────┬───────────┼──────────┬────────────┬──────────────┐
     ▼            ▼            ▼           ▼          ▼            ▼              ▼
 DynamoDB    OpenSearch    S3 (+ ILM)   KMS      SNS/SMS    SES email      Step Functions
 (entities)  (search)     (media/      (keys)   (on-call)   (notif)       (long workflows)
                         exports)
```

\*macOS: **Electron** first for parity and velocity; optional later **Swift** thin shell wrapping the same WebView2-equivalent (Tauri/WebView) only if hard requirements (Hardened Runtime, MDM) exceed Electron risk acceptance.

### 1.2 Service boundaries (recommended split from current `apps/api` monolith)

| Service code | Owns | Persists | Publishes |
|--------------|------|----------|-----------|
| `rc-auth` | Sessions, token exchange, MFA state machine | DDB: `AuthSession`, `MfaEnrollment` | `rc.v1.auth.*` |
| `rc-directory` | Users, roles, agency sites, PSAPs | DDB + Cognito admin sync | `rc.v1.directory.*` |
| `rc-calls` | Incidents, call sessions, channels (logical), assignments | DDB | `rc.v1.call.*` |
| `rc-stt` | Streaming STT jobs, chunk offsets | DDB + Kinesis optional | `rc.v1.stt.*` |
| `rc-i18n` | Detect, translate, TTS jobs, latency metrics | DDB + cache Redis* | `rc.v1.i18n.*` |
| `rc-ne` | Non-emergency intakes, backlog, SLA | DDB | `rc.v1.ne.*` |
| `rc-dispatch-ui-api` | Aggregated read models for console (BFF) | Read from OpenSearch + DDB | — |
| `rc-qa` | Reviews, rubrics, scorecards, coaching | DDB | `rc.v1.qa.*` |
| `rc-media` | Media tokens, uploads, livestream signaling, custody | S3 + DDB metadata | `rc.v1.media.*` |
| `rc-ic` | Major incidents, ICS-lite roles, objectives, periods | DDB | `rc.v1.ic.*` |
| `rc-warroom` | Rooms, messages, pins, tasks | DDB (+ optional IVS/Connect for voice bridge) | `rc.v1.warroom.*` |
| `rc-runbooks` | Playbooks, versions, acknowledgments | DDB + S3 blobs | `rc.v1.runbook.*` |
| `rc-timeline` | Unified timeline projection | DDB `TimelineEvent` + OpenSearch | `rc.v1.timeline.*` |
| `rc-postmortem` | AAR templates, RCA fields | DDB | `rc.v1.pm.*` |
| `rc-status` | Status pages, subscribers, incidents→status | DDB + edge cache | `rc.v1.status.*` |
| `rc-oncall` | Schedules, rotations, escalations | DDB | `rc.v1.oncall.*` |
| `rc-telemetry` | Metrics ingest from clients + AWS | Timestream or AMP | — |
| `rc-correlation` | Alert dedupe, incident suggestion | DDB + OpenSearch | `rc.v1.alert.*` |
| `rc-notify` | Fan-out to SMS/email/push/desktop | SQS workers | `rc.v1.notify.*` |

\*Redis/ElastiCache: optional; use **DynamoDB TTL + DAX** if CJIS posture disfavors extra data plane.

**MVP packaging:** Keep **one deployable repo** with `apps/api/src/domains/<name>/` and extract Lambdas in `template.yaml` when blast radius or scaling demands it.

### 1.3 Data flows (representative)

1. **Call / incident:** Client → `POST /api/incidents` → DDB `Incident` → Event `rc.v1.call.opened` → `rc-timeline` projection → WebSocket fanout `incident.updated`.
2. **Transcript + ML:** Audio chunk → `postIncidentAudioChunk` → STT worker → `rc.v1.stt.segment` → translation if `rc-i18n` → transcript store → `rc.v1.timeline.append`.
3. **NE intake:** `POST /api/ne/intakes` → `NeIntake` row → SLA timer (EventBridge Scheduler) → `rc.v1.ne.sla_breach` if overdue.
4. **Media:** Operator `POST /api/media/sessions` → short-lived presigned URL + **one-time token** → caller upload → S3 SSE-KMS → `MediaArtifact` + hash + `rc.v1.media.received` → timeline + QA attach pointer.
5. **QA:** Supervisor completes review → `QaReview` + rubric scores → `rc.v1.qa.completed` → coaching task optional → team rollup OpenSearch.
6. **Major incident:** Commander declares → `MajorIncident` + `IcPeriod` + war-room auto-provision → status page policy evaluation → on-call policy if SEV.

### 1.4 Real-time event flow

- **Canonical bus:** Amazon EventBridge custom bus `rapid-cortex`.
- **Fan-out:** Rules → SQS (per domain worker) + Lambda (small projections) + WebSocket **publisher** Lambda (subscribers keyed by `agencyId#roomId`).
- **Client subscription model:** `{ topics: ["agency:{id}", "incident:{id}", "console:{userId}"] }` with JWT-scoped topic ACL enforced on `$connect` and `subscribe` routes.

### 1.5 Desktop / web sync

| Layer | Responsibility |
|-------|------------------|
| **Command sync** | Optimistic UI with server revision (`etag` / `version` int); conflict policy: **server-wins** for regulatory fields; **merge** for notes where allowed. |
| **Real-time** | WebSocket primary; **SQS offline outbox** in desktop for fire-and-forget commands when disconnected (bounded queue, CJIS: encrypt local queue). |
| **Media** | Desktop uses same presigned flows; optional **chunked resumable upload** (S3 multipart). |
| **Telemetry** | Desktop agent batches metrics + client trace IDs → `rc-telemetry` every 30s + on incident boundary. |

---

## 2. Feature breakdown (modules, phases, dependencies, agency value)

**Legend:** MVP = pilot-viable slice; P2; P3.

### A — Prepared911-like

| # | Module | MVP | P2 | P3 | Depends on | Agency value |
|---|--------|-----|----|----|--------------|----------------|
| A1 | **NE intake & backlog** | Single queue, categories (system default), assign, notes, disposition, search | Custom categories/rules, SLA timers, aging dashboards | Multi-channel (SMS/web) full parity | `rc-ne`, `rc-calls`, auth | Clears 311/noise off 911 path |
| A2 | **Dispatcher console** | Layout presets + docked panels + incident list + channel placeholders | Map overlay, resource/unit tiles, CAD-derived status | Deep radio/CAD integration | WebSocket BFF, `rc-calls` | One-screen situational awareness |
| A3 | **QA & coaching** | Recording of review on transcript + simple score + notes | Rubrics, sampling rules, trends, remediation tasks | 100% auto-queue + AI pre-tag | `rc-qa`, transcript store, audit | Liability + training loop |
| A4 | **Live multilingual** | Current path hardened: STT→EN→display; manual override; latency banner | TTS back to caller language; text fallback chat | 40+ audio / 200+ text roadmap | `rc-i18n`, telephony bridge*, budgets | Serves diverse communities |
| A5 | **Caller media** | Secure link, photo upload, custody log, supervisor view | Livestream (WebRTC), redaction, retention policies | Cross-agency handoff | `rc-media`, KMS, legal copy | Scene intel without app install |
| A6 | **One-screen shell** | Workspace shell + keyboard map + saved layouts | Role templates, second monitor profile | Full PSAP “desk” certification UX | All modules | Speed under stress |

\*Telephony: partner CPaaS or CPE — Rapid Cortex owns **session + policy**, not the PSTN itself ([NON_GOALS](./NON_GOALS.md) alignment).

### B — Xurrent-like

| # | Module | MVP | P2 | P3 | Depends on | Agency value |
|---|--------|-----|----|----|--------------|----------------|
| B7 | **Major incident / IC** | Declare, severity, roles, objectives, structured log | Operational periods, resource branches | Full ICS documentation export | `rc-ic`, `rc-warroom` | Unified command |
| B8 | **Status pages** | Internal status + manual incident updates | External subscriber page, templates | Historical SLO on status | `rc-status`, `rc-telemetry` | Trust + comms |
| B9 | **War room** | Thread per incident, pins, tasks | Attachments, cross-team rooms | Exec read-only mirror | `rc-warroom`, WS | Coordinated response |
| B10 | **Runbooks** | Link playbooks to incident type; step checklist | Decision trees, ack gates, versioning | Auto-suggest from AI context | `rc-runbooks`, `rc-ic` | Procedure adherence |
| B11 | **Auto timeline** | Merge transcript + PATCH + analysis events | Add alerts, media, QA, auth admin | Export bundles for legal | `rc-timeline`, EventBridge | AAR + discovery |
| B12 | **Postmortems** | Blameless template + linked timeline | RCA fields, action tracking | AI draft from timeline | `rc-postmortem` | Continuous improvement |
| B13 | **On-call & escalation** | Schedule + escalation policy + SMS/email | Voice bridge, quiet hours | Multi-team | `rc-oncall`, `rc-notify` | Always reach someone |
| B14 | **Alert correlation** | Ingest app + infra alerts; dedupe window | Merge suggestions, suppression rules | Third-party adapters | `rc-correlation`, `rc-telemetry` | Noise reduction |
| B15 | **SLO / error budget** | Define SLOs + basic burn chart | Executive dashboards | Contractual reporting | AMP/Timestream, Grafana | Operate to standard |
| B16 | **Deploy / change correlation** | Tag releases with build SHA in telemetry | Ingest CI/CD events (CodePipeline, Flags) | Auto-suspect deploy on regression | `rc-telemetry`, webhooks | Faster MTTR |

---

## 3. Data models (core entities, relationships, audit, permissions)

### 3.1 Core entities (Dynamo-style keys)

| Entity | PK | SK | Key relationships |
|--------|----|----|---------------------|
| `Agency` | `AGENCY#{id}` | `META` | 1:N `Site`, `Psap`, `PolicyPack` |
| `Site` | `AGENCY#{id}` | `SITE#{siteId}` | Optional geographic / comms context |
| `User` | Cognito sub (external) | profile in `USER#{sub}` | `agencyId`, `role`, `scopes[]` |
| `Incident` | `AGENCY#{id}` | `INCIDENT#{incidentId}` | 1:N sessions, transcript, media, QA |
| `NeIntake` | `AGENCY#{id}` | `NE#{intakeId}` | Optional link `incidentId` |
| `NeCategory` | `AGENCY#{id}` | `NECAT#{code}` | Rules JSON |
| `QaReview` | `AGENCY#{id}` | `QA#{reviewId}` | FK `incidentId`, `reviewerSub` |
| `QaRubric` | `AGENCY#{id}` | `RUBRIC#{id}` | Versioned `version` int |
| `MediaSession` | `AGENCY#{id}` | `MEDIA#{sessionId}` | OTP hash, expiry, consent version |
| `MediaArtifact` | `AGENCY#{id}` | `ARTIFACT#{id}` | S3 key, SHA-256, `capturedAt` |
| `MajorIncident` | `AGENCY#{id}` | `MIC#{id}` | Links `incidentIds[]`, `warRoomId` |
| `IcPeriod` | `AGENCY#{id}` | `MIC#{micId}#PERIOD#{n}` | Objectives, IC roles |
| `WarRoom` | `AGENCY#{id}` | `ROOM#{id}` | `micId` optional |
| `WarRoomMessage` | `ROOM#{id}` | `MSG#{ts}#{ulid}` | append-only |
| `Runbook` | `AGENCY#{id}` | `RB#{id}#v#{version}` | immutable version rows |
| `RunbookExecution` | `AGENCY#{id}` | `RBX#{execId}` | step acks |
| `TimelineEvent` | `AGENCY#{id}` | `TL#{incidentId}#{ts}#{ulid}` | `source`, `payload`, `hashPrev` |
| `Postmortem` | `AGENCY#{id}` | `PM#{id}` | `micId` or `incidentId` |
| `OnCallSchedule` | `AGENCY#{id}` | `OCS#{id}` | rotation layers JSON |
| `AlertSignal` | `AGENCY#{id}` | `ALERT#{fingerprint}#{ts}` | correlation groups |
| `StatusPage` | `AGENCY#{id}` | `STPAGE#{id}` | components + incidents |

### 3.2 Standard audit fields (on all mutable domain rows)

```ts
type AuditStamp = {
  createdAt: string;       // ISO-8601 UTC
  createdBySub: string;
  updatedAt: string;
  updatedBySub: string;
  agencyId: string;
  dataClassification: "CJI" | "OPS" | "INTERNAL";
  legalHold: boolean;
  retentionPolicyId: string;
  sourceIp?: string;
  userAgent?: string;
  deviceId?: string;      // desktop telemetry id (hashed)
};
```

### 3.3 Permissions model (capability scopes on JWT + server enforcement)

Extend Cognito custom attribute **or** fetch **CapabilityGrant** from DDB on session (cached 5 min):

| Scope | Roles (default) |
|-------|------------------|
| `ne:intake:read` | dispatcher+ |
| `ne:intake:write` | dispatcher+ |
| `ne:supervisor:dashboard` | supervisor, admin |
| `console:layout:save` | dispatcher+ (personal), supervisor (agency template) |
| `qa:review:write` | supervisor, admin |
| `qa:rubric:admin` | admin |
| `media:request` | dispatcher, supervisor, admin |
| `media:view` | supervisor, admin (+ dispatcher if policy) |
| `ic:declare` | supervisor, admin |
| `ic:command` | admin + named `incident_commander` role |
| `warroom:post` | granted per room membership |
| `runbook:publish` | admin |
| `postmortem:approve` | admin |
| `oncall:admin` | admin |
| `status:publish` | admin, `comms_officer` |
| `telemetry:internal` | platform_superadmin, `rc_staff` |

**Rule:** UI hides controls; **API is authoritative** — every handler calls `AuthorizationService` extensions + scope check.

### 3.4 Sample TypeScript interfaces (Zod in `packages/shared`)

```ts
// packages/shared/src/schemas/ne-intake.ts (illustrative)
export const neIntakeSchema = z.object({
  id: z.string().ulid(),
  agencyId: z.string(),
  channel: z.enum(["phone", "text", "web", "transfer", "internal"]),
  categoryCode: z.string().max(64),
  priority: z.enum(["low", "normal", "high", "critical"]),
  status: z.enum(["new", "triaged", "assigned", "awaiting_callback", "closed"]),
  assignedToSub: z.string().optional(),
  summary: z.string().max(4000),
  slaDueAt: z.string().datetime().optional(),
  linkedIncidentId: z.string().optional(),
  ...auditFields,
});
```

---

## 4. APIs (inventory pattern, contracts, events, auth)

### 4.1 REST groups (prefix `/api` — mirror in `docs/API_SURFACE.md` when built)

| Group | Examples | Auth |
|-------|----------|------|
| NE | `GET/POST /ne/intakes`, `PATCH /ne/intakes/{id}`, `GET /ne/intakes/search` | JWT + `ne:*` |
| Console | `GET /console/layout`, `PUT /console/layout`, `GET /console/snapshot` | JWT |
| QA | `POST /qa/reviews`, `GET /qa/reviews/{id}`, `GET /qa/metrics/team` | JWT + supervisor |
| Media | `POST /media/sessions`, `POST /media/sessions/{id}/complete`, `GET /media/artifacts/{id}` | JWT + media scopes |
| IC | `POST /ic/major`, `PATCH /ic/major/{id}`, `POST /ic/major/{id}/periods` | JWT + IC |
| War room | `GET/POST /warrooms/{id}/messages`, `POST /warrooms/{id}/pins` | JWT + membership |
| Runbooks | `GET /runbooks`, `POST /runbooks/{id}/execute` | JWT |
| Timeline | `GET /timeline/incidents/{id}`, `POST /timeline/export` | JWT |
| Postmortem | `POST /postmortems`, `PATCH /postmortems/{id}` | JWT |
| On-call | `GET /oncall/schedules`, `POST /oncall/pages` | JWT + admin |
| Status | `GET /status/pages/{slug}`, `PATCH /status/components/{id}` | mixed public read / JWT write |
| Telemetry | `POST /telemetry/batch` (from desktop) | JWT or mTLS device cert (P2) |

### 4.2 WebSocket frames (JSON)

```json
{ "type": "subscribe", "topics": ["agency:AG123", "incident:INC456"] }
{ "type": "event", "topic": "incident:INC456", "envelope": { "schema": "rc.v1.call.updated", "payload": { } } }
```

### 4.3 Event schemas (EventBridge `detail-type`)

| detail-type | payload highlights |
|-------------|-------------------|
| `rc.v1.call.opened` | `incidentId`, `agencyId`, `channel` |
| `rc.v1.ne.created` | `intakeId`, `slaDueAt` |
| `rc.v1.qa.completed` | `reviewId`, `score`, `fail` |
| `rc.v1.media.received` | `artifactId`, `hash`, `sessionId` |
| `rc.v1.ic.declared` | `micId`, `severity` |
| `rc.v1.timeline.append` | `incidentId`, `eventType`, `body`, `prevHash` |
| `rc.v1.alert.correlated` | `groupId`, `fingerprints[]` |

### 4.4 Webhooks (inbound)

- CAD / SMS provider → API Gateway **mTLS** route `POST /integrations/v1/{vendor}/events` → normalizes to `rc.v1.integration.*` events.

---

## 5. UI/UX design plan

### 5.1 Navigation model (inside `/{jurisdiction}`)

- **Operations** hub: Dashboard / Console / NE / Incidents / Map (toggle)
- **Quality**: QA inbox / Coaching / Rubrics (admin)
- **Command**: Major incidents / War rooms / Runbooks
- **Reliability** (role-gated): Status / Alerts / SLOs / Postmortems / On-call
- **Admin**: existing admin + **Policy** (retention, media, QA sampling)

### 5.2 Key screens (minimum set)

| Workspace | Screens |
|-----------|---------|
| Call taker | NE quick create, linked incident, language strip, runbook suggestion |
| Dispatcher | Console (channels + queues + incident card + map tray) |
| Supervisor | QA inbox, live floor board, backlog heatmap, media approval |
| QA reviewer | Review workspace (audio sync + transcript + rubric side panel) |
| Admin | Policies, categories, retention, integrations, rubrics |
| Incident commander | IC board, period timer, objectives, assignments |
| Support / ops | Internal status, alert feed, customer agencies health |
| Reliability | SLO dashboards, deploy timeline, correlation suggestions |

### 5.3 One-screen PSAP suite

- **Grid engine:** 12-column CSS grid; panels are `dock:left|right|bottom` + `z-layer` for overlays.
- **Persistent rails:** Left = incidents + NE; Right = channels/alerts; Bottom = transcript + AI; Center = map or incident detail.
- **Keyboard:** `Alt+1..9` focus panels; `/` command palette; `Enter` on list item opens context drawer (not full navigation).

### 5.4 Incident command center

- Full-width **period bar** + **objectives list** + **resource board** + **decision log** (append-only with signed entries optional P3).

---

## 6. Database and storage

| Store | Use |
|-------|-----|
| DynamoDB | System of record entities + GSIs: `GSI1` agency+time, `GSI2` incident-centric |
| S3 | Media, exports, large postmortem attachments |
| OpenSearch | NE search, QA search, timeline text, alert index |
| EventBridge | Bus + archive (audit replay) |
| S3 Glacier ILM | Long-term retention per policy |
| **Streams** | DDB streams → timeline projector Lambda |

**Retention model:** Policy record defines `mediaTtlDays`, `transcriptTtlDays`, `qaRecordTtlYears`; **legal hold** boolean blocks purge job.

---

## 7. AI / automation

| Pipeline | Inputs | Outputs | Safeguards |
|----------|--------|---------|------------|
| STT | audio chunks | segments + confidence | strict mode from existing multilingual docs |
| Translate | segments + target | translated text + latency | operator override + fallback to English-only |
| TTS | text + voice profile | audio stream to bridge | consent + PII strip |
| QA assist | transcript + rubric | suggested tags + draft notes | **never auto-submit** score |
| Alert correlation | signals | `groupId`, suggested incident | human ack to open |
| Timeline gen | events | ordered narrative + hash chain | export signing (P3) |
| Postmortem draft | timeline + template | sections draft | human approval required |

---

## 8. Reliability & observability

### 8.1 SLO examples

| SLO | Target | SLI |
|-----|--------|-----|
| API availability | 99.95% monthly | `5xx` rate on API GW |
| Real-time delivery | 99.9% | WS message ack within 2s p99 |
| Transcription latency | p95 < 4s chunk-to-text | custom metric |
| Translation strict | no silent drop | `rc.v1.i18n.failure` rate |

### 8.2 Dashboards

- **Agency ops:** queue depth, NE SLA breaches, active incidents.
- **Engineering:** burn rate, deploy markers, error budget per service.
- **Executive:** major incidents / month, MTTR, QA pass rate trend.

### 8.3 Alerting

- Multi-window burn alerts (Google SRE style) on critical SLOs.
- Duplicate suppression: fingerprint = `hash(normalized_title + service + region)`.

---

## 9. Security / compliance (CJIS-aware)

| Control | Implementation |
|---------|----------------|
| Encryption | TLS 1.2+, S3 SSE-KMS, DDB encryption at rest, **BYOK** optional dedicated KMS key per agency (P2) |
| CJI marking | `dataClassification` on rows; UI watermarks for CJI views |
| Audit | Immutable append stream for sensitive actions + API GW access logs to secured bucket |
| Chain of custody | `MediaArtifact` chain: `prevArtifactHash`, operator attestations, download logs |
| Tenant isolation | `agencyId` mandatory; superadmin break-glass events `rc.v1.security.breakglass` |
| Admin | MFA enforced for admin roles in CJIS mode; session binding |

**RBAC matrix (excerpt):**

| Action | Dispatcher | Supervisor | Admin | Commander |
|--------|------------|------------|-------|-----------|
| Create NE | ✓ | ✓ | ✓ | — |
| Close NE | ✓ | ✓ | ✓ | — |
| QA score | — | ✓ | ✓ | — |
| Request media | ✓ | ✓ | ✓ | — |
| Declare major incident | — | ✓ | ✓ | ✓* |

\*role `incident_commander` assigned by admin.

---

## 10. Implementation roadmap

### 10.1 Build order (recommended)

1. **Platform spine:** EventBridge bus + `TimelineEvent` projector + WebSocket topic ACL + shared workspace shell (empty panels).
2. **NE backlog (MVP)** — unblocks 311 narrative without telephony depth.
3. **Dispatcher console read model** — aggregates existing incidents + placeholders for CAD.
4. **QA MVP** on top of existing transcript/analysis.
5. **Media MVP** (photo link + custody) — high visible value, controlled blast radius.
6. **Harden multilingual** paths already in API.
7. **Major incident + war room (thin)**.
8. **Runbooks linked to incidents**.
9. **Status pages (internal)**.
10. **On-call + notify**.
11. **Telemetry + SLO + correlation**.
12. **Postmortem + export bundles**.
13. **Desktop shells** (Electron) wrapping same web app + local queue.
14. **GitOps correlation** (internal).

### 10.2 Workstreams

| Stream | Skills |
|--------|--------|
| Core API / DDB | Backend |
| Real-time | Backend + infra |
| Web workspace | Frontend + design |
| Media + crypto | Security + backend |
| QA / IC / PM | Full-stack + domain SME |
| Telemetry | DevOps + backend |
| Desktop | Electron + release engineering |

### 10.3 Release strategy

- **Feature flags:** `ne_backlog`, `dispatcher_console_v1`, `qa_rubrics`, `media_upload_v1`, `ic_major_v1`, `war_room_v1`, `status_pages`, `oncall_v1`, `telemetry_internal`.
- **Pilot:** single agency, synthetic load + table-top exercises before CAD ingest.

---

## 11. Cursor-ready build plan (repo)

### 11.1 Repository structure (target)

```
apps/
  web/                    # Next.js (existing)
  api/                    # split: src/domains/{ne,qa,ic,...}/handlers
  desktop/                # NEW Electron shell — loads same origin
packages/
  shared/                 # Zod schemas + event types
  security/               # RBAC extensions + audit types
  ui-workspace/           # NEW: dock layout, command palette, panel registry
infra/
  template.yaml           # add WebSocket API, EventBridge, new tables
docs/
  ENTERPRISE_PLATFORM_MASTER_PLAN.md   # this file
```

### 11.2 Scaffold first

1. `packages/ui-workspace` — layout shell + panel registry + keyboard provider (no business logic).
2. `packages/shared/src/events/rc-v1.ts` — event envelope + `detail-type` constants.
3. `apps/api/src/lib/eventBridge.ts` — publisher helper.
4. DDB single-table templates for `NeIntake`, `TimelineEvent`.
5. `POST /api/ne/intakes` + list + patch (stub handlers wired in template).

### 11.3 Mock / dev tooling

- **Seed script:** `pnpm --filter api seed:ne` — generates intakes + SLA edge cases.
- **Synthetic WS:** dev server pushes fake `incident.updated` at interval.
- **Desktop:** `.env` `RC_WEB_ORIGIN=http://localhost:3000`.

### 11.4 Feature flags

- Centralize in `packages/shared/src/feature-flags.ts` + env `NEXT_PUBLIC_FEATURE_*` for web; API reads SSM parameter `/rc/{stage}/flags`.

---

## Appendix A — Highest-risk modules

1. **Live multilingual voice loop** (latency, emergency accuracy, vendor lock, recording consent).
2. **Caller livestream** (legal, CJI exposure, chain of custody, bandwidth on ECC networks).
3. **CAD/radio deep integration** (vendor variance, safety interlocks — keep adapter boundary strict).
4. **Alert correlation** (false merges vs missed correlation — start conservative).
5. **Desktop security** (local cache of CJI — minimize; prefer streamed ephemeral views).

---

## Appendix B — Competitive parity paths

**Prepared911 fastest parity:** NE backlog + dispatcher console shell + QA MVP + media photo link + multilingual hardening (items A1–A5 skeleton).

**Xurrent fastest parity:** Major incident declaration + war room + internal status + on-call paging + postmortem template + timeline auto-merge (B7–B13 thin slices before advanced correlation/SLO polish).

---

## Appendix C — Immediate next coding steps (this repo)

1. Add **`packages/shared`**: `rc-v1` event envelope types + `NeIntake` Zod schema.
2. Add **`packages/security`**: extend `AuthorizationService` with `ne:*` / `media:*` stubs + tests.
3. Add **Dynamo tables + GSIs** in `infra/template.yaml` for `NeIntake` (+ optional `TimelineEvent`).
4. Implement **`createNeIntake` / `listNeIntakes` / `patchNeIntake`** handlers in `apps/api` and register routes in `template.yaml`.
5. Add **`apps/web`** route `/{jurisdiction}/operations/ne` with table + drawer using existing design tokens; gate with feature flag.
6. Wire **EventBridge publish** on NE create/close (no consumers yet).
7. Open **`docs/API_SURFACE.md`** PR section for NE routes when handlers stabilize.

---

*Document owner: platform architecture (update with ADRs as decisions land).*
