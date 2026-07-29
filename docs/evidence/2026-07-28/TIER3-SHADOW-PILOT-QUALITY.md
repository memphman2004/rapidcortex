# Tier 3 — Shadow Pilot Quality (2026-07-28)

Work completed to harden items 7–9 before first shadow session.

## 7 — Multilingual secrets + tables (no 503)

| Check | Status |
|-------|--------|
| Table `rapid-cortex-language-sessions-dev` | **ACTIVE** (DataLayer) |
| Lambda env | Packed as `RC_RUNTIME_CONFIG_JSON.ls` → hydrates `LANGUAGE_SESSIONS_TABLE` at runtime |
| Providers on live Lambdas | Mostly **mock** (safe for shadow; no Azure/Google secret required for mock) |
| Ops script | `scripts/validate-multilingual-stage.sh` (reads packed `ls` key) |

**Pilot rule:** Keep mock providers for first session **or** verify Admin → Integrations `multilingualIssueCount === 0` before enabling real STT/translation. Never flip to non-mock without secrets populated.

## 8 — Supervisor live operator presence

| Piece | Status |
|-------|--------|
| `GET /api/supervisor/operators` | Added — lists WebSocket connections by agency + active call join |
| `POST /api/supervisor/watching` | Added — emits `supervisor.watching` audit (`SUPERVISOR_WATCHING`) |
| SAM | `infra/nested/stack-app-sam-2-realtime.yaml` routes + functions |
| Supervisor overview UI | Replaced placeholder with live feed (15s poll) |
| Silent Monitor UI | Lists operators; Monitor records audit + deep-links to incident |

**Deploy required:** AppSam2 realtime nested stack for routes to go live.

## 9 — Ring Connect staff path

| Piece | Status |
|-------|--------|
| Staff OAuth / refresh / toggle | Already present |
| `devices/refresh` | Accepts optional `fallbackLatitude` / `fallbackLongitude` |
| UI refresh | Surfaces success/error; points ops to GPS seed script |
| Live `RapidCortexRingDevices-dev` | **Empty** — staff must Connect Ring + Refresh before cameras appear |
| GPS seed | `scripts/seed-ring-sonoma-point-gps.ts` when Ring omits coords |

**SOW option:** If the agency has no cameras for session 1, exclude Ring from scope until devices sync + GPS green.

## Deploy order for this work

1. Build API + deploy AppSam2 realtime (`stack-app-sam-2-realtime.yaml`)
2. Deploy web (supervisor UI)
3. `STAGE=dev bash scripts/validate-multilingual-stage.sh`
4. Staff: Media → Connect Ring → Refresh devices → seed GPS if needed → Enable for Connect
