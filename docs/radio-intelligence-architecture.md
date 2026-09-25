# Radio Intelligence — Architecture (Phase 0 Discovery)

**Status:** Phase 0 complete — discovery only. No Radio Intelligence core implementation yet.  
**Plan source:** `NEXCORTIQ_CURSOR_MASTER_PLAN.md` (vendor-neutral `RadioIngestionAdapter`; ChatGPT 24 phases + monorepo cross-refs).  
**Date:** 2026-09-23  

## Governing insight

```
911 call + CAD + SMS + caller video + LiveLocation + RADIO + cameras
        ↓
NexCort iQ incident intelligence layer
        ↓
dispatcher → supervisor → responder
```

Radio Intelligence is a **new input into the existing incident layer**, not an isolated product. Downstream features (duplicate detection, Responder Link, Incident Mesh, Command Map, QA) consume radio highlights from that layer.

## Mandatory project rules (carried forward)

| Rule | Implication for this module |
|------|-----------------------------|
| Follow existing monorepo conventions | Nested SAM stack, Zod in `packages/shared`, RBAC via `packages/security`, `agencyId` on every Dynamo access |
| **DO NOT use Grok / xAI** | No Grok model, API, SDK, dependency, or endpoint. Use existing Bedrock / Anthropic / AWS STT paths only |
| Intelligence layer only | No autonomous dispatch; humans remain in command |
| No fabricated radio vendor integrations | Agency-authorized sources only; `TEST_SIMULATOR` for CI/demo |
| **Vendor-neutral ingestion** | `RadioIngestionAdapter` + extensible `sourceType` enum — **not** hard-coded P25/DMR |
| Never expose source credentials to the frontend | Secrets Manager ARN / reference only (`configurationReference`) |
| Feature-flag the module | `ENABLE_RADIO_INTELLIGENCE` / `NEXT_PUBLIC_ENABLE_RADIO_INTELLIGENCE` (default-on when unset, per repo policy) |

---

## What already exists (reuse first)

### Frontend / routing

| Surface | Location | Notes |
|---------|----------|-------|
| Next.js App Router | `apps/web` | PSAP jurisdiction routes `/{jurisdiction}/*`; product verticals under `/app/{campus\|venue\|transit}` |
| Dispatcher workspace | `apps/web/components/dispatch/*` | Shell, CAD entry, AI panel, caller media, **ChannelMonitorPanel** |
| Supervisor / PSAP console | `apps/web/components/psap/*`, role nav | Role-gated via `getRoleNav` / `AuthorizationService` |
| Dark theme | CSS vars / Tailwind | Prefer existing `--rc-*` tokens; plan hex values map to current dark console |
| Data fetching | TanStack React Query | Used across dispatch/venue/campus |
| Icons | lucide-react | Already standard |
| Real-time client | `apps/web/hooks/use-agency-websocket.ts` | Envelope `{ type, data }` |

**Do not invent:** a second WebSocket client or a parallel “radio console” outside the dispatcher shell.

### Existing channel / talk-group surfaces (critical)

The repo already has a **channel + talk-group assignment** model for incidents:

| Piece | Location |
|-------|----------|
| Types / Zod | `packages/shared/src/channels/channel.ts` (`ChannelConfig`, `IncidentChannelAssignment`, optional `talkGroupId`, `ChannelDiscipline`) |
| Dynamo repo | `apps/api/src/repositories/channelConfigRepository.ts` (`agencyId` + `channelId` keys) |
| Dispatcher UI | `apps/web/components/dispatch/channel-monitor-panel.tsx` |
| Billing SKU | `packages/shared/src/billing/addon-catalog.ts` → `supervisor_qa.channel_monitoring` (*Channel / Talk-Group Monitoring*) |

**Architecture decision:** Radio Intelligence **extends** this channel registry (source linkage, live transcript/alerts) rather than creating a second “radio channel” product concept. Map plan `RadioChannel` / `RadioTalkGroup` onto or beside `ChannelConfig`, with a clear migration note in Phase 1.

### Voice / transcription (reuse for radio audio)

| Piece | Location |
|-------|----------|
| STT provider interface | `apps/api/src/voice/interfaces.ts` → `ISpeechToTextProvider` |
| AWS Transcribe | `apps/api/src/voice/aws/awsTranscribeSttProvider.ts` |
| Whisper / Azure / Google STT | `apps/api/src/voice/{openai,azure,google}/` |
| Orchestration | `apps/api/src/voice/sttOrchestrator.ts`, `transcriptEnglishPipeline.ts` |
| WAV helpers | `apps/api/src/voice/audio/wavFromPcm16le.ts` |
| Mock STT | Explicit `kind === "mock"` only (fail-closed when unconfigured) |

**Do not invent:** a fourth STT stack. Radio transcript workers should call the same provider interface (or Vision’s Transcribe Streaming pattern for continuous audio).

### Vision transcript pipeline (closest continuous-audio pattern)

| Piece | Location |
|-------|----------|
| Types / WS event union | `packages/shared/src/rapid-vision/types.ts` |
| Session keys | `INCIDENT#{id}` / `SESSION#{id}` in `apps/api/src/rapid-vision/store.ts` |
| Segment keys | `INCIDENT#` / `SEG#...` (transcript worker) |
| Python worker | `apps/api/src/rapid-vision/transcript-worker/` |
| Authz | `canRequestVisionAccess` / `canViewVision` — **not** Ring-only helpers |
| Nested SAM | `infra/nested/stack-app-sam-6.yaml` |
| WS envelope | `{ type: "rapid-vision.*", data: { … } }` |

Radio live transcript push should mirror: **discriminated WS types + `data` wrapper + GSI fallback for connections**.

### Incidents, timeline, CAD

| Piece | Location |
|-------|----------|
| Incident model | `packages/shared/src/types.ts` → `Incident` (`agencyId`, CAD fields, location, language) |
| Timeline kinds | `packages/shared/src/timeline-types.ts` — **extend** with radio kinds (e.g. `radio_transmission`, `radio_alert`, `radio_summary`) |
| CAD ingest / duplicate-of-CAD | `apps/api/src/lib/cad/cad-ingest-intelligence.ts`, schemas `cadDuplicateOfCadNumber` |
| CAD mesh (PSAP-to-PSAP share) | `apps/api/src/cad-mesh/*`, `packages/shared/src/cad-mesh/*` — transfer packages can later carry radio highlights |
| Call Assist transfer package | `packages/shared/src/call-assist/transfer-package.ts` |

**Feature 2 (Duplicate Detection):** radio-derived entities/addresses should feed confidence **into** existing correlation paths — not a separate “duplicate engine” table family.

### WebSocket / realtime

| Piece | Location |
|-------|----------|
| Connect/disconnect/default | `apps/api/src/handlers/websocket/*` |
| Broadcast | `apps/api/src/lib/websocket/send-message.ts` → `broadcastToAgency` |
| Connections repo | `apps/api/src/repositories/websocketConnectionRepository.js` (GSI2 / ByAgencyIncident fallback pattern) |
| Nested realtime | `infra/nested/stack-app-sam-2-realtime.yaml` |

### Auth / RBAC / audit / tenancy

| Piece | Location |
|-------|----------|
| Cognito JWT + `getUserContext` | `apps/api/src/lib/auth.ts` |
| RBAC | `packages/security` → `AuthorizationService.canPerform`, `role-access-matrix-v2.ts`, `permissions.ts` |
| Audit | `AuditRepository` + `AUDIT_EVENT_TYPES` in `packages/security/src/audit-schema.ts` |
| Agency scope | `tenant-access-guard.ts`, always session `agencyId` |

**New permissions** (Phase 1+): add `radio.*` keys to the matrix; do not hard-code role string checks in handlers.

### AI / summarization

| Piece | Location |
|-------|----------|
| AI orchestrator / providers | `apps/api/src/ai/*` (`aiOrchestrator`, Bedrock/Anthropic factory, anti-hallucination prompts) |
| RCS AI summarizer | `apps/api/src/handlers/rcsAiSummarizer.ts` |

Radio summaries must use this stack. **No Grok.**

### Media / S3

| Piece | Location |
|-------|----------|
| Incident media upload/presign | `apps/api/src/handlers/media/*`, `mediaService` patterns |
| Assets bucket | Data layer `AssetsBucket` + public-access blocks |
| Audio chunks (call) | `postIncidentAudioChunk.ts`, voice bridge |

Radio audio: store under agency-scoped S3 keys; frontend gets **presigned GET** only — never raw source credentials or permanent public URLs.

### Maps / LiveLocation

| Piece | Location |
|-------|----------|
| Map | `apps/web/components/maps/RapidCortexMap*.tsx`, `packages/maps` |
| Live caller locations | `apps/web/hooks/use-live-caller-locations.ts` |
| Location / geofence APIs | `apps/api/src/location/*`, `stack-app-sam-location.yaml` |

Command Map radio-alert layer (later feature) overlays existing map — do not fork a second map SDK.

### Alerts framework

| Piece | Location |
|-------|----------|
| Vertical occupant alerts | `apps/api/src/handlers/alerts/*`, `stack-app-sam-vertical-alerts.yaml` |
| Web push overlay | `apps/web/components/alerts/vertical-alert-overlay.tsx` |

Radio keyword alerts are **ops-console / dispatcher** alerts (WS + optional SNS), distinct from occupant mass-notification. Reuse WS + audit; do not overload `VERTICAL_ALERTS_TABLE` unless a deliberate design says so.

### Billing / addons / feature flags

| Piece | Location |
|-------|----------|
| Addon catalog | `packages/shared/src/billing/addon-catalog.ts` |
| Existing radio-adjacent SKU | `supervisor_qa.channel_monitoring` |
| Feature keys / monetization | `packages/shared/src/monetization/*` |
| Web flags | `apps/web/lib/runtime-flags.ts` (`envFlag`, default-on) |
| API flags | `apps/api/src/lib/env.ts` (`featureEnabled`) |
| Tenant entitlement bridge | `apps/web/lib/rapid-cortex/tenant-addon-feature-bridge.ts` |

**Decision:** Add a dedicated Radio Intelligence addon key (e.g. `radio.intelligence`) **and** keep `supervisor_qa.channel_monitoring` as the channel-assignment SKU, or promote/rename with a migration note — do not silently ignore the existing catalog entry.

### Infrastructure patterns to copy

| Pattern | Exemplar |
|---------|----------|
| Feature nested stack on stack-2 HttpApi | `infra/nested/stack-app-sam-2-rcs.yaml`, `stack-app-sam-vertical-alerts.yaml`, `stack-app-sam-cad-mesh.yaml` |
| Vision / ML worker stack | `stack-app-sam-6.yaml` |
| Data tables | `stack-data-layer.yaml` (`DeletionPolicy: Retain`, `agencyId` keys/GSIs) |
| JWT authorizer id | Parent passes `HttpApiJwtAuthorizerId: "3ui9q4"` onto nested stacks |
| IAM | No `AWS::NoValue` inside `Resource:`/`Action:`; run `check-iam-novalue-resources.py` |
| Opt-in nested include | Prefer explicit parent parameter (cad-mesh style) for first production attach |

**Proposed stack:** `infra/nested/stack-app-sam-radio.yaml` (or `-2-radio.yaml` if routes hang on stack-2 HttpApi), registered in `infra/template.yaml` + `deploy.sh` validate loop.

### Search / indexing

No dedicated OpenSearch radio index found. Prefer Dynamo GSI queries by `agencyId` + time / talkGroup / incidentId first. Add search only if existing incident search infrastructure is confirmed reusable.

---

## Components needing modification

1. **`packages/shared/src/channels/*`** — link `ChannelConfig` to `RadioSource` / live talk groups; avoid duplicate channel directories.
2. **`timeline-types.ts`** — add radio event kinds for the unified incident timeline.
3. **`Incident` / timeline UI** — surface radio highlights next to call/CAD/media events.
4. **`addon-catalog.ts` + feature keys + runtime flags** — Radio Intelligence SKU + `ENABLE_RADIO_*`.
5. **`permissions.ts` / role matrix / audit schema** — `radio.sources.manage`, `radio.listen`, `radio.alerts.ack`, etc.
6. **`useAgencyWebSocket` consumers / dispatcher shell** — new event types (`radio.transmission.*`, `radio.alert.*`).
7. **Duplicate / correlation logic** — accept radio-extracted address/unit entities as signals (Feature 2).
8. **CAD mesh / transfer package types** — optional radio highlight payload for PSAP handoff (later).
9. **Command Map / Responder Link** — radio alert layer & briefing package fields (later features).

---

## New components required

| Component | Proposed path | Notes |
|-----------|---------------|-------|
| Domain types + Zod | `packages/shared/src/radio/*` | Per master plan Phase 1; `sourceType` extensible enum |
| `RadioIngestionAdapter` | `apps/api/src/radio/adapters/radio-ingestion-adapter.ts` | Vendor-neutral contract |
| Adapters | `.../adapters/{ip-audio,recorder,gateway,stream,vendor-api,test-simulator}.ts` | One class per `sourceType`; **TEST_SIMULATOR** required |
| HTTP router Lambda | `apps/api/src/handlers/radio/http.ts` (Vision-style catch-all) | JWT + RBAC + Zod |
| Ingest / normalize worker | `apps/api/src/radio/workers/*` | Persist transmission, enqueue STT |
| Transcript worker | Prefer Node STT providers; Python only if streaming Transcribe needs it (mirror Vision) | Mock path required |
| Alert engine | `apps/api/src/radio/alerts/*` | Agency-configurable phrases; cooldown |
| Summarizer | Reuse `apps/api/src/ai` | Incident- or talkgroup-scoped |
| Incident link service | Dynamo + audit | manual / auto_suggested / auto_confirmed |
| Dynamo tables | Data layer | Sources, channels/talkgroups (or extend channel config), transmissions, segments, alerts, summaries, links, preferences |
| Nested SAM | `stack-app-sam-radio*.yaml` | Routes on existing HttpApi; Secrets Manager prefix `rapid-cortex/radio/{agencyId}/…` |
| Dispatcher UI | Radio panel / talkgroup pins / alert toast | Inside existing dispatch shell |
| Admin UI | Source health, talkgroup enable, alert rules | Agency admin / IT — not PSAP dispatcher CAD tools |

### `sourceType` enum (locked)

```typescript
type RadioSourceType =
  | "IP_AUDIO"
  | "RECORDER_INTEGRATION"
  | "RADIO_GATEWAY"
  | "STREAM"
  | "VENDOR_API"
  | "TEST_SIMULATOR";
```

Adding a production transport = **new adapter class only**. Zero changes to Radio Intelligence core.

**Explicitly excluded:** hard-coded P25/DMR as the only connection method; Carbyne-style native telephony / call-handling replacement.

---

## Data flow

```
Agency-authorized radio/recorder/gateway/API/stream
        │
        ▼
 RadioIngestionAdapter (per sourceType)
        │  normalizeMetadata → RadioTransmission
        ▼
 Persist transmission (Dynamo, agencyId scoped)
        │
        ├─► Audio object → S3 (key only; presign for UI)
        │
        ▼
 STT (existing ISpeechToTextProvider / Transcribe path)
        │
        ▼
 RadioTranscriptSegment(s) → Dynamo
        │
        ├─► Keyword AlertRule engine → RadioAlert → WS broadcastToAgency
        ├─► Entity extraction → optional incident link suggestion
        ├─► Timeline event (new kind) on linked incident
        └─► AI summary (on demand / scheduled) via apps/api/src/ai
                │
                ▼
        Unified incident layer
                │
        ┌───────┼───────────────┐
        ▼       ▼               ▼
   Dispatcher  Supervisor   Downstream
   Radio UI    Monitor      (Dup detect, Responder Link,
   alerts                   Mesh, Command Map, QA)
```

WebSocket outbound shape (match Vision/CAD mesh):

```json
{ "type": "radio.alert.fired", "data": { "alert": { … }, "agencyId": "…" } }
```

---

## Security boundaries

1. **Tenant:** Every query/write includes `agencyId` from verified JWT — never from client-supplied path alone (rcsuperadmin exception only via existing patterns).
2. **RBAC:** New `radio.*` permissions; Guest Services / campus faculty / etc. do not get PSAP radio admin by default.
3. **Secrets:** Adapter config is Secrets Manager reference; Lambda resolves server-side.
4. **Audio:** CJI-aware retention; audit listen/replay/ack/link actions.
5. **No public media URLs:** Presigned GET; buckets keep Block Public Access.
6. **Source authorization:** Agency must enable source; `TEST_SIMULATOR` only when flag/env allows (never silently in prod paths).
7. **Fail closed:** Missing STT/config → no invented transcripts; alert rules empty → no phantom alerts.

---

## Deployment dependencies

| Dependency | Status |
|------------|--------|
| Stack-2 (or chosen) HttpApi + JWT authorizer | Exists |
| WebSocket API + connections table | Exists (`AppSamRealtime2Stack`) |
| Cognito user pool / groups | Exists |
| Assets / media S3 | Exists |
| Bedrock / Anthropic / Transcribe credentials | Existing Secrets / env patterns |
| New Dynamo tables | Add to data layer + IAM shards; size checks |
| New nested SAM + parent include + `deploy.sh` validate | Required before go-live |
| Web BFF route proxy (`comms-api-path` stack mapping) | Add `/api/radio/*` to correct upstream |
| Addon catalog + entitlement gate | Required for commercial enablement |
| Feature flags API + web | Required |

**Not required for Radio Intelligence core:** CAD write-back enablement; Carbyne telephony; direct P25 air interface.

---

## Feature order (post–ChatGPT reconciliation)

1. **Radio Intelligence** (this doc) — platform input  
2. **Duplicate Detection** — radio feeds confidence  
3. Responder Link — radio highlights in field briefing  
4. Video Wallboard  
5. Queue/KPI Wallboard  
6. Seat Map  
7. Location Breadcrumbs  
8. Video Blur  
9. **IoT Adapter Framework**  
10. Command Map — radio alerts layer  
11. Incident Mesh — radio highlights in transfer package  
12. QA 100%  

**Excluded:** Carbyne-style native call-handling / telephony replacement.

---

## Phase 0 exit criteria

- [x] Repository inspected for reusable surfaces  
- [x] This document created at `docs/radio-intelligence-architecture.md`  
- [ ] Phase 1 domain model in `packages/shared/src/radio/` (next)  
- [ ] No parallel Dynamo tables for existing ChannelConfig concepts without an explicit merge design  

## Next step

**Phase 1 — Domain model** in `packages/shared/src/radio/`, Zod schemas, export from shared index, and a short ADR note on mapping `RadioTalkGroup` ↔ existing `ChannelConfig.talkGroupId`.
