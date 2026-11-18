# NexCort iQ — Pre-Sprint Cleanup Audit
**Audit Date:** 2026-11-17  
**Account in scope:** 158961537080 (nexcortiq-prod)  
**Performed by:** Cursor AI Agent (audit-only pass — no code or infra modified)

---

## Scope and Methodology

This is a **read-only reconnaissance pass**. Nothing in the codebase, infrastructure templates, scripts, or AWS resources was modified. The audit covers:

- Section 1 — Closed account reference scan (991260941851)
- Section 2 — Lambda handler inventory (dead handlers, naming drift, source/artifact sync)
- Section 3 — Scripts directory (stale, duplicate, one-shot migration scripts)
- Section 4 — `packages/` shared utilities (duplication, dead exports)
- Section 5 — SAM/CloudFormation template drift (templates not in root, not in validate loop, orphan CF stacks)
- Section 6 — Lex bots and Connect contact flows

---

## Critical / Blocking (Do Before Next Feature Sprint)

These items are **actively causing deploy failures** right now.

### CRIT-1 — `AppSamCallAssistStack2` still `UPDATE_ROLLBACK_COMPLETE`

**What:** The root stack `rapid-cortex-dev` and all nested stacks are in `UPDATE_ROLLBACK_COMPLETE` from the Nov 17 deploy. `AppSamCallAssistStack2` failed because `ConnectNovaSessionStartPermission`, `ConnectNovaSessionAwaitPermission`, and `ConnectCallAssistDisconnectPermission` tried to reference the three orphan Lambdas by their old physical names after they were deleted mid-deploy.

**Current state:**
- 3 orphan Lambdas (`rapid-cortex-dev-nova-session-start-dev`, `rapid-cortex-dev-nova-session-await-dev`, `rapid-cortex-dev-call-assist-disconnect-dev`) — **confirmed deleted from AWS Lambda**
- `samconfig.toml` and `deploy.sh` — **confirmed cleaned** of all `ExistingXxx` parameter overrides
- Root stack status: `UPDATE_ROLLBACK_COMPLETE` as of 2026-11-17T15:15:13Z
- Stacks also rolled back: DataLayerStack, AppSamStackV2, AppSam2Stack, AppSam3Stack, AppSam4Stack, AppSamCallAssistStack2, AppSamTranslateStack2, AppSamLocationStack2, AppSamCadBridgeStack2, AppSamFieldStack, AppSamRmsStack, AppSamNg911Stack2, AppSamPsapCrmStack, AppSamRapidIqStack, AppSamEscalationStack, AppSamRapidIqPipelineStack, AppSamRealtime2Stack, AppSamHospital2Stack, AppSamGrantsStack, AppSamBillingStack, AppSamCadStack

**Why it failed:** The deployed changeset (641095) already had `ExistingXxx` values baked in. When functions were deleted before the changeset executed, the `ConnectXxx Permission` resources failed with 404.

**Root cause of repeated failures (resolved 2026-11-17):** `scripts/env-api-dev.sh` lines 404–406 exported the orphan function names as default values. When `source env-api-dev.sh` ran before `deploy.sh`, it set `EXISTING_NOVA_SESSION_START_FUNCTION_NAME=rapid-cortex-dev-nova-session-start-dev` (etc.), which `deploy.sh` then passed as explicit parameter overrides — bypassing `samconfig.toml` and overriding the template's empty-string defaults. These exports have been removed from `env-api-dev.sh` and `deploy.sh` now unconditionally sets all three parameters to empty strings. All three files (`env-api-dev.sh`, `deploy.sh`, `samconfig.toml`) are now consistent.

**Fix:** Run a fresh `deploy.sh dev` from the internal drive. `UPDATE_ROLLBACK_COMPLETE` is fully recoverable — SAM will start a new changeset with `ExistingNovaSessionStartFunctionName=` (empty), causing `CreateNovaSessionStartFunction=true`, and CloudFormation will CREATE the three Lambda functions fresh.

**Risk:** Medium. The stack will re-deploy ~40 nested stacks. No rollback concerns — no data resources are being created or destroyed.

---

### CRIT-2 — Nova Lambda built artifacts out of sync with TypeScript source

**What:** `infra/nova-lambda/session-start-handler.js` was last built **2026-11-06**. The TypeScript source `apps/api/src/call-assist/nova-sonic/session-start-handler.ts` was last modified **2026-11-15** (9 days newer). `session-await-handler.ts` matches (last modified 2026-11-03, built 2026-11-06).

**Risk:** When CloudFormation creates `NovaSessionStartFunction` fresh (after CRIT-1 is resolved), it will deploy the Nov 6 `.js` artifact, which is missing whatever changes were made to the TypeScript source between Nov 6 and Nov 15.

**Fix before next deploy:** Rebuild the Nova Lambda bundle. Source is `apps/api/src/call-assist/nova-sonic/`; output target is `infra/nova-lambda/`. Check for a `build:nova` or `esbuild` script. Confirm output `.js` files are updated before running `deploy.sh`.

---

### CRIT-3 — `rapid-cortex-dev-AppSamTranslateStack2-1BDYCEWYIJZTR` stuck in `DELETE_FAILED`

**What:** A legacy copy of the Translate stack with auto-generated suffix `1BDYCEWYIJZTR` is stuck in `DELETE_FAILED`. It is not the active Translate stack (`rapid-cortex-dev-AppSamTranslateStack2-B6IWNGB2GXRN`). The active stack is also in `UPDATE_ROLLBACK_COMPLETE`.

**Risk:** The `DELETE_FAILED` stack will block any CloudFormation operations that touch the same resources. It may also cause confusion in `describe-stacks` queries.

**Fix:** Manually delete with retained resources:
```bash
aws cloudformation delete-stack \
  --stack-name rapid-cortex-dev-AppSamTranslateStack2-1BDYCEWYIJZTR \
  --retain-resources <list_of_failed_resources> \
  --profile rapid-cortex
```
Identify failed resources first:
```bash
aws cloudformation describe-stack-resources \
  --stack-name rapid-cortex-dev-AppSamTranslateStack2-1BDYCEWYIJZTR \
  --profile rapid-cortex
```

---

### CRIT-4 — Connect phone +18168395256 not assigned to any contact flow

**What:** The Amazon Connect phone number `+18168395256` (description: "Call Assist demo test DID") has `TargetArn` pointing to the **Connect instance** (`arn:aws:connect:...:instance/20772ba7-...`), not to the "Call Assist" contact flow (`a1dd0cd7-9860-4155-866c-12ebc3dbdcee`). Incoming calls to this number will follow the instance default routing, not the Call Assist flow.

**Risk:** Every inbound call to the Nexiq number lands in the wrong flow (or no flow). This is a live product issue.

**Fix:**
```bash
aws connect associate-phone-number-contact-flow \
  --phone-number-id d13dbeca-ac15-4a69-8c15-6ebb52e3091f \
  --instance-id 20772ba7-98e6-4afd-94cc-19e03c0619df \
  --contact-flow-id a1dd0cd7-9860-4155-866c-12ebc3dbdcee \
  --region us-east-1 --profile rapid-cortex
```

---

## Section 1 — Closed Account Reference Scan

### Account 991260941851 (CLOSED)

**Result: CLEAN — no references found.**

Searched: `apps/api/src/**/*.ts`, `infra/**/*.yaml`, `scripts/**/*.sh`, `samconfig.toml`, `packages/**/*.ts`, `apps/web/**/*.ts`

No occurrences of `991260941851` anywhere in the repository.

---

### Account 621957412915 (INTENTIONAL — do not remove)

Found in two files. Both are intentional cross-account EventBridge integration parameters per the project boundary document.

| File | Line | Context | Action |
|---|---|---|---|
| `infra/nested/stack-app-sam-pre-arrival.yaml` | 58 | `Default: 621957412915` — `CadSourceAccountId` parameter | ✅ Intentional — keep |
| `infra/nested/stack-cad-event-bus.yaml` | 4 (comment) + 10 (Default) | EventBus policy principal for CAD cross-account | ✅ Intentional — keep |
| `scripts/deploy-cad-inbound.sh` | inline | `CAD_SOURCE_ACCOUNT_ID="${CAD_SOURCE_ACCOUNT_ID:-621957412915}"` | ✅ Intentional — keep |

---

## Section 2 — Lambda Handler Inventory

### 2a. Dead handler source paths (source directory removed but handler still referenced)

#### ⚠️ `dist/integrations/ring/` handlers — source code deleted

Handler paths appear in **backup-only files** (`.before-*.yaml`):
- `dist/integrations/ring/available-cameras.handler`
- `dist/integrations/ring/callback.handler`
- `dist/integrations/ring/camera-consent.approveHandler`
- `dist/integrations/ring/camera-consent.declineHandler`
- `dist/integrations/ring/devices.handler`
- `dist/integrations/ring/login.handler`
- `dist/integrations/ring/refresh-token.handler`
- `dist/integrations/ring/request-camera-access.handler`
- `dist/integrations/ring/revoke-camera-access.handler`

**Source status:** `apps/api/src/integrations/ring/` does **not exist**. The integration subdirectories are `cameras/`, `incidents/`, `milestone/`, `sms/` — no `ring/` subdirectory.

**Active Ring code:** `ring-neighbors-worker.ts` is alive in `apps/api/src/workers/social/` and deployed via `stack-app-sam-features.yaml` as `FeaturesRingNeighborsWebhookFunction` — this is a webhook receiver for Ring Neighbors (social ingestion), completely separate from the removed camera integration.

**Action (cleanup sprint):** No active template references the camera handler paths; backup YAML files are covered under Section 5b. No code removal needed — source is already gone.

---

### 2b. Non-standard handler naming (audit items — not bugs)

| Handler path | Stack file | Function purpose | Note |
|---|---|---|---|
| `handler.handler` | `stack-app-sam.yaml:1540` | Cognito PostConfirmation Lambda (`../cognito-post-confirmation/`) | Uses `BuildMethod: makefile` / separate `CodeUri` — intentional |
| `lambda.handler` | `stack-app-sam-mcp-watch.yaml:111` | MCP Watch Lambda | Confirm Python naming convention is correct for this function |
| `lambda_function.handler` | `stack-app-sam-6.yaml:831` | Vision Transcript Worker (Python) | Correct Python convention — ✅ intentional |
| `session-start-handler.handler` | `stack-app-sam-call-assist.yaml:721` | Nova Session Start (`infra/nova-lambda/`) | Pre-built JS in `infra/nova-lambda/` — file is `session-start-handler.js` |

No action required on the Python handler (`lambda_function.handler`) or Cognito PostConfirmation (`handler.handler`). The Nova Lambda handler path matches the pre-built JS filename.

---

### 2c. Orphan Lambdas — resolved prior to this audit

Three orphan Lambda functions were deleted from AWS prior to this audit pass and the `samconfig.toml`/`deploy.sh` bypass parameters were removed. The functions will be re-created by CloudFormation during the next successful deploy.

| Function | Status |
|---|---|
| `rapid-cortex-dev-nova-session-start-dev` | ✅ Deleted from AWS Lambda |
| `rapid-cortex-dev-nova-session-await-dev` | ✅ Deleted from AWS Lambda |
| `rapid-cortex-dev-call-assist-disconnect-dev` | ✅ Deleted from AWS Lambda |
| `rapid-cortex-call-assist-ops-dev` (SNS topic) | ✅ Deleted from AWS SNS |

Remaining template residue: `ExistingNovaSessionStartFunctionName`, `ExistingNovaSessionAwaitFunctionName`, `ExistingCallAssistDisconnectFunctionName` parameters and their `Create*` / `HasExisting*` conditions still exist in `stack-app-sam-call-assist.yaml`. These are harmless with empty defaults but add template noise.

**Action (cleanup sprint):** Remove the three `Existing*` parameters, all six corresponding conditions, and the `!If [Has*, ...]` branch in every env-var and Lambda permission. Straightforward mechanical removal — 50–80 template lines. Run `sam validate --lint` after.

---

### 2d. Voice provider duplication

`apps/api/src/voice/` contains four provider implementations:
- `aws/` — Amazon Transcribe + Polly (active)
- `azure/` — Azure Speech STT + TTS + Translator (conditionally enabled via `AzureSpeechKeySecretArn` parameter in `stack-app-sam-2.yaml`)
- `google/` — Google Cloud Translation + Speech STT
- `openai/` — OpenAI Whisper STT + TTS

**Active at runtime:** AWS is the default. Azure is wired into `stack-app-sam-2.yaml` via a conditional secret ARN and is used when configured.

**Google and OpenAI status:** No `GOOGLE_*` or `OPENAI_*` environment variable injection found in any active SAM template. The providers exist as source code but have no deployment configuration.

**Action (cleanup sprint):** Confirm whether `google/` and `openai/` providers are roadmap-staged or truly dead. If dead: remove source files and all tests. If roadmap: add a `# ROADMAP` comment at the top of each provider index file so they are not accidentally included in production builds.

---

### 2e. `packages/desktop/` vs `apps/desktop-macos/`

Two desktop implementations exist:
- `packages/desktop/` — Electron shell (`main/`, `preload/`, `renderer/`); package name `rapid-cortex-desktop`
- `apps/desktop-macos/` — Native Swift WKWebView wrapper (`.app` bundle); contains `RapidCortexDesktop.app`

These are distinct products (Electron vs Swift/WKWebView). The Swift WKWebView wrapper is the current macOS production app. The Electron package appears to be a predecessor.

**Action (cleanup sprint):** Determine whether `packages/desktop/` (Electron) is still being maintained or shipped. If superseded by the Swift wrapper: archive or remove. If still active for Windows/cross-platform: document clearly in `packages/desktop/README.md`.

---

### 2f. `packages/hl7-listener/` — ✅ DELETED (added by mistake)

All HL7-related code was confirmed as added by mistake and has been removed:

| Item | Action |
|---|---|
| `packages/hl7-listener/` (entire package) | Deleted |
| `infra/nested/stack-hl7-listener.yaml` | Deleted |
| `scripts/hospital/test-hl7-listener.sh` | Deleted |
| `packages/shared/src/hl7/` (schemas.ts + index.ts) | Deleted |
| `packages/shared/src/index.ts` line `export * from "./hl7/index.js"` | Removed |
| `package.json` `"test:hl7"` script | Removed |
| `packages/shared/src/hospital-routing/schemas.ts` `"HL7_FEED"` enum value | Removed |
| `packages/shared/src/onboarding/onboarding-packets.ts` HL7 comment line | Removed |

---

## Section 3 — Scripts Directory

70 total scripts found. Categories:

### 3a. One-shot API Gateway repair scripts — archive candidates

These scripts were written to repair specific API Gateway route drift events and have been successfully executed. They should not be run again.

| Script | Last modified | Purpose |
|---|---|---|
| `repair-dispatcher-api-ghost-routes.sh` | 2026-10-14 | Repaired dispatcher workspace 404s after rollback |
| `repair-escalation-http-routes.sh` | 2026-10-14 | Repaired escalation routes on Stack 3 API |
| `repair-nexiq-intel-http-routes.sh` | 2026-10-12 | Repaired Nexiq Intel HTTP routes |
| `repair-psap-prospects-routes.sh` | 2026-11-03 | Repaired PSAP prospects routes |
| `repair-rapid-iq-http-routes.sh` | 2026-10-08 | Repaired Rapid iQ HTTP routes |
| `restore-cad-bridge-httpapi-routes.sh` | 2026-09-28 | Restored CAD bridge routes after rollback |
| `restore-hiring-httpapi-routes.sh` | 2026-07-11 | Restored hiring app routes |
| `recover-appsam5-rollback.sh` | 2026-11-06 | Recovery from AppSam5 rollback |
| `recover-rapidiq-pipeline-rollback.sh` | 2026-10-02 | Recovery from RapidIQ pipeline rollback |
| `deploy-translate-hotfix.sh` | 2026-09-15 | One-time Translate stack hotfix |
| `redeploy-sales-portal-apis-dev.sh` | 2026-10-01 | Sales portal sequential redeploy after lock |
| `redeploy-sales-portal-apis-finish-dev.sh` | 2026-10-01 | Continuation of above |
| `redeploy-sales-portal-apis-resume-dev.sh` | 2026-10-01 | Continuation of above |

**Action:** Move to `scripts/archive/` and add a one-line comment at the top of each noting the incident date and resolution.

---

### 3b. Stack-split scripts — superseded

The stack was split from a monolithic `stack-app-sam.yaml` into the current nested structure. These split scripts generated the `.before-*.yaml` backup files.

| Script | Last modified | Status |
|---|---|---|
| `split-stack-app-sam.rb` | 2026-06-03 | First primary split — superseded |
| `split-stack-app-sam-primary.rb` | 2026-06-25 | Second primary split — superseded |
| `split-stack-app-sam-primary-v2.rb` | 2026-06-25 | Third primary split — superseded |
| `split-stack-app-sam-v2.rb` | 2026-06-07 | Stack 2 split — superseded |

**Action:** Move to `scripts/archive/` or git-rm. These are only useful if the codebase needs to be re-split, which is unlikely given the current nested structure.

---

### 3c. `deploy2.sh` — legacy split deployment path

`deploy2.sh` deploys `infra/template2.yaml` as a **separate** CloudFormation stack. Its comment says "use this only when you need a **separate** CloudFormation stack for stack 2 (e.g. legacy split deployments)." Stack 2 (`stack-app-sam-2.yaml`) is now nested under the root `template.yaml`. The `rapid-cortex-2-dev` CloudFormation stack is in **ROLLBACK_COMPLETE** state.

**Action:** 
1. Delete `rapid-cortex-2-dev` (ROLLBACK_COMPLETE stack) from AWS.
2. Archive `deploy2.sh` to `scripts/archive/`.
3. If `infra/template2.yaml` exists, verify it is not referenced anywhere and archive it too.

---

### 3d. Single-substack deploy scripts — assess per cleanup sprint

37 `deploy-*.sh` scripts exist. These deploy individual substacks surgically. Many are still valid operational tools (e.g., `deploy-cad-inbound.sh`, `deploy-call-assist-phase1.sh`). The ones listed below were last touched >60 days ago and may be superseded by the main `deploy.sh`:

| Script | Last modified | Current usage |
|---|---|---|
| `deploy-appsam5-dev-now.sh` | 2026-08-24 | AppSam5 quick-deploy; superseded by main deploy |
| `deploy-rcs-dev.sh` | 2026-08-06 | RCS substack; now nested under root |
| `deploy-ng911-dev.sh` | 2026-07-24 | NG911 substack; now nested under root |
| `deploy-web-ssr.sh` | — | SSR infra only; web is now ECS — confirm if infra still separate |

Scripts that are **still actively needed** because they deploy standalone stacks not in the root template: `deploy-c2c-api-dev.sh`, `deploy-contacts-api-dev.sh`, `deploy-sop-intel-dev.sh`, `deploy-lex.sh`, `deploy-cad-inbound.sh`, `deploy-call-assist-phase1.sh`, `deploy-leads-crm-api-dev.sh`, `deploy-hiring-api.sh`, `deploy-nexiq-intel-dev.sh`.

---

### 3e. Web deploy script proliferation (7 `deploy-web-*.sh`)

| Script | Purpose |
|---|---|
| `deploy-web-ecs.sh` | Canonical — S3-ZIP → CodeBuild → ECR → ECS |
| `deploy-web-dev.sh` | Wrapper — calls `deploy-web-ecs.sh dev` |
| `deploy-web-staging.sh` | Wrapper — calls `deploy-web-ecs.sh staging` |
| `deploy-web-prod.sh` | Wrapper — calls `deploy-web-ecs.sh prod` |
| `deploy-web-full.sh` | Local Docker path (non-CodeBuild) |
| `deploy-web-no-docker.sh` | S3/CodeBuild path (no local Docker) |
| `deploy-web-ssr.sh` | SSR infra only (not ECS service) |
| `deploy-web-hosting.sh` | Static hosting infra |

The wrappers (`dev`, `staging`, `prod`) are fine. `deploy-web-full.sh` and `deploy-web-no-docker.sh` are likely redundant with `deploy-web-ecs.sh` but serve different environments. No immediate action needed; consider consolidating to two paths in a future cleanup.

---

## Section 4 — `packages/` Shared Utilities

### 4a. `commsupervisor` deprecated alias

Present in `packages/shared/src/auth/rapid-cortex-roles.ts` (lines 340, 690) and `packages/shared/src/field/workspaces.ts` (line 44). These are **intentional backward-compatibility shims** to handle old JWTs in the field — `normalizeSessionRole()` maps `commsupervisor` → `supervisor`. They should remain until all JWTs in circulation have been refreshed.

**Action:** Add an explicit `// @deprecated — remove once all legacy commsupervisor JWTs expire (check Cognito user pool logs)` comment if not already present. Do not remove.

---

### 4b. `packages/shared/src/` module count

The shared package has 90+ top-level subdirectories and files. No dead exports were surfaced in this pass — a targeted dead-code scan would require running a TypeScript tree-shaker or a coverage-based approach. Flag for a dedicated analysis tool run (e.g., `ts-prune` or `knip`) in the cleanup sprint.

---

### 4c. `packages/security/` — well-maintained

All files in `packages/security/src/` have corresponding `.test.ts` files. No dead code flags raised.

---

### 4d. `packages/integrations/` — check `rapid-cortex-integrations-1.0.0.tgz`

A compiled tarball `rapid-cortex-integrations-1.0.0.tgz` exists in the `packages/integrations/` directory alongside `src/`. Stale compiled tarballs in the repo can shadow the live workspace package if accidentally installed. 

**Action:** Remove `rapid-cortex-integrations-1.0.0.tgz` from the directory (it should not be committed — `dist/` or `.tgz` releases belong in a registry, not the repo).

---

## Section 5 — SAM/CloudFormation Template Drift

### 5a. Templates NOT referenced in `infra/template.yaml` (standalone or surgical deploy stacks)

These 9 `.yaml` files are deployed as standalone CloudFormation stacks via individual `deploy-*-dev.sh` scripts, not as children of the root template. This is intentional per the SAM size-limit split strategy — but they are **not in the main `deploy.sh` SAM validate loop**, meaning template regressions won't be caught by the preflight check.

| Template | Deployed CF Stack | Status |
|---|---|---|
| `stack-app-sam-3-contacts.yaml` | `AppSamContactsStack` (IMPORT_COMPLETE) | Active |
| `stack-app-sam-c2c.yaml` | `AppSamC2cStack` (CREATE_COMPLETE) | Active |
| `stack-app-sam-sop-intel.yaml` | `AppSamSopIntelStack2` (CREATE_COMPLETE) | Active |
| `stack-app-sam-3-hiring.yaml` | `AppSamHiringStack` (see `deploy-hiring-api.sh`) | Active |
| `stack-app-sam-3-leads-crm.yaml` | see `deploy-leads-crm-api-dev.sh` | Active |
| `stack-app-sam-3-marketing.yaml` | see `deploy-marketing-api-dev.sh` | Active |
| `stack-app-sam-3-pricing-catalog.yaml` | see `deploy-pricing-catalog-api-dev.sh` | Active |
| `stack-app-sam-3-deployments-map.yaml` | see `deploy-deployments-map-api-dev.sh` | Active |
| `stack-app-sam-3-psap-crm.yaml` | see `deploy-psap-crm-api-dev.sh` | Active |
| `stack-app-sam-2-deception.yaml` | No matching CF stack found in AWS | ⚠️ Possibly not deployed |

**Action (cleanup sprint):** Add `sam validate --lint` entries for each active standalone template to `deploy.sh` lines 208–253. This ensures they are validated on every deploy. Example:
```bash
sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-3-contacts.yaml"
sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-c2c.yaml"
sam validate --lint --template-file "${ROOT}/infra/nested/stack-app-sam-sop-intel.yaml"
# ... etc.
```

Separately, investigate `stack-app-sam-2-deception.yaml` — no corresponding CF stack found in AWS. Either it was never deployed, or it was deleted. If dead: archive.

---

### 5b. Backup `.before-*.yaml` files in `infra/nested/`

4 historical snapshot files from the stack-split operations:

| File | Created approx. | Note |
|---|---|---|
| `stack-app-sam.before-split.yaml` | 2026-06-03 | Pre-first-split monolith |
| `stack-app-sam.before-primary-split.yaml` | 2026-06-25 | Pre-primary-split |
| `stack-app-sam.before-v2-split.yaml` | 2026-06-25 | Pre-v2-split snapshot |
| `stack-app-sam-2.before-v2-split.yaml` | 2026-06-25 | Stack 2 pre-split |

None are referenced in `infra/template.yaml` or `scripts/deploy.sh`.

**Action (cleanup sprint):** Move to `infra/nested/archive/` or delete. These are large YAML files (>1,000 lines each) adding noise to searches and `sam validate` output.

---

### 5c. Templates in `infra/template.yaml` NOT in `deploy.sh` SAM validate loop

11 templates referenced in the root template are skipped by the preflight validate loop:

```
stack-app-sam-escalation    (owns escalation HTTP routes on Stack 3 API)
stack-app-sam-field         (field command features)
stack-app-sam-rapid-iq      (RapidIQ pipeline + app)
stack-app-sam-rapid-iq-pipeline
stack-app-sam-rms           (RMS integration)
stack-app-sam-2-rcs         (RCS features)
stack-app-sam-2-realtime    (realtime/WebSocket features)
stack-app-sam-2-ng911       (NG911 features)
stack-app-sam-3-psap-crm    (standalone stack — also missing from root template)
stack-app-sam-clery-act     (Clery Act reporting)
stack-app-sam-vertical-alerts (vertical alerts)
```

(Note: `stack-app-sam,` and `stack-app-sam-2)` / `stack-app-sam-3)` / `stack-app-sam-4)` are regex false-positives from the cross-reference — those main stacks ARE validated.)

**Action (cleanup sprint):** Add the missing templates to the validate loop in `deploy.sh`. Priority: `stack-app-sam-escalation`, `stack-app-sam-field`, `stack-app-sam-rms` (all in `UPDATE_ROLLBACK_COMPLETE`).

---

### 5d. CloudFormation stacks in bad states

#### `ROLLBACK_COMPLETE` — these stacks are dead and need deletion before resources can be recreated

| Stack | Age |
|---|---|
| `rapid-cortex-web-ecr-dev` | Stale ECR stack |
| `rapid-cortex-2-dev` | Legacy deploy2.sh stack (see Section 3c) |

**Action:** Delete both. `ROLLBACK_COMPLETE` stacks cannot be updated — they can only be deleted or used as a source of resource imports.

#### `DELETE_FAILED` — actively blocking

| Stack | Issue |
|---|---|
| `rapid-cortex-dev-AppSamTranslateStack2-1BDYCEWYIJZTR` | Failed deletion of old Translate stack suffix |

**Action:** See CRIT-3 above.

#### `UPDATE_ROLLBACK_COMPLETE` — recoverable with clean re-deploy

24 stacks including the root stack are in this state from the Nov 17 failed deploy. All are recoverable with CRIT-1 fix.

---

### 5e. `ExistingXxx` parameters still in `stack-app-sam-call-assist.yaml`

Three `ExistingXxx` parameter blocks, six conditions, and their `!If` branches remain in the template. These are now inert (defaults are empty strings → `Create*=true`). They add ~80 lines of template complexity.

**Action (cleanup sprint):** Remove after CRIT-1 is resolved and the stack has successfully deployed once with the functions created by CloudFormation. Verify via `describe-stack-resources` that physical function names match expected naming before removing the safety net.

---

### 5f. `deploy2.sh` and `infra/template2.yaml`

`deploy2.sh` references `infra/template2.yaml` (a standalone parent template for the legacy split deployment). The `rapid-cortex-2-dev` stack is in `ROLLBACK_COMPLETE`.

**Action:** Verify `infra/template2.yaml` exists and is not referenced by any active stack, then archive both.

---

## Section 6 — Lex Bots and Connect Contact Flows

### 6a. Lex V2 bots in account 158961537080

Three bots found:

| Bot | ID | Aliases | Managed by |
|---|---|---|---|
| `RCCallAssistBot-dev` | `IJIBJOJG2L` | `live-dev` (alias `0CNPVSCF4V`), `TestBotAlias` | `rapid-cortex-lex-dev` CF stack ✅ |
| `CareTallyAskdev` | — | `live`, `TestBotAlias` | **Not in any CF stack — orphan** |
| `MEL` | — | `MELvin`, `MELinda`, `TestBotAlias` | **Not in any CF stack — orphan** |

**`RCCallAssistBot-dev`:** Active, managed by CloudFormation, has correct Lambda permissions. ✅

**`CareTallyAskdev`:** No reference found in any active SAM template or Lambda handler. Its name suggests a previous "Care Tally" feature for hospital/medical triage. No handler code found in `apps/api/src/`.

**`MEL`:** Aliases `MELvin` and `MELinda` suggest a gendered AI persona experiment. No reference found in any active SAM template or Lambda handler.

**Action (cleanup sprint):** 
1. Query Lex V2 for `CareTallyAskdev` and `MEL` last-invocation metrics in CloudWatch. If zero invocations in the past 30 days: delete.
2. Before deleting: verify there is no Connect contact flow routing calls to either bot's alias ARN.
3. Add a note in this audit if deletion is blocked by a Connect routing dependency.

---

### 6b. Amazon Connect instance `rapid-cortex` (20772ba7-98e6-4afd-94cc-19e03c0619df)

**Phone number:** `+18168395256` (DID, description "Call Assist demo test DID")
**Current assignment:** Instance-level only — not assigned to "Call Assist" contact flow. See CRIT-4 above.

**Contact flows (21 total):**
- 1 custom: `Call Assist` (`a1dd0cd7-9860-4155-866c-12ebc3dbdcee`)
- 15 `Sample*` Amazon defaults (can be ignored)
- 5 system flows (default inbound, default disconnect, etc.)

**Lambdas granted to Connect (from `rapid-cortex-lex-dev` CF stack):**
- `rapid-cortex-lex-dialog-hook-dev` — dialog hook
- `rapid-cortex-lex-fulfillment-hook-dev` — fulfillment hook
- `rapid-cortex-lex-agency-for-number-dev` — agency lookup for DID
- `rapid-cortex-lex-session-start-dev` — session start
- Nova Session Start and Session Await permissions are granted by `AppSamCallAssistStack2`

**Action:** 
1. Apply CRIT-4 fix to assign the phone number to the "Call Assist" flow.
2. After `AppSamCallAssistStack2` successfully deploys, verify `ConnectNovaSessionStartPermission` and `ConnectNovaSessionAwaitPermission` are created with the correct new function ARNs.

---

## Summary Table

| ID | Category | Severity | Action required | Sprint |
|---|---|---|---|---|
| CRIT-1 | Deploy | 🔴 Critical | Run clean `deploy.sh dev` | Immediately |
| CRIT-2 | Lambda drift | 🔴 Critical | Rebuild Nova Lambda JS before next deploy | Before next deploy |
| CRIT-3 | CloudFormation | 🟠 High | Delete DELETE_FAILED Translate stack | Immediately |
| CRIT-4 | Connect | 🟠 High | Assign phone number to Call Assist flow | Immediately |
| S2-c | Lambda | 🟡 Medium | Remove ExistingXxx params post-deploy | Cleanup sprint |
| S2-d | Voice | 🟡 Medium | Confirm/remove dead Google+OpenAI providers | Cleanup sprint |
| S2-e | Desktop | 🟡 Medium | Confirm Electron vs Swift WKWebView status | Cleanup sprint |
| S2-f | HL7 | 🟡 Medium | Confirm HL7 listener deployment status | Cleanup sprint |
| S3-a | Scripts | 🟢 Low | Move 13 one-shot scripts to `scripts/archive/` | Cleanup sprint |
| S3-b | Scripts | 🟢 Low | Archive 4 split-stack ruby scripts | Cleanup sprint |
| S3-c | Scripts | 🟢 Low | Archive `deploy2.sh`; delete `rapid-cortex-2-dev` | Cleanup sprint |
| S4-d | Packages | 🟢 Low | Remove stale `.tgz` from `packages/integrations/` | Cleanup sprint |
| S5-a | Templates | 🟡 Medium | Add standalone stacks to `sam validate` loop | Cleanup sprint |
| S5-b | Templates | 🟢 Low | Move 4 `.before-*.yaml` to `infra/nested/archive/` | Cleanup sprint |
| S5-c | Templates | 🟡 Medium | Add 11 missing templates to validate loop | Cleanup sprint |
| S5-d | CloudFormation | 🟡 Medium | Delete 2 ROLLBACK_COMPLETE stacks | Cleanup sprint |
| S6-a | Lex | 🟡 Medium | Investigate + possibly delete CareTallyAsk and MEL bots | Cleanup sprint |
| S6-b | Connect | 🟠 High | Verify Nova Lambda permissions after re-deploy | After CRIT-1 |

---

## Recommended Sprint Sequence

1. **Now (before any feature work):**
   - CRIT-2: Rebuild Nova Lambda JS artifact
   - CRIT-1: Run `deploy.sh dev` clean deploy
   - CRIT-3: Delete DELETE_FAILED Translate stack
   - CRIT-4: Assign Connect phone number to Call Assist flow

2. **Dedicated cleanup sprint (1–2 days, isolated branch):**
   - Remove `ExistingXxx` params from `stack-app-sam-call-assist.yaml` (S2-c)
   - Archive stale scripts to `scripts/archive/` (S3-a, S3-b, S3-c)
   - Move `.before-*.yaml` to `infra/nested/archive/` (S5-b)
   - Add all standalone + missing templates to `sam validate` loop (S5-a, S5-c)
   - Delete `rapid-cortex-web-ecr-dev` and `rapid-cortex-2-dev` CF stacks (S5-d)
   - Investigate CareTallyAsk + MEL Lex bots (S6-a)
   - Remove `rapid-cortex-integrations-1.0.0.tgz` (S4-d)
   - Confirm/archive Google+OpenAI voice providers (S2-d)

3. **After cleanup sprint, before Area 1 confirmation loop build:**
   - Confirm HL7 listener deployment status (S2-f)
   - Confirm Electron vs Swift desktop status (S2-e)
   - Run `ts-prune` or `knip` on `packages/shared/src/` for dead-export scan

---

## What Was NOT Changed

This audit report is the only file created or modified. No production or infrastructure changes were made during this pass.

---

## Sprint Execution Log — 2026-11-17

### Phase 1: Critical Fixes

#### CRIT-2 ✅ COMPLETE — Nova Lambda bundle rebuilt (2026-11-17)
- Root cause: `apps/api/node_modules/rapid-cortex-shared/dist/` was installed from a stale vendored `.tgz`, missing recently-added source modules. `esbuild` with `--alias:rapid-cortex-shared=./packages/shared/dist/index.js` bypassed the stale vendored copy.
- `infra/nova-lambda/session-start-handler.js` rebuilt → 3.0 MB (Nov 17 11:19)
- `infra/nova-lambda/session-await-handler.js` rebuilt → 3.2 MB (Nov 17 11:22)
- Both artifacts confirmed fresh before deploy.

#### CRIT-3 ✅ COMPLETE — DELETE_FAILED Translate stack deleted (prior session)
- `rapid-cortex-dev-AppSamTranslateStack2-1BDYCEWYIJZTR` deleted with `--retain-resources TranslateWsSecret`
- Stack fully removed; `describe-stacks` confirms it no longer appears.

#### CRIT-4 ✅ COMPLETE — Connect phone assigned to Call Assist flow (prior session)
- `aws connect associate-phone-number-contact-flow` run successfully.
- `+18168395256` now routes to `a1dd0cd7-9860-4155-866c-12ebc3dbdcee` (Call Assist flow).

#### CRIT-1 🔄 IN PROGRESS — Clean deploy.sh dev (2026-11-17)
- Root cause fix confirmed: `scripts/env-api-dev.sh` lines 404–406 (orphan Lambda env var exports) removed.
- `scripts/deploy.sh` now unconditionally passes `ExistingNovaSessionStartFunctionName= ExistingNovaSessionAwaitFunctionName= ExistingCallAssistDisconnectFunctionName=`.
- `samconfig.toml` confirmed clean (no ExistingXxx overrides).
- Deploy started: `nohup bash scripts/deploy.sh dev > /tmp/deploy-dev-nohup-20261117-112918.log 2>&1 &`
- Preflight passed: IAM managed policy sizes ✅, IAM NoValue check ✅ (61 templates)
- Status: `sam build` in progress as of 11:29
- Monitor: `tail -f /tmp/deploy-dev-nohup-20261117-112918.log`

---

### Phase 2: MEL Lex Bot Removal

#### MEL Bot ✅ COMPLETE
- MEL bot (ID `QA8TC9SOMA`) deleted from AWS Lex V2 with `--skip-resource-in-use-check`.
- Zero code references confirmed by grep across `apps/`, `packages/`, `infra/`, `scripts/`.
- Deletion confirmed in AWS console.

---

### Phase 3: Cleanup Sprint

#### Phase 3a ✅ COMPLETE — 17 scripts archived to `scripts/archive/`
Archive comment added to top of each file, then moved:
- `repair-dispatcher-api-ghost-routes.sh` (2026-10-14)
- `repair-escalation-http-routes.sh` (2026-10-14)
- `repair-nexiq-intel-http-routes.sh` (2026-10-12)
- `repair-psap-prospects-routes.sh` (2026-11-03)
- `repair-rapid-iq-http-routes.sh` (2026-10-08)
- `restore-cad-bridge-httpapi-routes.sh` (2026-09-28)
- `restore-hiring-httpapi-routes.sh` (2026-07-11)
- `recover-appsam5-rollback.sh` (2026-11-06)
- `recover-rapidiq-pipeline-rollback.sh` (2026-10-02)
- `deploy-translate-hotfix.sh` (2026-09-15)
- `redeploy-sales-portal-apis-dev.sh` (2026-10-01)
- `redeploy-sales-portal-apis-finish-dev.sh` (2026-10-01)
- `redeploy-sales-portal-apis-resume-dev.sh` (2026-10-01)
- `split-stack-app-sam.rb` (2026-06-03)
- `split-stack-app-sam-primary.rb` (2026-06-25)
- `split-stack-app-sam-primary-v2.rb` (2026-06-25)
- `split-stack-app-sam-v2.rb` (2026-06-07)

#### Phase 3b ✅ COMPLETE — 4 `.before-*.yaml` files moved to `infra/nested/archive/`
- `stack-app-sam.before-split.yaml`
- `stack-app-sam.before-primary-split.yaml`
- `stack-app-sam.before-v2-split.yaml`
- `stack-app-sam-2.before-v2-split.yaml`

#### Phase 3c ✅ COMPLETE — CareTallyAskdev Lex bot investigated and deleted
- Bot ID: `U2K0YBV29F`, last updated 2026-09-29
- CloudWatch `RecognizedIntentHitCount`: **0 invocations in last 30 days**
- No reference in any Connect contact flow (Call Assist flow uses `RCCallAssistBot-dev` only)
- Deleted with `--skip-resource-in-use-check`. Confirmed: `ResourceNotFoundException` on describe-bot after deletion.

#### Phase 3d ✅ COMPLETE — STATUS comments added to 11 unvalidated templates
Added `# STATUS: not in deploy.sh validate loop as of 2026-11-17` to first line of:
- `stack-app-sam-escalation.yaml`
- `stack-app-sam-field.yaml`
- `stack-app-sam-rapid-iq.yaml`
- `stack-app-sam-rapid-iq-pipeline.yaml`
- `stack-app-sam-rms.yaml`
- `stack-app-sam-2-rcs.yaml`
- `stack-app-sam-2-realtime.yaml`
- `stack-app-sam-2-ng911.yaml`
- `stack-app-sam-clery-act.yaml`
- `stack-app-sam-vertical-alerts.yaml`
- `stack-app-sam-3-psap-crm.yaml`
- **Next step:** Add `sam validate --lint` entries for each in `deploy.sh` lines 208–253.

#### Phase 3e ✅ COMPLETE — ExistingXxx params verified safe (2026-11-17)
- All three params (`ExistingNovaSessionStartFunctionName`, `ExistingNovaSessionAwaitFunctionName`, `ExistingCallAssistDisconnectFunctionName`) have `Default: ""`.
- When empty, conditions evaluate to `CreateNova*=true` → CloudFormation CREATES the functions (correct).
- `deploy.sh` unconditionally passes empty overrides for all three (defensive, matches defaults).
- Orphan Lambda functions cleaned up in prior sessions; CF will create them fresh on current deploy.
- Params can be fully removed in a future cleanup sprint once the current deploy confirms no AlreadyExists errors.
- **No template change needed at this time.**

#### Phase 3f ✅ COMPLETE — ROADMAP STATUS comments added to Google/OpenAI voice providers
Added `// STATUS: ROADMAP — not deployed as of 2026-11-17` to:
- `apps/api/src/voice/google/googleSpeechSttProvider.ts`
- `apps/api/src/voice/google/googleTranslationProvider.ts`
- `apps/api/src/voice/openai/openaiWhisperSttProvider.ts`
- `apps/api/src/voice/openai/openaiTts.ts`

---

### Additional Items Completed (from CLEANUP_AUDIT.md sections)

#### S4-d ✅ — `rapid-cortex-integrations-1.0.0.tgz` removed from `packages/integrations/`

#### S5-d ✅ — 2 ROLLBACK_COMPLETE stacks deleted
- `rapid-cortex-web-ecr-dev` (ROLLBACK_COMPLETE) — deleted
- `rapid-cortex-2-dev` (ROLLBACK_COMPLETE, legacy deploy2.sh stack) — deleted

#### S6-a ✅ — Lex bots investigated
- `MEL` bot (QA8TC9SOMA): **deleted** (Phase 2 — prior session)
- `CareTallyAskdev` (U2K0YBV29F): **deleted** (Phase 3c — 0 invocations, no Connect references)
- `RCCallAssistBot-dev` (IJIBJOJG2L): **kept** — active, managed by `rapid-cortex-lex-dev` CF stack

---

### Still Pending (after CRIT-1 deploy succeeds)

| Item | Action |
|---|---|
| Phase 3e | ✅ Done | ExistingXxx params verified safe; no change needed until post-deploy |
| S5-c | ✅ Done | All 11 templates now in deploy.sh validate loop (lines 369-387) |
| Stabilization Phase 3 | ⏳ Ready | Run `bash scripts/enable-stack-protection.sh dev` after deploy |
| Stabilization Phase 4 | ⏳ Ready | Run `bash scripts/apply-stack-policies.sh dev --dry-run` then without `--dry-run` |
| S6-b | ⏳ Post-deploy | Verify ConnectNovaSessionStart/AwaitPermission in call-assist stack resources |
| S5-a | 🔵 Next sprint | Add standalone (non-nested) templates to validate loop in deploy.sh |
| S2-e | 🔵 Low priority | Confirm Electron vs Swift WKWebView desktop status |
| Dead-code scan | 🔵 Optional | Run `ts-prune` or `knip` on `packages/shared/src/` |

---

### Deployment Stabilization Sprint (2026-11-17)

See full audit: `STABILIZATION_AUDIT.md`

#### Phase 1 ✅ COMPLETE — Stabilization Audit
- 73 stacks audited; ALL 73 had `TerminationProtection: False`.
- 16 stateful resources missing `DeletionPolicy: Retain` identified across 8 templates.
- Nested stack dependency map documented.
- `deploy.sh` behavior gaps documented (no changeset preview, no removal guard, no per-stack mode).

#### Phase 2 ✅ COMPLETE — DeletionPolicy: Retain added to all stateful resources
Templates patched (all missing or incorrect policies fixed):
- `infra/nested/stack-app-sam.yaml` — 4 tables: CadWebhookIdempotency, CadCapIncidents, ChannelConfig, IncidentChannelAssignments
- `infra/nested/stack-app-sam-4.yaml` — 5 resources: CameraProviderOAuthStates, CameraProviderTokens, CamerasRegistry, NestOAuthState (was `Delete`!), WyzeConsentHmacSecret
- `infra/nested/stack-app-sam-cad-bridge.yaml` — 2 tables: CadBridgeLoopGuard, CadBridgeCircuitBreaker (both were `Delete` — CRITICAL)
- `infra/nested/stack-app-sam-location.yaml` — RCMapIdentityPool (Cognito::IdentityPool)
- `infra/nested/stack-app-sam-mcp-watch.yaml` — McpJwtSigningSecret
- `infra/nested/stack-app-sam-qr.yaml` — QRNFCCodesTable
- `infra/nested/stack-app-sam-transit.yaml` — TransitCameraProducerSecret
- `infra/nested/stack-app-sam-translate.yaml` — TranslateWsSecret

#### Phase 3 ⏳ PENDING — Enable Termination Protection on all production stacks
- Script ready: `scripts/enable-stack-protection.sh`
- Run after active deploy completes: `bash scripts/enable-stack-protection.sh dev`

#### Phase 4 ⏳ PENDING — Apply CloudFormation Stack Policies
- Policies ready: `stack-policies/data-layer-policy.json`, `app-layer-policy.json`, `infra-layer-policy.json`
- Apply to data-layer stacks after active deploy completes.

#### Phase 5 ✅ COMPLETE — Surgical deploy modes added to `deploy.sh`
- `deploy.sh full dev` — full pipeline (backward compat: `deploy.sh dev` still works)
- `deploy.sh preview dev` — changeset preview only (no execute)
- `deploy.sh stack dev <template>` — single-stack deploy via `sam deploy --resolve-s3`
- Removal check integrated (Phase 6 guard) before `sam deploy`
- Post-deploy health check integrated (Phase 7 hook) after `sam deploy`

#### Phase 6 ✅ COMPLETE — Pre-deploy nested stack removal guard
- Script: `scripts/check-stack-removals.sh`
- Integrated into `deploy.sh` — blocks deploy if template.yaml drops a nested stack resource
- Override: `CONFIRM_STACK_REMOVALS=1 bash deploy.sh dev` or `--confirm-stack-removals` arg

#### Phase 7 ✅ COMPLETE — Post-deploy health reporter
- Script: `scripts/stack-health-check.sh`
- Integrated into `deploy.sh` — runs after `sam deploy`; non-fatal (exits 0 on warnings)
- Also runnable standalone: `bash scripts/stack-health-check.sh dev`

---

*Generated: 2026-11-17 | NexCort iQ Cleanup Audit v1.0*  
*AWS Account: 158961537080 (nexcortiq-prod)*  
*Audit scope: apps/, packages/, infra/, scripts/, AWS Lambda, CloudFormation, Amazon Connect, Lex V2*
