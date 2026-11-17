# NEXiQ City Services — Confirmation Loop Audit

**Account:** `158961537080` (nexcortiq-prod)
**Audit completed:** 2026-11-15
**Audited by:** Cursor AI (read-only inspection — no production code changed)
**Purpose:** Gate document required before any Phase 1 confirmation-lifecycle code is written.

---

## 1. Call Record Table

### 1.1 Storage location

| Item | Value |
|---|---|
| Env var | `CALL_ASSIST_TABLE` |
| Physical name pattern | `rapid-cortex-call-assist-{stage}` |
| In production | `rapid-cortex-call-assist-dev` (imported; `ExistingCallAssistTableName` param) |
| IaC | [`infra/nested/stack-app-sam-call-assist.yaml`](../infra/nested/stack-app-sam-call-assist.yaml) |
| Design | Single-table; PK `agencyId` + SK composite |
| Source of truth schema | [`packages/shared/src/call-assist/call-record.ts`](../packages/shared/src/call-assist/call-record.ts) |

### 1.2 Primary key pattern

```
PK: agencyId       (partition — all entity types in this tenant)
SK: CONFIRM#{CODE} (via callAssistConfirmSk helper, e.g. CONFIRM#KC-1001-7M4R)
```

Citation: `call-record.ts` lines 47-48, `store.ts` `getCallRecordByConfirmation` line 1070.

`GetItem` lookup: `{ agencyId, sk: 'CONFIRM#KC-1001-7M4R' }` — exact match required.

> **Important name discrepancy:** The prompt refers to this as `CONFIRM#{code}` PK and `callerPhone-index` GSI.
> The live table has `agencyId` as the **partition key**, `sk` as the sort key, and the caller GSI is **`gsi2`** (not `callerPhone-index`). All Phase 1 code must use the live names.

### 1.3 Global Secondary Indexes

| GSI name | PK attribute | SK attribute | Used for | Store method |
|---|---|---|---|---|
| `gsi1` | `gsi1pk = AGENCY#{agencyId}` | `gsi1sk = DATE#{YYYY-MM-DD}#CONFIRM#{code}` | Staff list by date | `listCallRecordsByAgencyDate` |
| `gsi2` | `gsi2pk = CALLER#{callerNumber}` | `gsi2sk = CREATED#{iso}` | ANI fallback | `listCallRecordsByCaller` |

Citation: `call-record.ts` lines 51-65, `store.ts` lines 1083-1110.

`gsi2pk` is populated from `record.callbackNumber || record.callerNumber` at write time (`store.ts` line 1046).

### 1.4 TTL

Field: `expiresAt` (number, epoch seconds). Helper: `callAssistSevenYearTtl()` (7-year retention per government records law). **TTL is currently DISABLED** on the imported `rapid-cortex-call-assist-dev` table per `PRODUCTION_AUDIT.md` blocker #4. Opt-in script: `scripts/enable-call-assist-table-ttl.sh`.

### 1.5 CallAssistCallRecord schema (all fields)

From `call-record.ts` Zod schema (`callAssistCallRecordSchema`):

| Field | Type | Notes |
|---|---|---|
| `confirmationNumber` | string (5-64) | Citizen-facing key |
| `agencyId` | string | Tenant partition |
| `callId` | string? | Connect contact ID |
| `sessionId` | string | Required; maps to voice session |
| `callerNumber` | string? | ANI |
| `callbackNumber` | string? | Caller-provided callback |
| `incidentType` | string? | Lex intent classification |
| `incidentLocation` | string? | Address/location text |
| `district` | string? | Geo district |
| `department` | string? | Routing destination |
| `status` | enum | See §1.6 |
| `aiTranscript` | string? | Full transcript |
| `emergencyFlag` | boolean | Default false |
| `routingLog` | array | Routing events (mutable array, appended) |
| `matchedRuleId` | string? | Which routing rule fired |
| `slaMinutes` | number? | Integer 1-1440 |
| `dangerScore` | number? | 0-1 ML score |
| `deliveryMethods` | string[]? | Channel tags |
| `createdAt` | string | ISO timestamp |
| `updatedAt` | string | ISO timestamp |
| `expiresAt` | number? | TTL epoch |

### 1.6 Status enum (live today)

```typescript
// packages/shared/src/call-assist/call-record.ts line 2
export const CALL_ASSIST_CALL_STATUSES = [
  "OPEN",
  "ROUTED",
  "ACKNOWLEDGED",
  "CLOSED",
  "ESCALATED",
  "DUPLICATE",
] as const;
```

**Missing from schema** (prompt requires these as new additions):
- `IN_PROGRESS` — not present
- `CANCELLED` — not present
- `AWAITING_INFORMATION` — not present
- `PENDING_REOPEN` — not present

**Decision for Phase 1:** Add all four as new literals to the Zod enum **additively**. All existing code handles the old values; new values are written only by lifecycle ops. No live behavior changes without agency flag enabled.

### 1.7 Missing fields (Phase 1 schema additions needed)

| Field | Type | Purpose |
|---|---|---|
| `statusHistory` | `StatusHistoryEntry[]?` | Immutable audit trail for all state changes |
| `addressLower` | `string?` | Normalized for duplicate GSI prefix matching |
| `notifyOptIn` | `boolean?` | SMS notification consent |
| `notifyPhone` | `string?` | Notification destination (may differ from ANI) |
| `notifyChannel` | `'sms'`? | Channel for lifecycle notifications |
| `externalWorkOrderId` | `string?` | Work-order system ID (never spoken) |
| `escalationCount` | `number?` | For 24h cap enforcement |
| `lastEscalatedAt` | `string?` | ISO timestamp of most recent escalation |

`StatusHistoryEntry` shape:
```typescript
{ at: string; status: string; note?: string; updatedBy: string }
```

`updatedBy` values per prompt spec: `NEXIQ_VOICE`, `RESIDENT_VOICE`, `NEXIQ_TRANSFER`, `NEXIQ_NOTIFY`, `STAFF_{userId}`, `SYSTEM`.

---

## 2. Source of Truth: Sessions vs Call Records

| Store | SK prefix | Purpose | Staff-readable? | Citizen-reachable? |
|---|---|---|---|---|
| `CallAssistCallRecord` | `CONFIRM#` | Citizen confirmation + status | ✓ via HTTP `/call-records/{confirmation}` | ✓ via Lex/Nova (after Phase 1) |
| `CallAssistSessionRecord` | `SESSION#` / `VOICE#` | Full voice session, transcript, CAD payload | ✓ via HTTP `/sessions` | ✗ (internal) |
| `call-assist-service-requests` table | — | **Does not exist in live infra** | — | — |

The `call-assist-service-requests` table appears only in `claude/nexcortiq-call-assist-nova-sonic-cursor-prompt.md` (a design prompt document) and is **not provisioned** in any SAM/CFN template. The live single-table pattern under `CALL_ASSIST_TABLE` is the source of truth for all confirmation lookups.

Staff lookup fallback: `http.ts` lines 1010-1015 — if `getCallRecordByConfirmation` returns null, it checks `findSessionByCaseNumber` and retries. Phase 1 voice/SMS paths should do the same.

---

## 3. Lex CheckServiceRequestStatus

### 3.1 Intent definition

File: [`apps/api/src/call-assist/lex/taxonomy-311/intents.ts`](../apps/api/src/call-assist/lex/taxonomy-311/intents.ts) lines 1115-1163.

```
name:               CheckServiceRequestStatus
category:           SERVICE_REQUEST_STATUS
primaryDepartment:  THREE11_OPERATIONS
priorityLevel:      INFO_ONLY
requiresDisambiguation: true
```

### 3.2 Slots

| Slot name | Type | Required | Elicitation prompt |
|---|---|---|---|
| `ServiceStatusSubIssue` | `CA_ServiceStatus_SubIssue` | true | "Are you checking the status of a request, trying to reopen a closed request, or looking to escalate an unresolved issue?" |
| `ServiceRequestNumber` | `AMAZON.AlphaNumeric` | false | "Do you have your service request number? It starts with SR followed by the date and a six-digit number." |
| `callerName` | `AMAZON.FirstName` | false | (common slot) |
| `callbackNumber` | `AMAZON.PhoneNumber` | false | (common slot) |

> **Note:** The elicitation prompt for `ServiceRequestNumber` says "starts with SR" but live confirmation numbers use the `RC-` prefix pattern (e.g. `RC-1001-7M4R` or agency-prefixed `KC-1001-7M4R`). This prompt text is misleading and should be corrected in Phase 1.

Slot type `CA_ServiceStatus_SubIssue` is registered in the taxonomy but its values are defined in `slot-types.ts` — to be confirmed during Phase 1 Lex console verification.

### 3.3 Current fulfillment behavior

**Gap (critical):** [`apps/api/src/call-assist/lex/fulfillment-hook.ts`](../apps/api/src/call-assist/lex/fulfillment-hook.ts) has **no branch** for `CheckServiceRequestStatus`. Line 48 reads the intent name but only routes to `InformationRequest` (line 217) or falls through to the generic finalize path.

The generic finalize path (lines 288-345) calls `finalizeCallAssistIntake`, which **creates a new `CallAssistCallRecord`** and issues a fresh confirmation number. A resident calling to check on `KC-1001-7M4R` today receives a **new confirmation code** for a duplicate case — `KC-1001-XXXX` — with no reference to the original.

**SMS closing text for this intent** (`sms-copy.ts` lines 60-62) confirms the same anti-pattern: `CheckServiceRequestStatus: (n) => 'We logged your status request. Confirmation ${n}...'` — it confirms a new record rather than returning existing status.

### 3.4 Staff console lookup (working)

`GET /api/call-assist/{agencyId}/call-records/{confirmation}` → `getCallRecordByConfirmation` (tenant-scoped) → returns full record. This is the only current path where the confirmation code is used to look up an existing record.

---

## 4. Nova Sonic Tools

### 4.1 Current tool list

Source: [`packages/shared/src/call-assist/nova-sonic.ts`](../packages/shared/src/call-assist/nova-sonic.ts) lines 124-130 + [`apps/api/src/call-assist/nova-sonic/tools.ts`](../apps/api/src/call-assist/nova-sonic/tools.ts).

```typescript
export const NOVA_SONIC_TOOL_NAMES = [
  "transfer_emergency",
  "issue_report_number",
  "save_intake_fields",
  "request_human",
] as const;
```

| Tool | Status | DynamoDB? |
|---|---|---|
| `transfer_emergency` | Live — routes to Connect emergency queue | No write |
| `issue_report_number` | Live — calls `formatCallAssistCaseNumber`, handoff attrs | No write (number generated in-memory; persisted later in session finalize) |
| `save_intake_fields` | Live — patches in-memory `NovaSonicIntakeState` | No write |
| `request_human` | Live — sets `novaSonicFallbackToLex` handoff | No write |
| `lookup_call_record` | **Missing** | — |
| `reopen_service_request` | **Missing** | — |
| `escalate_service_request` | **Missing** | — |
| `add_note_to_service_request` | **Missing** | — |

There are no stubs with DynamoDB comments — the lookup/lifecycle tools simply do not exist yet. The `NovaSonicToolName` union type must be extended when they are added.

### 4.2 Session init / ANI known-caller context

[`apps/api/src/call-assist/nova-sonic/session-init.ts`](../apps/api/src/call-assist/nova-sonic/session-init.ts) — exports `novaSonicSessionInitDecision()`. This function reads agency config (`novaSonicEnabled`, `systemPromptAppend`) and returns a voice-engine routing decision. It does **not** query `gsi2` for recent caller records. No known-caller greeting is built today.

[`apps/api/src/call-assist/nova-sonic/session-start-handler.ts`](../apps/api/src/call-assist/nova-sonic/session-start-handler.ts) calls `novaSonicSessionInitDecision` and builds the `PromptStart` event with the Nexiq identity block. The `systemPromptAppend` from tenant config is already forwarded here — Phase 1 will inject the known-caller addendum into this field without modifying the identity block.

---

## 5. SMS / Notifications

### 5.1 Intake confirmation SMS (working)

`finalizeCallAssistIntake` → `sendIncidentMediaLinkSms` / SMS factory → Pinpoint. Gated by `config.smsConfirmationEnabled` (default-on when unset per feature-flag policy). This path is **not changing** in Phase 1.

### 5.2 `threeOneOneStatusSmsEnabled` / status-transition SMS

**Does not exist in `CallAssistTenantConfig` today.** The prompt names this flag but it is absent from the live config type (store.ts lines 65-171). The closest field is `selfServiceSmsEnabled` (line 97), which serves a different purpose.

Phase 1 must **add** `threeOneOneStatusSmsEnabled?: boolean` to `CallAssistTenantConfig` and implement status-transition SMS. The existing `sendSmsSegments` helper in `sms-sender.ts` is the right transport.

### 5.3 SMS channel status lookup

`sms-channel/handler.ts` lines 221, 501 — queries `listCallRecordsByCaller` on the SMS handler to find a continued record. This is the ANI-equivalent for SMS. Currently uses the record only to continue session context, not to respond with case status. Phase 1 extends this to handle `CheckServiceRequestStatus` intent over SMS, returning spoken status as SMS text.

### 5.4 formatConfirmationForSpeech (live)

[`packages/shared/src/call-assist/case-number.ts`](../packages/shared/src/call-assist/case-number.ts) lines 137-146 — produces `K, C. 1, 0, 0, 1. 7, M, 4, R` with period-separated groups and comma-separated characters. SSML variant also available. **This function already exists and must be reused in all Phase 1 voice responses.**

---

## 6. Store Concurrency: `updateCallRecordStatus`

[`apps/api/src/call-assist/store.ts`](../apps/api/src/call-assist/store.ts) lines 1115-1134 — current implementation is a **read-modify-write** without DynamoDB condition expressions:

```typescript
const existing = await this.getCallRecordByConfirmation(agencyId, confirmationNumber);
// ...merge...
await this.putCallRecord(updated); // unconditional PutItem
```

This is safe for today's single-write staff path but **not safe for concurrent lifecycle operations** (reopen + staff update racing). Phase 1 must add a conditional `PutItem` using `ConditionExpression: "updatedAt = :prev"` to prevent lost-write races.

---

## 7. Gap Table

| Capability | Exists Today | Gap / Phase |
|---|---|---|
| Confirmation stored on first call | ✓ `call-record.ts` + `finalize-intake.ts` | — |
| Staff lookup by confirmation (console) | ✓ `http.ts` GET `/call-records/{confirmation}` | — |
| ANI-based lookup (staff/session) | ✓ `store.ts` `listCallRecordsByCaller` via `gsi2` | — |
| Lex collects confirmation slot on return call | ✓ `intents.ts` `ServiceRequestNumber` slot | — |
| Lex speaks live status back to caller | ✗ | Phase 1.2 — fulfillment branch |
| Reopen from voice | ✗ | Phase 1.2 — sub-intent router |
| Escalate from voice | ✗ | Phase 1.2 — sub-intent router |
| Fix address from voice | ✗ | Phase 1.2 — sub-intent router |
| Nova Sonic status lookup tool | ✗ (missing, not stub) | Phase 1.3 |
| Nova Sonic reopen/escalate/note tools | ✗ (missing) | Phase 1.3 |
| ANI-based known-caller greeting (Nova) | ✗ | Phase 1.3 |
| Duplicate SR prevention on return call | ✗ fulfillment creates new SR | Phase 1.2 — branch before finalize |
| Proactive SMS on status change | ✗ flag not in config | Phase 1.4 |
| `threeOneOneStatusSmsEnabled` flag | ✗ not in `CallAssistTenantConfig` | Phase 1.4 |
| SMS-based status lookup (return SMS) | partial — thread continues but no status text | Phase 1.2 |
| `statusHistory` audit trail | ✗ only `routingLog` exists | Phase 1.1 schema |
| Concurrency-safe status update | ✗ read-modify-write, no condition | Phase 1.1 store |
| Department SLA spoken on status | ✗ `slaMinutes` field present, not used in voice | Phase 1.2 |
| Escalation 24h cap | ✗ | Phase 1.2 |
| `addressLower` for duplicate detection | ✗ | Phase 1.1 / Phase 3.4 |
| Open311 / Cityworks / SeeClickFix adapters | ✗ | Phase 3.3 |
| `IN_PROGRESS`, `CANCELLED`, `AWAITING_INFORMATION`, `PENDING_REOPEN` statuses | ✗ | Phase 1.1 schema |
| Case event history viewable by staff | partial — `routingLog` only | Phase 1.1 |
| Human follow-up flag for supervisor queue | ✗ | Phase 1.2 |
| Notify opt-in subscription | ✗ | Phase 1.4 |
| `externalWorkOrderId` storage | ✗ | Phase 3.3 |

---

## 8. Proposed Schema Extensions for Phase 1

These are **additive only**. All new fields are optional. No existing fields renamed or removed.

### 8.1 Extended status enum (additive literals)

```typescript
// packages/shared/src/call-assist/call-record.ts — EXTEND, do not replace
export const CALL_ASSIST_CALL_STATUSES = [
  // --- existing (never remove) ---
  "OPEN",
  "ROUTED",
  "ACKNOWLEDGED",
  "CLOSED",
  "ESCALATED",
  "DUPLICATE",
  // --- Phase 1 additions ---
  "IN_PROGRESS",
  "CANCELLED",
  "AWAITING_INFORMATION",
  "PENDING_REOPEN",
] as const;
```

### 8.2 StatusHistoryEntry type (new)

```typescript
export const statusHistoryEntrySchema = z.object({
  at: z.string(),           // ISO timestamp
  status: z.string(),       // new status value
  note: z.string().max(500).optional(),
  updatedBy: z.string().max(128), // see §8.3
});
```

### 8.3 updatedBy values

| Trigger | Value |
|---|---|
| New report created by voice | `NEXIQ_VOICE` |
| Citizen called back | `RESIDENT_VOICE` |
| Citizen added note | `RESIDENT_VOICE` |
| Citizen requested reopen | `RESIDENT_VOICE` |
| Citizen requested escalation | `RESIDENT_VOICE` |
| Human transfer to operator | `NEXIQ_TRANSFER` |
| Notification sent | `NEXIQ_NOTIFY` |
| Staff status change | `STAFF_{userId}` |
| System automation | `SYSTEM` |

### 8.4 New optional fields on CallAssistCallRecord

```typescript
// Add to callAssistCallRecordSchema:
statusHistory: z.array(statusHistoryEntrySchema).optional(),
addressLower: z.string().max(500).optional(),       // normalized for duplicate detection
notifyOptIn: z.boolean().optional(),
notifyPhone: z.string().max(32).optional(),
notifyChannel: z.enum(["sms"]).optional(),
externalWorkOrderId: z.string().max(256).optional(), // never spoken to caller
escalationCount: z.number().int().optional(),
lastEscalatedAt: z.string().optional(),
```

### 8.5 Concurrency fix for updateCallRecordStatus

Replace unconditional `PutItem` with `PutItem` + `ConditionExpression`:

```typescript
ConditionExpression: "attribute_not_exists(sk) OR updatedAt = :prev",
ExpressionAttributeValues: { ":prev": existing.updatedAt, ...otherVals },
```

Callers catch `ConditionalCheckFailedException` and retry up to 3 times.

### 8.6 New flag on CallAssistTenantConfig

```typescript
// Add to CallAssistTenantConfig:
threeOneOneStatusSmsEnabled?: boolean; // phase 1.4 — gate for lifecycle SMS
confirmationLoopEnabled?: boolean;     // phase 1 feature flag; unset = off
```

---

## 9. Feature Flag Strategy

All new confirmation-loop citizen interactions are gated by `config.confirmationLoopEnabled`. When unset or `false`, the fulfillment-hook falls through to the existing finalize path (today's behavior). When `true`, the Phase 1 branch activates for `CheckServiceRequestStatus`.

This satisfies the plan requirement: "unset/off = today's behavior."

---

## 10. Audit Verdict

**Phase 1 is cleared to proceed.** All prerequisite facts are confirmed:

- Table name, keys, GSI names verified against live schema
- No separate `call-assist-service-requests` table exists in production
- `CheckServiceRequestStatus` intent confirmed in taxonomy; fulfillment gap confirmed
- Nova Sonic tools confirmed missing (not stubbed)
- `formatConfirmationForSpeech` confirmed present and reusable
- `updateCallRecordStatus` confirmed without condition expression
- `threeOneOneStatusSmsEnabled` confirmed absent from live config
- Schema extension approach (additive) confirmed safe

**Files to modify in Phase 1 (no other files unless tests require them):**
1. [`packages/shared/src/call-assist/call-record.ts`](../packages/shared/src/call-assist/call-record.ts) — extend schema
2. `packages/shared/src/call-assist/case-lifecycle.ts` — **new file**
3. [`apps/api/src/call-assist/store.ts`](../apps/api/src/call-assist/store.ts) — concurrency fix + lifecycle ops
4. [`apps/api/src/call-assist/lex/fulfillment-hook.ts`](../apps/api/src/call-assist/lex/fulfillment-hook.ts) — early branch
5. [`apps/api/src/call-assist/sms-channel/sms-copy.ts`](../apps/api/src/call-assist/sms-channel/sms-copy.ts) — fix misleading CheckServiceRequestStatus copy
6. [`packages/shared/src/call-assist/nova-sonic.ts`](../packages/shared/src/call-assist/nova-sonic.ts) — extend tool names
7. [`apps/api/src/call-assist/nova-sonic/tools.ts`](../apps/api/src/call-assist/nova-sonic/tools.ts) — add lifecycle tool handlers
8. [`apps/api/src/call-assist/nova-sonic/session-init.ts`](../apps/api/src/call-assist/nova-sonic/session-init.ts) — known-caller addendum
9. [`apps/api/src/handlers/call-assist/http.ts`](../apps/api/src/handlers/call-assist/http.ts) — status-transition SMS hook
10. `apps/api/src/call-assist/case-lifecycle/` — **new directory** for reusable lifecycle service functions
11. Test files for all new paths

*NEXiQ City Services — Confirmation Loop Audit v1.0 — 2026-11-15*
