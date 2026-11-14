# CAD Write-Back Rollback & Kill Switch

## Instant kill (no deploy)

1. **Environment flag (all agencies):** set `CAD_WRITEBACK_ENABLED=false` on the API/Lambda env (or leave unset — fail-closed). Redeploy only if the live value was `true`.
2. **Per-agency kill (no code deploy):** patch agency config:
   ```json
   {
     "cadWriteback": {
       "cadAddendumSigned": false,
       "cadAutomatedWritebackEnabled": false
     }
   }
   ```
   Both flags default **false**. Human-assisted write-back requires `cadAddendumSigned`. Automated (no-approval) delivery requires **both**.
3. **Connector surface:** set `ENABLE_CAD_CONNECTOR=false` (fail-closed when unset) to 503 the connector HTTP API.

Every kill-switch change that goes through agency config PATCH must write an audit row (`CAD_INTEGRATION_UPDATED` / agency settings audit).

## Drain the approval queue

1. `GET /api/admin/cad-writeback-approvals?status=pending_approval` (supervisor / agency IT).
2. Reject remaining items with an explicit reason (`POST .../reject`) — do not leave orphaned pending rows.
3. Confirm queue empty; check CloudWatch / DLQ if delivery failed mid-approve.

## Roll back to polling-only

1. Keep write-back flags off (above).
2. Leave CAD integrations on `api_poll` / `webhook_inbound` for **read** only.
3. Confirm poller circuit breaker is CLOSED via integration health / `lastSuccessfulPollAt`.

## Disable one agency adapter

1. `PATCH` the integration / connector to `status: inactive` (or disable the connector).
2. Do **not** flip global `CAD_WRITEBACK_ENABLED` unless all agencies must stop.

## Alarms to watch

| Signal | Action |
|---|---|
| Write-back Lambda errors / `CAD_WRITEBACK_FAILED` audit spike | Page on-call; kill switch |
| Poller gap > 2× `pollIntervalMinutes` | Check circuit breaker / vendor |
| Approval queue depth > 20 | Supervisor staffing / reject drain |
| CadSessionOpen / Eta DLQ depth ≥ 1 | Pre-Arrival EventBridge path |

## Verification checklist (#66)

| Check | How |
|---|---|
| Global kill | Confirm live Lambda env `CAD_WRITEBACK_ENABLED` is `false` / unset on CadWritebackHttp + CadConnectorHttp |
| Per-agency kill (no deploy) | PATCH agency `cadWriteback` both flags false; immediately retry submit → 400 with addendum/automated message (reads live Dynamo via `AgencyRepository.get`, not a long-lived cache) |
| Audit on kill | Agency config PATCH writes audit (`CAD_INTEGRATION_UPDATED` / settings audit) |
| Queue drain | Pending approvals rejectable; list returns empty after drain |
| Alarms | Deploy `infra/nested/stack-cad-writeback-alarms.yaml` as `rapid-cortex-cad-writeback-alarms-{stage}` with CadWritebackHttp / CadConnectorHttp / poller function names + OpsAlerts topic |
| CadSessionOpen / ETA DLQ | Alarms on sidecar `rapid-cortex-cad-session-open-{stage}` |
| Bus target | CAD `CORE_EVENT_BUS_ARN` = `arn:aws:events:us-east-1:158961537080:event-bus/nexcortiq.cad` (never default) |

## Related

- Bus: `nexcortiq.cad` in account `158961537080` (never the default bus).
- CAD PutEvents: account `621957412915` → that bus only (`CORE_EVENT_BUS_ARN`).
- Deploy fold: `scripts/deploy-cad-inbound.sh` (invoked from `deploy.sh` unless `SKIP_CAD_INBOUND_DEPLOY=1`).
