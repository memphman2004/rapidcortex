# DynamoDB design (MVP)

Defined in [`infra/template.yaml`](../../infra/template.yaml). All application access is via repositories in `apps/api/src/repositories/`.

## Incidents (logical model; physical name per stack)

| Key | Attribute | Type |
|-----|-----------|------|
| PK | `incidentId` | S |

| GSI | PK | SK | Use case |
|-----|----|----|------------|
| `agencyId-createdAt-index` | `agencyId` | `createdAt` | List incidents for tenant, newest first |

**Item shape:** `Incident` from `rapid-cortex-shared` (includes `agencyId`, triage summary fields, timestamps).

## Transcripts (logical)

| Key | Attribute | Type |
|-----|-----------|------|
| PK | `incidentId` | S |
| SK | `timestamp` | S (ISO) |

**Item shape:** `TranscriptSegment` (includes `segmentId`, `agencyId`, `speaker`, `text`). Sort key supports chronological ordering per incident.

## Analyses (logical)

| Key | Attribute | Type |
|-----|-----------|------|
| PK | `incidentId` | S |
| SK | `createdAt` | S (ISO) |

**Item shape:** `AIAnalysis` (includes `protocolGuidance` snapshot when present). Query newest-first with `ScanIndexForward: false`.

## Audit (logical)

| Key | Attribute | Type |
|-----|-----------|------|
| PK | `eventId` | S |

| GSI | PK | SK | Use case |
|-----|----|----|------------|
| `agencyId-createdAt-index` | `agencyId` | `createdAt` | List audit for tenant |

**Item shape:** `AuditEvent` (optional `resourceType` / `resourceId` for filtering).

## Demo ingestion

`POST /api/demo/start` uses `DemoService` to create incidents and seed transcript chunks — same tables and shapes as live path so the UI does not branch on storage.

## Future hardening

- TTL attributes for transcript/analysis retention per agency policy.
- Additional GSIs (e.g. incident status) if queue filters require avoid scans.
- Separate **GovCloud** stacks and KMS-managed tables for CJIS-aligned pilots.
