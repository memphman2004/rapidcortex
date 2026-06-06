# Audit event matrix (pilot)

Events use the `type` string on **`AuditEvent`**. Constants live in **`packages/security/src/audit-schema.ts`** (`AUDIT_EVENT_TYPES`). Writers should import constants to avoid typos.

| `type` | When emitted | Typical `resourceType` / `resourceId` | Notes |
|--------|----------------|----------------------------------------|--------|
| `incident.created` | `POST /api/incidents` | `incident` / `incidentId` | |
| `transcript.segment_added` | `POST .../transcript` (after append) | `transcript` / `segmentId` | Detail avoids full transcript text by policy. |
| `analysis.created` | Successful `POST .../analyze` | `analysis` / `analysisId` | Includes provider, latency, prompt version (metadata). |
| `analysis.failed` | Analyze orchestrator exhausted | `analysis` / `incidentId` | Error codes, attempt chain (no secrets). |
| `analysis.skipped` | Debounce / cap / unchanged transcript | `analysis` / `incidentId` | |
| `voice.session.started` | `POST .../language-session/start` | `session` / `sessionId` | |
| `voice.session.finalized` | `POST .../language-session/finalize` | `session` / `sessionId` | |
| `voice.audio_chunk.processed` | Successful audio chunk STT + segment persist | `transcript` / `segmentId` | |
| `voice.language.detected` | Post-STT LID in multilingual service | `session` / `sessionId` | |
| `voice.translation.applied` | English pipeline translated non-English text | `transcript` / `segmentId` | |
| `voice.pipeline.failed` | STT (or upstream) chain failure on audio chunk | `session` / `sessionId` | Phase / error code. |
| `dispatcher.review_acknowledged` | `PATCH .../incidents` mark reviewed | `incident` / `incidentId` | |
| `escalation.raised` | Dispatcher escalation action | `incident` / `incidentId` | |
| `admin.user.create` | Admin API create user | `user` / email or username | |
| `admin.user.update` | Admin API attribute update | `user` / target username | |
| `admin.user.deactivate` | Admin API disable user | `user` / target username | |
| `agency.created` | Platform create agency | `agency` / `agencyId` | When implemented in service. |
| `agency.updated` | Agency profile patch | `agency` / `agencyId` | |
| `invite.created` / `invite.revoked` | Invite flows | `invite` | |
| `billing.*` | Billing mutations | varies | As wired in billing handlers. |
| `authz.access_denied` | Reserved for explicit authz denials | — | Use when adding middleware-style audit. |

## API normalization

`GET /api/audit/events` returns events passed through **`normalizeAuditEventForApi`** — sensitive keys inside `details` (e.g. `temporaryPassword`) are replaced with **`[redacted]`**.

## UI

**Admin → Audit** lists newest-first rows with type, resource, incident, actor, and a truncated JSON **details** preview (server-redacted).

## Related

- [SECURITY_MODEL.md](./SECURITY_MODEL.md)
- [API_SURFACE.md](./API_SURFACE.md)
