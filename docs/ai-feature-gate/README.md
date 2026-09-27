# AI Feature Gate (ENABLE_AI_FEATURE_GATE)

**Branch:** `feature/ai-feature-gate`  
**Flag:** `ENABLE_AI_FEATURE_GATE` / `NEXT_PUBLIC_ENABLE_AI_FEATURE_GATE` (default **on** when unset)

## What shipped

| Layer | Location |
|---|---|
| Shared types | `packages/shared/src/ai-gate/` |
| RBAC | `packages/security/src/ai-gate-authz.ts` |
| Audit types | `AI_GATE_*` in `packages/security/src/audit-schema.ts` |
| DynamoDB | `AgencyAiGateTable` in `infra/nested/stack-app-sam-features.yaml` |
| Repository | `apps/api/src/repositories/aiGateRepository.ts` |
| HTTP | `GET/PUT /api/agency/{agencyId}/config/ai-mode`, audit GET |
| Lambda | `AiGateHttpFunction` (Features stack / AppSam2 HttpApi) |
| Metrics | `apps/api/src/lib/ai-gate-metrics.ts` |
| WS broadcast | `apps/api/src/lib/ws-broadcast.ts` → `AI_MODE_CHANGE` |
| React | `apps/web/lib/ai-gate/` + dispatch layout provider |
| Admin UI | `/{jurisdiction}/admin/settings/ai-mode` |
| Lambda gate helper | `assertAIGateFeature()` — Call Assist + Translate wired |
| Smoke | `npx tsx scripts/smoke-ai-gate.ts` |

## Invariants

1. TRANSFER_911 / RCS safety paths are **not** gated.
2. Lambda check is authoritative; UI is UX only.
3. `TransactWrite` for config + audit on every toggle.
4. Dispatchers cannot toggle (`canToggleAIGate` false).
5. Master `enabled=false` forces all features off.
6. Missing config → default all-on.
7. Broadcast / metrics failures are non-fatal (`allSettled`).

## Deploy notes

1. Deploy Features nested stack (creates `AgencyAiGateTable` + `AiGateHttpFunction`).
2. Ensure web BFF routes `/api/agency/*/config/ai-mode` to AppSam2 (`comms-api-path.ts`).
3. Optional smoke after deploy with supervisor JWT.

## Site marking status

Wired examples: `IncidentCameraPanel` (`cameraAnalysis`), `VenueReportsPanel` (`summaries`), Call Assist session/utterance (`callHandling`), Translate session create + summary (`translation` / `summaries`), Vision transcript start (`transcription`), `analyzeIncident` (`incidentSuggestions`), Vision AI Writer + scene classify/describe (`cameraAnalysis`), SOP pattern analyzer (`patternDetection`).

Remaining: Bedrock priority/scoring paths, notifications UI, operations dashboard widgets — call `useAIFeature` / `assertAIGateFeature` the same way; do not rely on UI alone.

Surgical Features deploy (dev): `bash scripts/deploy-features-dev.sh` (creates `AgencyAiGateTable` + AiGate routes on AppSam2 HttpApi).
