# Milestone XProtect Bridge Protocol

NexCort iQ cloud Lambdas **never** call XProtect Management Server directly.
IU (and other campuses) run an on-prem **RC Milestone Bridge** next to XProtect.
The bridge uses Milestone **MIP SDK** and/or **XProtect REST API** locally and
exposes a small HTTPS surface that NexCort iQ calls.

## Why a bridge

- MIP SDK is Windows / .NET and must run on the campus network.
- Management Server should not be exposed to the public internet.
- Cloud stays agency-scoped, auditable, and mockable (`MILESTONE_MOCK=1`).

## Auth

Every request from NexCort iQ includes:

| Header | Value |
|--------|--------|
| `X-RC-Milestone-Timestamp` | Unix seconds |
| `X-RC-Milestone-Signature` | `v1=<hex>` HMAC-SHA256 of `{timestamp}.{METHOD}.{path}.{body}` |

Secret is stored in AWS Secrets Manager (`MILESTONE_BRIDGE_CREDENTIALS_SECRET_ARN`).
JSON field preferred: `hmacSecret`.

Reject requests when `|now - timestamp| > 300` seconds.

## Endpoints

Base URL example: `https://bridge.campus.example:8443`

### `GET /v1/health`

```json
{ "ok": true, "xprotectConnected": true, "siteLabel": "IU Bloomington", "version": "1.0.0" }
```

### `GET /v1/cameras`

Returns the XProtect camera catalog for sync into the RC campus registry (`vendor: "milestone"`).

```json
{
  "cameras": [
    {
      "cameraId": "ballantine-entry-1",
      "displayName": "Ballantine Hall — Main Entry",
      "xprotectGuid": "…",
      "latitude": 39.1653,
      "longitude": -86.5264,
      "buildingId": "BALLANTINE",
      "floor": "1",
      "zoneCode": "BH-1",
      "status": "online",
      "ptzCapable": false,
      "rtspUrl": "rtsp://…"
    }
  ]
}
```

### `POST /v1/cameras/{cameraId}/live`

Body:

```json
{ "format": "hls", "incidentId": "IU-2026-123456" }
```

Response:

```json
{
  "cameraId": "ballantine-entry-1",
  "streamUrl": "https://bridge…/live/….m3u8",
  "format": "hls",
  "expiresAt": "2026-09-22T20:05:00.000Z"
}
```

Ticket TTL should be short (≤ 5 minutes). Console falls back to KVS viewer token when no ticket is available.

### `POST /v1/events`

RC SOC incident → XProtect event / bookmark (event-driven trigger).

```json
{
  "agencyId": "…",
  "incidentId": "IU-2026-123456",
  "title": "security · BALLANTINE",
  "description": "…",
  "severity": "high",
  "latitude": 39.1653,
  "longitude": -86.5264,
  "cameraIds": ["milestone#ballantine-entry-1"]
}
```

### `POST /v1/alarms`

RC incident → XProtect alarm / I/O input.

```json
{
  "agencyId": "…",
  "incidentId": "IU-2026-123456",
  "alarmName": "RapidCortexIncident",
  "message": "security · BALLANTINE",
  "severity": "high",
  "cameraIds": ["milestone#ballantine-entry-1"]
}
```

Both outbound calls return `{ "ok": true, "bridgeEventId": "…" }`.

## Cloud API (JWT)

Mounted on Stack 5 HttpApi:

- `POST /api/milestone/connect`
- `DELETE /api/milestone/disconnect`
- `GET /api/milestone/status`
- `POST /api/milestone/cameras/sync`
- `GET /api/milestone/cameras/near?incidentId=&campusCode=&latitude=&longitude=`
- `POST /api/milestone/cameras/{cameraId}/live`
- `POST /api/milestone/events`
- `POST /api/milestone/alarms`

Campus incident create also fire-and-forgets event + alarm when a connection is enabled.

## IU Year-1 mapping

| Commitment | Implementation |
|------------|----------------|
| Event-driven trigger RC → XProtect | `/v1/events` + campus incident hook |
| Live video into RC console | `/v1/cameras/{id}/live` ticket |
| Geo camera↔incident association | Catalog lat/lng + haversine merge with zone/QR scoring |
| VMS alarm from RC events | `/v1/alarms` |

## Deploy notes

1. Install bridge on a Windows host with Milestone MIP access.
2. Create Secrets Manager secret with `hmacSecret`.
3. Pass ARN as `MilestoneBridgeCredentialsSecretArn` on deploy.
4. Campus admin → Cameras → Milestone XProtect → Connect + Sync cameras.
5. Keep `MILESTONE_MOCK=1` in non-prod until bridge smoke test passes.

See also: [`apps/milestone-bridge/`](../../apps/milestone-bridge/README.md) (.NET 8 skeleton).
