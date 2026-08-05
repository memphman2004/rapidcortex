# Response Continuity System (RCS)

Life-safety call persistence: silent monitor queue, unit geofence arrival confirmation,
audio sentinel, escalation engine, and closure gate with supervisor override audit.

## Billing

| Catalog key | Name | Price |
|-------------|------|-------|
| `rcs.module` | Response Continuity System (RCS) Module | **$1,500 / agency / month** |

Registered in:

- `packages/shared/src/billing/addon-types.ts` (`ADDON_KEYS`)
- `packages/shared/src/billing/addon-catalog.ts` (`ADDON_CATALOG`)
- `packages/shared/src/billing/pricing-defaults.ts` (`PRICING_DEFAULTS["rcs.module"]`)
- `apps/web/lib/pricing/pricing-catalog.ts` (RC Admin Add-ons tab section)
- `scripts/seed-pricing-store.ts` (`addon-rcs-module`, 150000 cents)

API handlers gate with `requireAddon("rcs.module")`.

## Feature flags

- API: `ENABLE_RCS` (default on when unset via `featureEnabled`)
- Web: `NEXT_PUBLIC_ENABLE_RCS` (default on) → `isRcsEnabled()`
- Nav feature key: `rcs`

## Routes

| Method | Path |
|--------|------|
| POST | `/api/rcs/calls` |
| GET | `/api/rcs/calls` |
| PATCH | `/api/rcs/calls/{callId}/state` |
| POST | `/api/rcs/calls/{callId}/close` |
| POST | `/api/rcs/calls/{callId}/audio-alert` |
| POST | `/api/rcs/calls/{callId}/acknowledge` |
| POST | `/api/rcs/units/position` |
| GET | `/api/rcs/calls/{callId}/summary` |
| POST | `/api/rcs/calls/{callId}/summary` |
| POST | `/api/rcs/calls/{callId}/handoff` |
| POST | `/api/rcs/calls/{callId}/handoff/accept` |
| DELETE | `/api/rcs/calls/{callId}/handoff` |
| GET | `/api/rcs/floor-health` |
| GET | `/api/rcs/escalation-rules` |
| PUT | `/api/rcs/escalation-rules` |

Scheduled (rate 1 minute): `rcsAiSummarizer`, `rcsEscalationWatchdog`, `rcsFloorHealthPush`.

Infra: Dynamo tables in `stack-data-layer.yaml`; Lambdas in `stack-app-sam-2-rcs.yaml`
wired from `infra/template.yaml` as `AppSamRcsStack2` (HttpApi from AppSam2Stack;
WebSocket fan-out from AppSamRealtime2Stack).

## UI

- Monitor: `/{jurisdiction}/rcs`
- Trigger demo: `/{jurisdiction}/rcs/trigger-demo`
- Nav: dispatcher Operations + supervisor Command → “RCS Monitor”

## Source prompt

Original design brief: user Downloads `RCS_CLAUDE_CODE_PROMPT.md` (adapted to this monorepo’s
paths: `packages/shared`, `apps/web/app`, nested SAM stacks).
