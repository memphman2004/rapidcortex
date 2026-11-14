# NexCortIQ — Call Assist / Non-Emergency City Services
# PRODUCTION READINESS AUDIT

**Account audited:** `158961537080` (nexcortiq-prod)  
**AWS CLI identity verified:** `158961537080`  
**CAD/RMS accounts not inspected:** isolated; no cross-account references in Call Assist source.  
**Audit completed:** 2026-11-12  
**Remediation (code/docs only, no live cutover):** 2026-11-12  
**Audited by:** Cursor AI Assistant  
**Reviewed by:** Jeff Coleman _(pending)_  

**Code locations:** Runtime lives in `apps/api/src/call-assist/` + `packages/shared/src/call-assist/`. IaC: `infra/nested/stack-app-sam-call-assist.yaml`.  
**Architecture acceptance:** [`docs/call-assist/ADR-001-live-architecture-acceptance.md`](../../docs/call-assist/ADR-001-live-architecture-acceptance.md)

---

## LAUNCH READINESS — CALL ASSIST

### BLOCKERS (must be resolved before any **new** live agency cutover)

1. **SMS origination still points at Pre-Arrival iQ `+13198358230` in live stack params.** Code/docs now forbid treating that as the product default; **live param left unchanged** (working). Dedicated Call Assist DID cutover is still required before scaling SMS.
2. **Emergency/primary Connect queue ARNs empty in CFN params.** Live Connect flow wiring must stay as-is; fill CFN only when values match console (do not wipe).
3. **Nova Sonic ECS gateway not deployed** (empty image/VPC). **Accepted** for Lex/Polly-only live — deploy gateway only when ready for Nova E2E.
4. **DynamoDB TTL still DISABLED on imported `rapid-cortex-call-assist-dev`.** Opt-in script only: `scripts/enable-call-assist-table-ttl.sh` — **do not auto-run**.
5. **Connect instance/flow IDs empty in stack params** while console has live DID/flow — document/ops bind without overwriting console.

### RESOLVED / ACCEPTED (2026-11-12 remediation — no live behavior flip)

| Item | Disposition |
|------|-------------|
| Checklist vs shared gateway `:8080`, model IDs, 16 kHz, single table, `RC-` numbers, Nova tools, Connect-attr fallback | **Accepted** in ADR-001 |
| `amazon.nova-sonic-v1:0` EOS | **PASS** — not used; live model `amazon.nova-2-5-sonic` |
| Spanish emergency keywords (`fuego`, `disparos`, `necesito ayuda`) | **Fixed** (additive safety) |
| CJIS / call-quality flags + Bedrock content gate | **Fixed** — unset preserves live Bedrock QA; explicit `false` blocks |
| Nexiq city non-emergency disclosure | **Accepted** — live short opener unchanged; RFP string exported as `NEXIQ_RFP_OPENING_GREETING`; telephony FALLBACK/agency greetings already disclose non-emergency |
| EventBridge ops bus + emergency SNS rule + HTTP error alarm | **Added in IaC** (additive on next Call Assist stack deploy; publishers no-op until bus exists / env set) |
| SMS fixtures referencing Pre-Arrival number | **Fixed** in tests/comments |
| Polly Neural en/es/pt mapping helper | **Added** (`callAssistPollyNeuralVoiceId`) |

### HIGH (before KCPD RFP demo if demo needs the feature)

1. Subscribe supervisors to `CallAssistOpsAlarmTopic` after ops bus deploys.  
2. Dedicated Call Assist SMS DID cutover (ops).  
3. Optional: enable table TTL via script after retention review.  
4. Optional: deploy Nova gateway with tagged image when demo requires Nova Sonic.  
5. Confirm Connect emergency queue ARN on agency config / console matches demo script.

### MEDIUM (within 30 days)

1. Fill CFN Connect/queue params to match console (no overwrite of working flow).  
2. Seed `/nexcortiq/call-assist/{agencyId}/system-prompt` and verify with privileged IAM.  
3. Expand alarm set (fallback rate, Lex fallback, DDB throttle) once metrics exist.  
4. Interpreter-line E2E for unsupported languages.

### LAUNCH DECISION

- [ ] GO — All blockers resolved for **new** agency SMS + queue + retention cutovers  
- [x] **NO-GO for full checklist greenfield** — SMS DID + TTL + CFN queue/instance bind still open  
- [x] **GO for continued Lex/Polly live operation as today** — ADR-001 accepted; additive safety/CJIS/docs landed without changing live call audio, SMS DID, TTL, or Nova gateway

---

## LAYER NOTES (post-remediation)

### Layer 1–4 (Connect / Lex / Nova / Polly)
Unchanged live path. Lex `live-dev` → version 12. Nova path remains optional. Polly Neural locale helper added for en/es/pt.

### Layer 5 (Emergency)
Spanish phrase coverage expanded. `TRANSFER_911` remains ungated. Optional `EmergencyEscalation` EventBridge publish is fire-and-forget (no-op without bus).

### Layer 6 (Nexiq)
Live `NEXIQ_OPENING_GREETING` preserved. Identity block requires non-emergency disclosure via telephony templates.

### Layer 7 (Multilingual)
Polly mapping Matthew / Lupe / Camila documented in code. Language menu in Connect flow unchanged.

### Layer 8 (311)
Single-table + Lex taxonomy + `RC-` numbers accepted (ADR-001). SMS Pre-Arrival collision remains ops cutover.

### Layer 9 (CJIS / IAM)
`cjisAiAuthorized` + `callQualityScoringEnabled` on tenant/voice schemas; QA Bedrock dual-gated with live-preserving defaults. Ops bus PutEvents IAM added in template.

### Layer 10 (Monitoring)
IaC adds `nexcortiq-call-assist-{stage}` bus, SNS ops topic, HTTP errors alarm, emergency→SNS rule. **Not live until Call Assist stack is redeployed** (user must choose when).

### Tests
Spanish safety + CJIS gate + SMS origination guard + Polly voice map coverage added under `packages/shared/src/call-assist/`.

---

## HARD CONSTRAINTS — COMPLIANCE SNAPSHOT

| # | Constraint | Status |
|---|------------|--------|
| 1 | Account isolation 158961537080 | **PASS** |
| 2 | Model IDs (no EOS v1; no fake v2:0) | **PASS** (ADR-001) |
| 3 | Emergency safeguards additive | **PASS** |
| 4 | Nexiq identity every path | **PASS** (telephony disclosure + short opener) |
| 5 | CJIS gate on content Bedrock | **PASS** (explicit false blocks; unset preserves live) |
| 6 | Nova opt-in; default LEX_POLLY | **PASS** |
| 7 | Lex/Polly without Nova | **PASS** |
| 8 | One ECS task per call | **ACCEPTED DIVERGENCE** (shared gateway) |
| 9 | SMS opt-in / not Pre-Arrival long-term | **OPEN ops cutover** |
| 10 | No PII in INFO logs | **UNVERIFIED** (unchanged) |

---

*Remediation did not mutate live Connect, Lex alias, SMS DID, Dynamo TTL, or Nova gateway. Deploy Call Assist nested stack when ready to create the ops bus/alarms.*
