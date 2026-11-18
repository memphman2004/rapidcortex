# NexCortiQ — Deployment Stabilization Audit
*AWS Account: 158961537080 | Profile: rapid-cortex | Date: 2026-11-17*

---

## Executive Summary

**Problem:** Large deploys are causing CloudFormation to roll back or delete functional nested stacks due to three root causes:
1. Stateful resources (DynamoDB, S3, Cognito) have no `DeletionPolicy: Retain` → data destroyed on stack replacement
2. Zero termination protection on any stack → accidental `aws cloudformation delete-stack` destroys production data
3. Full-tree deploy on every change → one failure cascades across all 45 nested stacks

**Status as of 2026-11-17:**
- 73 stateful resources missing `DeletionPolicy: Retain` (Phase 2 pending completion of active deploy)
- 0 of 73 stacks have termination protection enabled (Phase 3 pending)
- 14 stacks in `UPDATE_ROLLBACK_COMPLETE` (active deploy in progress to resolve)
- Stack policies: none applied (Phase 4 pending)
- Surgical per-stack deploy mode: not yet implemented (Phase 5 pending)

---

## Phase 1a — Stateful Resource Audit

**Scan of all `infra/` templates for resources missing `DeletionPolicy: Retain`**

> Total resources found: 208 | At risk: 73 | Protected: 135

### CRITICAL: Active Template Resources Missing DeletionPolicy

Resources in live deployed templates that have no deletion protection:

| Resource LogicalId | Type | Stack | DeletionPolicy | UpdateReplacePolicy |
|---|---|---|---|---|
| CadCapIncidentsTable | DynamoDB::Table | stack-app-sam | MISSING | MISSING |
| CadWebhookIdempotencyTable | DynamoDB::Table | stack-app-sam | MISSING | MISSING |
| ChannelConfigTable | DynamoDB::Table | stack-app-sam | MISSING | MISSING |
| IncidentChannelAssignmentsTable | DynamoDB::Table | stack-app-sam | MISSING | MISSING |
| CameraProviderOAuthStatesTable | DynamoDB::Table | stack-app-sam-4 | MISSING | MISSING |
| CameraProviderTokensTable | DynamoDB::Table | stack-app-sam-4 | MISSING | MISSING |
| CamerasRegistryTable | DynamoDB::Table | stack-app-sam-4 | MISSING | MISSING |
| NestOAuthStateTable | DynamoDB::Table | stack-app-sam-4 | **Delete** ⚠️ | MISSING |
| WyzeConsentHmacSecret | SecretsManager::Secret | stack-app-sam-4 | MISSING | MISSING |
| CadBridgeCircuitBreakerTable | DynamoDB::Table | stack-app-sam-cad-bridge | **Delete** ⚠️ | Delete |
| CadBridgeLoopGuardTable | DynamoDB::Table | stack-app-sam-cad-bridge | **Delete** ⚠️ | Delete |
| RCMapIdentityPool | Cognito::IdentityPool | stack-app-sam-location | MISSING | MISSING |
| McpJwtSigningSecret | SecretsManager::Secret | stack-app-sam-mcp-watch | MISSING | MISSING |
| QRNFCCodesTable | DynamoDB::Table | stack-app-sam-qr | MISSING | MISSING |
| TransitCameraProducerSecret | SecretsManager::Secret | stack-app-sam-transit | MISSING | MISSING |
| TranslateWsSecret | SecretsManager::Secret | stack-app-sam-translate | MISSING | MISSING |

> ⚠️ **Three resources have `DeletionPolicy: Delete` explicitly set** — these are GUARANTEED to be destroyed if their stack is ever replaced or deleted. Must be changed to `Retain`.

### Infrastructure Templates Missing DeletionPolicy (non-app)

| Resource LogicalId | Type | Stack | Note |
|---|---|---|---|
| SourceBucket | S3::Bucket | api-pipeline-codebuild | CI/CD artifact bucket |
| DownloadsBucket | S3::Bucket | downloads-hosting | Public downloads |
| RedirectBucket | S3::Bucket | nexcortiq-com-redirect | Marketing redirect |
| RedirectBucket | S3::Bucket | rapidcortex-us-redirect | Marketing redirect |
| WebSiteBucket | S3::Bucket | web-hosting-template | Static site hosting |
| SourceBucket | S3::Bucket | web-pipeline-codebuild | Web CI/CD artifacts |

### Protected Resources (135 total — partial list of key ones)

The following critical resources already have `DeletionPolicy: Retain`:
- All `stack-app-sam-6` Vision resources (VisionCamerasTable, VisionSessionsTable, etc.)
- All `stack-app-sam-cad` tables (CadConnectorsTable, CadUnifiedIncidentsTable, etc.)
- All `stack-app-sam-features` tables
- All `stack-app-sam-call-assist` tables
- All `stack-app-sam-c2c` tables
- `CognitoUserPool`, `CognitoUserPoolClient` in `stack-app-sam`

---

## Phase 1b — Nested Stack Dependency Map

**Root template `infra/template.yaml` contains 45 nested stacks:**

```
DataLayerStack           (standalone — deployed separately)
├── LoadoutDataStack     → stack-data-layer-loadout.yaml
├── NexiQIntelDataStack  → stack-data-layer-nexiq-intel.yaml
└── GrantsDataStack      → stack-data-layer-grants.yaml

AppSamStackV2            → stack-app-sam.yaml            (primary app — incidents, CAD, QA)
AppSam2Stack             → stack-app-sam-2.yaml           (language, analytics, comms)
AppSam3Stack             → stack-app-sam-3.yaml           (video, agency admin, RC admin)
AppSam4Stack             → stack-app-sam-4.yaml           (billing/payments, Nest/Wyze)
AppSam5Stack             → stack-app-sam-5.yaml
AppSam6Stack             → stack-app-sam-6.yaml           (Rapid Vision)

AppSamQrStack            → stack-app-sam-qr.yaml
AppSamBusinessCardsStack → stack-app-sam-business-cards.yaml
AppSamBillingStack       → stack-app-sam-2-billing.yaml
AppSamHospital2Stack     → stack-app-sam-2-hospital.yaml
AppSamTransitStack       → stack-app-sam-transit.yaml
AppSamCadStack           → stack-app-sam-cad.yaml
AppSamRcsStack2          → stack-app-sam-2-rcs.yaml
AppSamNg911Stack2        → stack-app-sam-2-ng911.yaml
AppSamCallAssistStack2   → stack-app-sam-call-assist.yaml
AppSamTranslateStack2    → stack-app-sam-translate.yaml
AppSamCadBridgeStack2    → stack-app-sam-cad-bridge.yaml
AppSamCadMeshStack       → stack-app-sam-cad-mesh.yaml
AppSamFeaturesStack      → stack-app-sam-features.yaml
AppSamCommsIntelStack    → stack-app-sam-comms-intel.yaml
AppSamLocationStack2     → stack-app-sam-location.yaml
AppSamVerticalAlertsStack2 → stack-app-sam-vertical-alerts.yaml
AppSamCleryActStack5     → stack-app-sam-clery-act.yaml
AppSamPreArrivalStack    → stack-app-sam-pre-arrival.yaml
AppSamPhysicalSecurityStack5 → stack-app-sam-physical-security.yaml
AppSamMilestoneStack5    → stack-app-sam-milestone.yaml
AppSamRealtime2Stack     → stack-app-sam-2-realtime.yaml
AppSamAlarmsStack        → stack-app-alarms.yaml

AppSamFieldStack         → stack-app-sam-field.yaml
AppSamGisStack           → stack-app-sam-gis.yaml
AppSamPsapCrmStack       → stack-app-sam-3-psap-crm.yaml
AppSamNexiQSignalsStack  → stack-app-sam-nexiq-signals.yaml
AppSamRapidIqStack       → stack-app-sam-rapid-iq.yaml
AppSamRapidIqPipelineStack → stack-app-sam-rapid-iq-pipeline.yaml
AppSamMcpWatchStack      → stack-app-sam-mcp-watch.yaml
AppSamEscalationStack    → stack-app-sam-escalation.yaml
AppSamRmsStack           → stack-app-sam-rms.yaml
LoadoutAppStack          → stack-app-sam-loadout.yaml
AppSamNexiQIntelStack    → stack-app-sam-nexiq-intel.yaml
AppSamIqAnalyticsStack   → stack-app-sam-analytics.yaml
AppSamGrantsStack        → stack-app-sam-grants.yaml
```

**Safe Deploy Order (bottom-up):**
1. `stack-data-layer.yaml` (standalone) — tables, buckets, secrets
2. Sub-data stacks: `stack-data-layer-loadout.yaml`, `stack-data-layer-nexiq-intel.yaml`, `stack-data-layer-grants.yaml`
3. Primary app: `stack-app-sam.yaml` (AppSamStackV2)
4. Secondary apps: `stack-app-sam-2.yaml`, then all feature stacks
5. Root `template.yaml` last (parent)

---

## Phase 1c — Termination Protection Audit

**Result: ALL 73 stacks have `EnableTerminationProtection: False`.**

This means any IAM user or CI pipeline can run `aws cloudformation delete-stack <name>` and destroy the entire production environment with no guardrail.

### Stacks in Unhealthy State (non-UPDATE_COMPLETE/CREATE_COMPLETE):

| Stack Name | Status | Action Required |
|---|---|---|
| rapid-cortex-dev | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-dev-DataLayerStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-dev-AppSamStackV2-* | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-dev-AppSam2Stack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-dev-AppSamGrantsStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-dev-AppSam3Stack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-dev-AppSam4Stack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-dev-AppSamBillingStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-dev-AppSamCadStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy in progress |
| rapid-cortex-cad-session-open-dev | UPDATE_ROLLBACK_COMPLETE | Investigate separately |
| rapid-cortex-dev-AppSamTranslateStack2-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamCallAssistStack2-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamLocationStack2-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamCadBridgeStack2-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamFieldStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamRmsStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamNg911Stack2-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamPsapCrmStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamRapidIqStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamEscalationStack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamRapidIqPipelineStack | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamRealtime2Stack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-dev-AppSamHospital2Stack-* | UPDATE_ROLLBACK_COMPLETE | Active deploy |
| rapid-cortex-v2-web-hosting-prod | UPDATE_ROLLBACK_COMPLETE | Investigate — prod web |
| EPharmacyStack | REVIEW_IN_PROGRESS | Orphan stack — investigate |
| rapid-cortex-web-ssr-prod-v2 | UPDATE_ROLLBACK_COMPLETE | Prod web — investigate |

---

## Phase 1d — deploy.sh Behavior Audit

**File:** `scripts/deploy.sh`

| Question | Answer |
|---|---|
| Full-tree deploy on every run? | **YES** — runs `sam deploy` against root `infra/template.yaml` which CloudFormation expands into all 45 nested stacks |
| Changeset preview before apply? | **NO** — `--no-confirm-changeset` passed; no `--no-execute-changeset` preview step |
| Stops on first failure? | **NO** — CloudFormation handles failures via per-stack rollback; deploy continues for independent stacks |
| Per-stack deploy option? | **NO** — not currently supported; added as Phase 5 deliverable |
| Template validation? | **YES** — `sam validate --lint` loop runs against ~60 templates before every deploy |
| Nested stack removal guard? | **NO** — no diff against deployed template; removing a stack from template.yaml silently deletes it |
| Stateful resource protection guard? | **NO** — no changeset inspection for `Replacement: True` on DynamoDB/S3/Cognito |
| External drive guard? | **YES** — warns/blocks when repo is on `/Volumes/*` |
| CAD writeback guard? | **YES** — explicit env check blocks CAD writeback on staging/prod |

---

## Phase 2 — DeletionPolicy Remediation (pending active deploy)

**Files to modify:**
1. `infra/nested/stack-app-sam.yaml` — 4 tables
2. `infra/nested/stack-app-sam-4.yaml` — 3 tables + 1 secret (NestOAuthStateTable: Delete→Retain)
3. `infra/nested/stack-app-sam-cad-bridge.yaml` — 2 tables (Delete→Retain CRITICAL)
4. `infra/nested/stack-app-sam-location.yaml` — 1 Cognito Identity Pool
5. `infra/nested/stack-app-sam-mcp-watch.yaml` — 1 secret
6. `infra/nested/stack-app-sam-qr.yaml` — 1 table
7. `infra/nested/stack-app-sam-transit.yaml` — 1 secret
8. `infra/nested/stack-app-sam-translate.yaml` — 1 secret

**Will be applied after active deploy completes.**

---

## Phase 3 — Termination Protection

Script: `scripts/enable-stack-protection.sh`
Run after active deploy completes to protect all stacks.

---

## Phase 4 — Stack Policies

Policy files in `stack-policies/`:
- `data-layer-policy.json` — prevents Replace/Delete of DynamoDB tables, S3 buckets, Cognito pools, Secrets, Kinesis streams
- `app-layer-policy.json` — prevents Replace/Delete of DynamoDB tables + S3 in app-layer stacks
- `infra-layer-policy.json` — allows all updates (ephemeral resources only: Lambda, API GW, IAM roles)

**To apply after deploy completes:**
```bash
# Dry run first to see what will change:
bash scripts/apply-stack-policies.sh dev --dry-run

# Apply:
bash scripts/apply-stack-policies.sh dev
```

Script: `scripts/apply-stack-policies.sh` — auto-discovers stack names by stage and applies policies.

---

## Phase 5 — Surgical Deploy Modes

New `deploy.sh` modes (added 2026-11-17):
- `deploy.sh full dev` — existing full-tree deploy
- `deploy.sh stack dev <stack-logical-id>` — deploy one nested stack
- `deploy.sh preview dev [stack-logical-id]` — changeset preview, no execution

---

## Phase 6 — Nested Stack Removal Guard

Script: `scripts/check-stack-removals.sh`
Diffs current `template.yaml` against deployed root stack template.
Blocks deploy when nested stack removals are detected without `--confirm-stack-removals`.

---

## Phase 7 — Post-Deploy Health Check

Script: `scripts/stack-health-check.sh`
Run before and after every deploy. Reports all stacks not in `UPDATE_COMPLETE`/`CREATE_COMPLETE`.

---

## Remediation Checklist

- [x] Phase 1: Audit completed (2026-11-17)
- [x] Phase 2: DeletionPolicy + UpdateReplacePolicy added to 16 at-risk resources in 8 templates (2026-11-17)
- [ ] Phase 3: Termination protection enabled on all 73 stacks — run `bash scripts/enable-stack-protection.sh dev` after deploy
- [ ] Phase 4: Stack policies applied — run `bash scripts/apply-stack-policies.sh dev` after deploy
- [x] Phase 5: `full`, `stack`, and `preview` modes added to deploy.sh (2026-11-17); `stack` mode uses `sam deploy --resolve-s3`
- [x] Phase 6: `scripts/check-stack-removals.sh` created + integrated into deploy.sh (2026-11-17)
- [x] Phase 7: `scripts/stack-health-check.sh` created + integrated into deploy.sh (2026-11-17)
- [x] Phase 4 script: `scripts/apply-stack-policies.sh` created (2026-11-17)
- [ ] Phase 8: Active deploy completes and all stacks reach UPDATE_COMPLETE
- [ ] Phase 9: `rapid-cortex-cad-session-open-dev` UPDATE_ROLLBACK_COMPLETE investigated
- [ ] Phase 10: `rapid-cortex-v2-web-hosting-prod` UPDATE_ROLLBACK_COMPLETE investigated
- [ ] Phase 11: `EPharmacyStack` REVIEW_IN_PROGRESS investigated (orphan?)

---

*NexCortiQ Deployment Stabilization | Apps on Demand LLC d/b/a NexCortiQ*
*AWS Account: 158961537080 | Management Account | Org o-ethiwbmo4n*
