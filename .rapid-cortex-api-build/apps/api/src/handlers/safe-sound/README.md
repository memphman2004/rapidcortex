# Safe & Sound / Guardian / Mobile Codes — HTTP handlers

Lambda handlers for the Expo mobile app contracts. **Infra wiring:** `infra/nested/stack-app-sam-qr.yaml` (HttpApi on Stack 1). Deploy with `./scripts/deploy-lean-dev.sh dev --qr-only`.

## Feature flags (API)

| Env var | Default when unset | Mock |
|---------|-------------------|------|
| `ENABLE_SAFE_SOUND` | ON | Empty table → Dynamo path; or set `SAFE_SOUND_MOCK=true` for in-memory |
| `ENABLE_GUARDIAN` | ON | Same for `GUARDIAN_EVENTS_TABLE` / `GUARDIAN_MOCK` |

Tables (QR stack): `rapid-cortex-safe-sound-devices-{stage}`, `rapid-cortex-guardian-events-{stage}`.
Mobile codes (`/api/codes`) uses `QR_NFC_CODES_TABLE` when set.

## Handlers

| File | Handler export | Routes |
|------|----------------|--------|
| `devicesHttp.ts` | `handler` | See devices table below |
| `geofencesHttp.ts` | `handler` | Geofences table below |
| `contactsHttp.ts` | `handler` | `POST /api/safe-sound/emergency-contacts` |
| `../guardian/eventsHttp.ts` | `handler` | Guardian table below |
| `../mobile-codes/codesHttp.ts` | `handler` | Codes table below |

### Safe & Sound devices (`devicesHttp.ts`)

```
GET    /api/safe-sound/devices
POST   /api/safe-sound/devices/register
GET    /api/safe-sound/devices/{deviceId}
PATCH  /api/safe-sound/devices/{deviceId}
DELETE /api/safe-sound/devices/{deviceId}
GET    /api/safe-sound/devices/{deviceId}/location
POST   /api/safe-sound/devices/{deviceId}/location
GET    /api/safe-sound/devices/{deviceId}/history
POST   /api/safe-sound/devices/{deviceId}/lost-mode
PUT    /api/safe-sound/devices/{deviceId}/rc-core-consent
```

### Geofences (`geofencesHttp.ts`)

```
GET    /api/safe-sound/devices/{deviceId}/geofences
POST   /api/safe-sound/devices/{deviceId}/geofences
DELETE /api/safe-sound/geofences/{geofenceId}
```

### Guardian (`eventsHttp.ts`)

```
GET    /api/guardian/events/{eventId}
POST   /api/guardian/events/{eventId}/cancel
```

### Mobile codes (`codesHttp.ts`)

```
GET    /api/codes
POST   /api/codes
GET    /api/codes/{codeId}
PATCH  /api/codes/{codeId}
DELETE /api/codes/{codeId}
POST   /api/codes/{codeId}/nfc-write
```

Production codes should delegate to `/api/qr-nfc` via `QrNfcService` (see file header comment).

## DynamoDB (when tables configured)

Single-table pattern on `SAFE_SOUND_DEVICES_TABLE` (pk/sk):

| pk | sk | Entity |
|----|-----|--------|
| `AGENCY#{agencyId}` | `SS_DEVICE#{deviceId}` | Device |
| `AGENCY#{agencyId}` | `SS_GEOFENCE#{geofenceId}` | Geofence |
| `AGENCY#{agencyId}` | `SS_CONTACT#{contactId}` | Emergency contact |
| `AGENCY#{agencyId}` | `SS_LOC_LATEST#{deviceId}` | Latest location |
| `AGENCY#{agencyId}` | `SS_LOC#{deviceId}#{timestamp}` | Location history |

Guardian events on `GUARDIAN_EVENTS_TABLE`:

| pk | sk |
|----|-----|
| `AGENCY#{agencyId}` | `GUARDIAN_EVENT#{eventId}` |

All reads/writes are scoped by `agencyId` from the verified session.

## SAM registration notes

**Recommended stack:** `infra/nested/stack-app-sam-qr.yaml` (primary HttpApi, QR/mobile domain) or `stack-app-sam.yaml` stack 1 — **not** stack 4 (billing/Ring).

Minimal function resources (one Lambda per handler file):

```yaml
SafeSoundDevicesHttpFunction:
  Type: AWS::Serverless::Function
  Properties:
    Handler: dist/handlers/safe-sound/devicesHttp.handler
    Environment:
      Variables:
        ENABLE_SAFE_SOUND: "true"
        SAFE_SOUND_DEVICES_TABLE: !Ref SafeSoundDevicesTable  # when provisioned
        SAFE_SOUND_MOCK: ""  # set "true" in dev
    Events:
      ListDevices:
        Type: HttpApi
        Properties:
          ApiId: !Ref HttpApiId
          Path: /api/safe-sound/devices
          Method: GET
      # ... additional Events per route (or use ApiGatewayV2::Route like QrNfc)
```

Env vars to add per function:

- `ENABLE_SAFE_SOUND`, `SAFE_SOUND_MOCK`, `SAFE_SOUND_DEVICES_TABLE`
- `ENABLE_GUARDIAN`, `GUARDIAN_MOCK`, `GUARDIAN_EVENTS_TABLE`
- `QR_NFC_CODES_TABLE` (mobile codes delegation)
- `AUDIT_TABLE` (mutations)

IAM: `AppManagedPolicyDynamoLambdaCrudShard*` on Safe Sound / Guardian tables + audit table.

After SAM edits: `sam validate --lint` from `infra/`.

## Shared schemas

`packages/shared/src/safe-sound/schemas.ts` — Zod types exported via `rapid-cortex-shared`.

## Web feature flag (when UI is added)

Mirror API with `NEXT_PUBLIC_ENABLE_SAFE_SOUND` / `NEXT_PUBLIC_ENABLE_GUARDIAN` in `apps/web/lib/runtime-flags.ts` (default ON via `envFlag()`).
