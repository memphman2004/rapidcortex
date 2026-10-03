# Call Assist — Production Readiness

Non-emergency AI call management (Lex V2 ↔ Amazon Connect). Does **not** replace 911/PSAP CAD or live emergency dispatch.

## Go-live checklist

### Telephony (required for live DID)

| Item | How |
|------|-----|
| Connect instance | `CONNECT_INSTANCE_ID` (env + CFN `ConnectInstanceId`) |
| Contact flow | `CALL_ASSIST_CONTACT_FLOW_ID` — flow named `Call Assist` from `scripts/configure-call-assist-connect.sh` |
| Primary queue | `CALL_ASSIST_PRIMARY_QUEUE_ARN` (Demo Dispatcher) |
| Emergency queue | `CALL_ASSIST_EMERGENCY_QUEUE_ARN` (Call Assist Emergency) |
| Outbound DID | `CALL_ASSIST_OUTBOUND_CALLER_ID` (claimed Connect number, E.164) |
| Webhook secret | `CALL_ASSIST_CONNECT_WEBHOOK_SECRET_ARN` |
| Lex bot role + fulfillment | `CALL_ASSIST_LEX_BOT_ROLE_ARN`, `CALL_ASSIST_FULFILLMENT_LAMBDA_ARN` from Lex stack |

`deploy.sh` passes these into `AppSamCallAssistStack`. Missing instance/flow → Lambdas deploy, but console force-transfer stays **advisory** until configured.

### Fail-closed integrations (must stay off until addenda)

| Flag | Default | Notes |
|------|---------|-------|
| `CAD_WRITEBACK_ENABLED` | `false` | Platform-wide CAD write-back |
| `ENABLE_CALL_ASSIST_CAD_PUSH` | `false` | Dual gate with CAD write-back; `deploy.sh` refuses both on `dev`/`prod` |
| `ENABLE_CALL_ASSIST_RMS_DRAFT` | `false` | Live RMS filing |
| `ENABLE_CALL_ASSIST_DEMO_MODE` | `false` | Demo runner on live tenants |
| `CALL_ASSIST_CONNECT_MOCK` / `CALL_ASSIST_LEX_MOCK` | `false` on live | Keep mock off in production |

### Console / RBAC

- Product roles land on `/app/call-assist/{admin\|supervisor\|operator}` — never `/{jurisdiction}/dashboard`.
- Permissions: `call_assist.*` via `packages/security` matrix (`call_assist_admin` / `_supervisor` / `_operator`).
- Supervisor + admin nav include Analytics + QA.
- Force transfer (`POST …/sessions/{id}/transfer`) calls Connect `TransferContact` when `connectContactId` + queue ARN exist; otherwise returns `advisoryOnly: true` and still writes the transfer ledger + audit.

### Audit events (minimum)

Session start/complete, utterance (pipeline), barge-in (`call_assist.barge_in`), human/emergency/external transfer, CAD push blocked/submitted, legal hold, records request, demo run, transfer outcome.

### Pre-deploy commands

```bash
source scripts/env-api-dev.sh
# Confirm Connect params resolved:
echo "$CONNECT_INSTANCE_ID $CALL_ASSIST_CONTACT_FLOW_ID $CALL_ASSIST_OUTBOUND_CALLER_ID"
bash scripts/configure-call-assist-connect.sh   # if flow/DID not yet provisioned
# From internal drive:
bash scripts/deploy.sh dev
```

### Smoke test (live DID)

1. Dial the claimed Call Assist DID (not a 911 number).
2. Greeting + disclosure delivered; Lex slots collect intake.
3. Barge-in mid-prompt resumes next slot; audit shows `call_assist.barge_in`.
4. Operator **Take over** / **Force 911 queue** on live session → Connect transfer OK (not advisory).
5. CAD push button reports **blocked** while fail-closed flags are off.
6. Complete call → confirmation SMS / self-service token path works when SMS config set is present.

### Explicit non-goals

- Not a 911 PSAP console; no live CAD write-back without signed addendum.
- Hospital/venue/campus roles are excluded from Call Assist product routes.
- RapidSOS is optional and not required for KCPD RFP line items marked N/A.
