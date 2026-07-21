# Rapid Cortex — Response Continuity System (RCS)
## Claude Code Implementation Prompt

> **Purpose:** Implement the Response Continuity System end-to-end.
> Feed this file directly to Claude Code: `claude < RCS_CLAUDE_CODE_PROMPT.md`
> or use as the task description in an agentic session.

---

## MISSION CONTEXT

Build the **Response Continuity System (RCS)** — a life-safety feature that ensures no
911 call can be closed until first responder arrival is GPS-confirmed or a supervisor
explicitly overrides with a documented reason.

This feature was designed in response to a real incident where a 20-year-old caller
died waiting 43 minutes for an ambulance while no system flagged the response gap.

RCS has six hard operational pillars:

1. **Call Persistence Lock** — calls cannot close without unit arrival confirmation
2. **Silent Monitor Queue** — call audio stays live when dispatcher handles other calls
3. **Unit Geofence Tracking** — CAD AVL GPS used to auto-confirm unit on scene
4. **Audio Sentinel** — detects caller going unresponsive via audio analysis
5. **Escalation Engine** — time-based alerts to supervisor and command at thresholds
6. **Closure Gate** — hard system block with supervisor override + audit log

---

## CODEBASE ORIENTATION

### Project Structure
```
repo-root/
├── apps/
│   ├── api/                          # All Lambda functions live here
│   │   └── src/
│   │       ├── handlers/             # HTTP Lambda handlers (one file per route)
│   │       ├── repositories/         # DynamoDB access layer
│   │       │   └── baseRepository.ts # Exports: ddb (DynamoDBDocumentClient)
│   │       ├── lib/
│   │       │   └── env.ts            # Typed env vars — ADD new vars here
│   │       └── features/rcs/         # CREATE THIS DIRECTORY for all RCS logic
│   └── web/                          # Next.js frontend
│       └── src/
│           ├── app/                  # Next.js App Router pages
│           ├── components/           # Shared UI components
│           ├── hooks/                # Custom React hooks
│           │   └── use-agency-websocket.ts  # Real-time WebSocket hook — USE THIS
│           └── lib/                  # API client helpers
├── packages/
│   └── rapid-cortex-shared/          # Shared types — ADD RCS types here
│       └── src/index.ts
└── template.yaml                     # SAM root template — ADD resources here
```

---

### VERIFIED PATTERNS — PULLED DIRECTLY FROM SOURCE

The following patterns were extracted from the actual codebase files. Match them exactly.

#### Lambda Handler Structure
> Source: `apps/api/src/features/ring/available-cameras.ts`

```typescript
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getUserContext, ACCOUNT_INACTIVE_MESSAGE, isUserAccountActive } from "../../lib/auth.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { env } from "../../lib/env.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    // 1. Extract and validate user — getUserContext reads the JWT/cookie from event
    const user = await getUserContext(event);
    if (!user) return rcsJson({ success: false, error: "Unauthorized" }, 401);
    if (!isUserAccountActive(user))
      return rcsJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);

    // 2. Check operational password gate (required on all protected handlers)
    const pwd = operationalPasswordBlock(user);
    if (pwd)
      return rcsJson({ success: false, error: "Password update is required before continuing." }, 403);

    // 3. RBAC check
    if (!canManageRcsCall(user.role))
      return rcsJson({ success: false, error: "Forbidden" }, 403);

    // 4. Parse and validate input
    const body = JSON.parse(event.body ?? "{}") as RcsStartCallRequest;

    // 5. Business logic
    // ...

    // 6. Return success
    return rcsJson({ success: true, data: result }, 201);

  } catch (err) {
    // Structured JSON error logging — matches the exact pattern in the codebase
    console.error(
      JSON.stringify({
        msg: "rcs_call_start_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return rcsJson({ success: false, error: "Unable to start RCS call monitoring." }, 500);
  }
};
```

#### Lambda Response Helper
> Source: `apps/api/src/features/ring/ring-api-response.ts`
> Create the RCS equivalent at: `apps/api/src/features/rcs/rcs-api-response.ts`

```typescript
import type { APIGatewayProxyResultV2 } from "aws-lambda";

// Mirror the exact shape of ringJson — used across all RCS Lambda handlers
export function rcsJson<T>(
  body: { success: boolean; data?: T; error?: string },
  statusCode = 200,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
```

Response body shape is always `{ success: boolean, data?: T, error?: string }`.
Never return raw objects — always wrap in this shape.

#### DynamoDB Access
> Source: `apps/api/src/features/ring/ring-consent-rate-limit.ts`

```typescript
// Always import ddb from baseRepository — never instantiate DynamoDBClient directly
import { ddb } from "../../repositories/baseRepository.js";
import { PutCommand, GetCommand, UpdateCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../lib/env.js";

// Always read table names from env — never hardcode table names
function rcsCallsTable(): string {
  const t = env.rcsCallsTable?.trim();
  if (!t) throw new Error("RCS_CALLS_TABLE not configured");
  return t;
}
```

#### Environment Variables
> Source: `apps/api/src/lib/env.ts` — add these fields to the existing typed env object

```typescript
// ADD to the existing env.ts module (do not replace the file):
rcsCallsTable?: string;        // process.env.RCS_CALLS_TABLE
rcsUnitsTable?: string;        // process.env.RCS_UNITS_TABLE
rcsEscalationTable?: string;   // process.env.RCS_ESCALATION_TABLE
rcsEscalationFunctionArn?: string;  // process.env.RCS_ESCALATION_FUNCTION_ARN
rcsSchedulerRoleArn?: string;       // process.env.RCS_SCHEDULER_ROLE_ARN
rcsEscalationSnsTopicArn?: string;  // process.env.RCS_ESCALATION_SNS_TOPIC_ARN
rcsArrivalRadiusMeters?: string;    // process.env.RCS_ARRIVAL_RADIUS_M (parse to number at use site)
```

#### Auth and Roles
> Source: `apps/api/src/features/ring/ring-auth.ts` and `packages/rapid-cortex-shared/src/index.ts`

```typescript
import type { UserContext } from "rapid-cortex-shared";
import { isSupervisorOrAdmin } from "rapid-cortex-shared";

// UserContext shape (from rapid-cortex-shared):
// { userId: string; agencyId: string; role: string; email?: string; ... }

// Role check helpers — use shared utilities, not inline string comparisons:
isSupervisorOrAdmin(user.role)  // supervisor | admin | platform_superadmin
// For RCS-specific authz, create: apps/api/src/features/rcs/rcs-authz.ts
```

#### Tenant Isolation
Every DynamoDB key MUST include agencyId. Pattern from `ring-incident.ts`:

```typescript
// PK encodes agencyId — cross-tenant reads are structurally impossible
Key: { pk: `AGENCY#${agencyId}#CALL#${callId}`, sk: "STATE" }

// On reads: always verify the returned item's agencyId matches the requesting user's
if (item.agencyId !== user.agencyId) return rcsJson({ success: false, error: "Forbidden" }, 403);
```

#### Frontend API Client — Same-Origin BFF Pattern
> Source: `apps/web/src/components/venue/venue-ops-modals.tsx`

```typescript
// CRITICAL: All API calls use RELATIVE URLs — /api/... not https://api.rapidcortex.us
// Auth is COOKIE-BASED — do NOT manually attach Authorization headers from client components
// The Next.js app is the BFF (Backend For Frontend); cookies are sent automatically

// ✅ Correct pattern (from venue-ops-modals.tsx):
const res = await fetch("/api/rcs/calls", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
if (!res.ok) throw new Error(`RCS call start failed (${res.status})`);
const data = (await res.json()) as { success: boolean; data: { callId: string; call: RcsCall } };

// ❌ Wrong — do not do this in client components:
// Authorization: `Bearer ${token}`           // tokens stay server-side
// https://api.rapidcortex.us/api/rcs/...    // no absolute URLs in client fetch
```

Helper function shape — match the existing `@/lib/venue/venue-dashboard-api` pattern:
```typescript
// apps/web/src/lib/rcs/rcs-api.ts
export async function rcsStartCall(body: RcsStartCallRequest): Promise<{ callId: string; call: RcsCall }> {
  const res = await fetch("/api/rcs/calls", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rcsStartCall failed (${res.status})`);
  const json = (await res.json()) as { success: boolean; data: { callId: string; call: RcsCall } };
  if (!json.success) throw new Error(json.error ?? "Unknown error");
  return json.data;
}
// Repeat this pattern for every function in rcs-api.ts
```

#### Server Component Auth (Page-Level)
> Source: `apps/web/src/components/venue/venue-operations-dashboard-page.tsx`

```typescript
// In page.tsx server components — auth gate before rendering:
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { redirect } from "next/navigation";

const user = await getDashboardSessionUser();
if (!user) redirect(`/login?from=/${agencySlug}/rcs`);

// Pass agencyId + role down to client components — never expose session to client
<RcsMonitorPanel agencyId={user.agencyId} userRole={user.role} userId={user.userId} />
```

#### React Frontend Component Conventions
> Source: `apps/web/src/components/venue/venue-operations-dashboard.tsx`

```typescript
"use client";  // required at top of every client component

// Color tokens: always a const object at the top of the file
const C = {
  bg:      "#060c1a",
  surface: "#0c1428",
  // ...
};

// Icons: lucide-react only (already installed)
import { AlertCircle, Shield, Clock } from "lucide-react";

// Real-time updates: useAgencyWebSocket — already wired to the agency WebSocket connection
import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";
useAgencyWebSocket((msg) => {
  if (msg.type === "rcs:call:escalated") { /* handle */ }
});

// Styles: inline only — no Tailwind classes, no CSS modules
<div style={{ background: C.bg, padding: 14 }}>

// Button clicks: void the async handler
<button onClick={() => void handleClose(callId)}>Close Call</button>

// No <form> elements — use onClick handlers
```

#### Structured Error Logging Convention
> Source: All Lambda handlers in the codebase

```typescript
// Every catch block logs structured JSON to CloudWatch:
console.error(
  JSON.stringify({
    msg: "rcs_[feature]_error",   // e.g. rcs_call_close_error
    callId,                        // include context IDs
    agencyId: user?.agencyId,
    error: err instanceof Error ? err.message : String(err),
  }),
);
```

#### Audit Logging
> Source: `packages/rapid-cortex-shared/src/index.ts` exports `AuditLogger`

```typescript
import { AuditLogger } from "rapid-cortex-shared";

// Every state change, close, and override MUST write an audit entry.
// The AuditLogger writes to the existing audit DynamoDB table.
await AuditLogger.log({
  type: "rcs.call.override_closed",
  agencyId: user.agencyId,
  actorId: user.userId,
  resourceId: callId,
  details: {
    supervisorBadge: override.supervisorBadge,
    reason: override.reason,
    callStateAtClose: call.callState,
    elapsedMs: Date.now() - new Date(call.callStart).getTime(),
  },
});
```

---

## PHASE 1: DATA MODELS

### 1.1 Shared Types
**File:** `packages/rapid-cortex-shared/src/rcs-types.ts`
Export all of these from the package's `src/index.ts`.

```typescript
export type RcsCallState =
  | "ACTIVE"           // Dispatcher engaged, call live
  | "SILENT_MONITOR"   // Call backgrounded, audio still live
  | "UNIT_DISPATCHED"  // Unit assigned in CAD
  | "UNIT_EN_ROUTE"    // Unit moving toward scene
  | "UNIT_ARRIVED"     // GPS geofence confirmed on scene
  | "CLOSED";          // Documentation complete

export type RcsEscalationLevel = 0 | 1 | 2 | 3 | 4;
// 0 = NOMINAL (<10min), 1 = WATCH (<20min), 2 = WARNING (<30min),
// 3 = CRITICAL (<40min), 4 = EMERGENCY (40min+)

export type RcsAudioStatus =
  | "ACTIVE"        // Caller responsive
  | "AMBIENT"       // Phone down, ambient audio
  | "UNRESPONSIVE"  // No caller response detected
  | "SILENT";       // No audio signal

export type RcsUnitType = "EMS" | "LE" | "FIRE" | "OTHER";
export type RcsUnitStatus = "DISPATCHED" | "EN_ROUTE" | "ON_SCENE" | "CLEARED";

export interface RcsUnit {
  unitId: string;
  callSign: string;
  type: RcsUnitType;
  status: RcsUnitStatus;
  lat?: number;
  lng?: number;
  distanceMi?: number;
  etaMin?: number;
  arrivedAt?: string; // ISO timestamp
}

export interface RcsAudioAlert {
  alertId: string;
  timestamp: string;  // ISO
  severity: "info" | "warn" | "critical";
  message: string;
  audioStatus: RcsAudioStatus;
}

export interface RcsEscalationEvent {
  level: RcsEscalationLevel;
  triggeredAt: string;      // ISO
  reason: string;
  notifiedUserIds: string[];
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface RcsClosureOverride {
  supervisorId: string;
  supervisorBadge: string;
  reason: string;
  timestamp: string; // ISO
}

export interface RcsCall {
  callId: string;
  cadIncidentId?: string;
  agencyId: string;
  callerInfo?: string;
  callerPhone?: string;
  callerAddress: string;
  callerLat?: number;
  callerLng?: number;
  incidentType: string;
  priority: "P1" | "P2" | "P3";
  callState: RcsCallState;
  dispatcherId: string;
  audioSessionId?: string;
  audioStatus: RcsAudioStatus;
  assignedUnits: RcsUnit[];
  audioAlerts: RcsAudioAlert[];
  escalationEvents: RcsEscalationEvent[];
  currentEscalationLevel: RcsEscalationLevel;
  supervisorAcknowledged: boolean;
  supervisorAcknowledgedBy?: string;
  closureOverride?: RcsClosureOverride;
  // Timestamps
  callStart: string;         // ISO — when call was created in RCS
  silentMonitorStart?: string;
  dispatchTime?: string;
  enRouteTime?: string;
  arrivedTime?: string;
  closedAt?: string;
  // DynamoDB TTL — set to 7 days after closedAt
  ttl?: number;
}

export interface RcsUnitPosition {
  unitId: string;
  callSign: string;
  type: RcsUnitType;
  agencyId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  cadStatus?: string;
  timestamp: string; // ISO
}

// API Request/Response types
export interface RcsStartCallRequest {
  cadIncidentId?: string;
  callerInfo?: string;
  callerPhone?: string;
  callerAddress: string;
  callerLat?: number;
  callerLng?: number;
  incidentType: string;
  priority: "P1" | "P2" | "P3";
  audioSessionId?: string;
}

export interface RcsUpdateCallStateRequest {
  callState: RcsCallState;
  unit?: RcsUnit;      // Provide when adding a unit
  timestamp?: string;  // ISO — defaults to now
}

export interface RcsCloseCallRequest {
  // For normal closure (unit arrived): no extra fields required
  // For supervisor override:
  override?: {
    supervisorBadge: string;
    reason: string;
  };
}

export interface RcsAudioAlertRequest {
  severity: "info" | "warn" | "critical";
  message: string;
  audioStatus: RcsAudioStatus;
}

export interface RcsUnitPositionRequest {
  unitId: string;
  callSign: string;
  type: RcsUnitType;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  cadStatus?: string;
  /** If provided, run geofence check against this call */
  activeCallId?: string;
}
```

### 1.2 DynamoDB Tables

**Table 1: RcsCallsTable**
```
TableName: ${DDBTablePrefix}-rcs-calls
BillingMode: PAY_PER_REQUEST
PITR: true (production)

Partition key: pk  (String)  →  "AGENCY#<agencyId>#CALL#<callId>"
Sort key:      sk  (String)  →  "STATE"

Attributes:
  callId, agencyId, cadIncidentId, callerInfo, callerPhone,
  callerAddress, callerLat, callerLng, incidentType, priority,
  callState, dispatcherId, audioSessionId, audioStatus,
  assignedUnits (List), audioAlerts (List), escalationEvents (List),
  currentEscalationLevel, supervisorAcknowledged, closureOverride (Map),
  callStart, silentMonitorStart, dispatchTime, enRouteTime,
  arrivedTime, closedAt, ttl

GSI-1: AgencyActiveCalls
  PK:  agencyId
  SK:  callStart
  Include: ALL
  (Used for: GET /rcs/calls?agencyId=x — list all monitored calls for agency)

GSI-2: StateIndex
  PK:  callState
  SK:  callStart
  Include: ALL
  (Used for: escalation engine to find all SILENT_MONITOR + UNIT_EN_ROUTE calls)
```

**Table 2: RcsUnitsTable**
```
TableName: ${DDBTablePrefix}-rcs-units
BillingMode: PAY_PER_REQUEST

Partition key: pk  →  "AGENCY#<agencyId>#UNIT#<unitId>"
Sort key:      sk  →  "LATEST"

Attributes: unitId, callSign, type, agencyId, lat, lng,
            speed, heading, cadStatus, timestamp, ttl (2 hours)
```

**Table 3: RcsEscalationTable**
```
TableName: ${DDBTablePrefix}-rcs-escalations
BillingMode: PAY_PER_REQUEST

Partition key: pk  →  "CALL#<callId>"
Sort key:      sk  →  "ESC#<ISO-timestamp>"

Attributes: callId, agencyId, level, reason, triggeredAt,
            notifiedUserIds, acknowledgedBy, acknowledgedAt, ttl (30 days)
```

---

## PHASE 2: BACKEND LAMBDA FUNCTIONS

Create all files under: `apps/api/src/features/rcs/`

### 2.1 Core Repository
**File:** `apps/api/src/features/rcs/rcs-repository.ts`

Implement a `RcsRepository` class with these methods:

```typescript
class RcsRepository {
  // Create a new monitored call record
  async createCall(call: RcsCall): Promise<void>

  // Get a single call — MUST verify agencyId matches to prevent cross-tenant reads
  async getCall(callId: string, agencyId: string): Promise<RcsCall | null>

  // List all non-closed calls for an agency (query GSI-1, filter callState != CLOSED)
  async listActiveCalls(agencyId: string): Promise<RcsCall[]>

  // Update call state with optimistic lock on callState (use ConditionExpression)
  async updateCallState(
    callId: string,
    agencyId: string,
    newState: RcsCallState,
    updates: Partial<RcsCall>
  ): Promise<void>

  // Append an audio alert to the call's audioAlerts list
  async appendAudioAlert(callId: string, agencyId: string, alert: RcsAudioAlert): Promise<void>

  // Mark call closed — sets closedAt, TTL (7 days), callState = CLOSED
  async closeCall(callId: string, agencyId: string, override?: RcsClosureOverride): Promise<void>

  // Update unit position
  async upsertUnitPosition(pos: RcsUnitPosition): Promise<void>

  // Query all calls in SILENT_MONITOR or UNIT_EN_ROUTE state (for escalation engine)
  // Uses GSI-2; returns calls across all agencies (internal use only)
  async listCallsPendingArrival(): Promise<RcsCall[]>
}
```

Key implementation requirements:
- Tenant isolation: all reads MUST include `agencyId` in key or condition
- On `updateCallState`: use `ConditionExpression: "callState <> :closed"` to prevent
  updates to already-closed calls
- TTL on calls: 7 days (`Math.floor(Date.now()/1000) + 7 * 86400`)
- TTL on unit positions: 2 hours
- TTL on escalation log entries: 30 days

### 2.2 Lambda — Start Call (Register for Monitoring)
**File:** `apps/api/src/handlers/rcs-call-start.ts`
**Route:** `POST /api/rcs/calls`
**Roles:** dispatcher, supervisor, admin

```
Request body: RcsStartCallRequest
Response: { callId: string; call: RcsCall }

Logic:
1. Extract UserContext from JWT claims
2. Validate required fields (callerAddress, incidentType, priority)
3. Generate callId: `rcs-${Date.now()}-${randomUUID().slice(0,8)}`
4. Create RcsCall record in DynamoDB with:
   - callState: "ACTIVE"
   - callStart: new Date().toISOString()
   - agencyId: user.agencyId
   - dispatcherId: user.userId
   - audioStatus: "ACTIVE"
   - assignedUnits: []
   - audioAlerts: []
   - escalationEvents: []
   - currentEscalationLevel: 0
   - supervisorAcknowledged: false
5. Write audit log: { type: "rcs.call.started", callId, agencyId, dispatcherId }
6. Publish WebSocket event: { type: "rcs:call:started", data: call }
7. Return 201 with { callId, call }

Error cases:
- 400 if missing required fields
- 401 if no valid JWT
- 403 if role not authorized
```

### 2.3 Lambda — Update Call State
**File:** `apps/api/src/handlers/rcs-call-state.ts`
**Route:** `PATCH /api/rcs/calls/{callId}/state`
**Roles:** dispatcher, supervisor, admin

```
Path param: callId
Request body: RcsUpdateCallStateRequest
Response: { call: RcsCall }

State transition rules (enforce these in code):
ACTIVE → SILENT_MONITOR    : any authorized role
ACTIVE → UNIT_DISPATCHED   : any authorized role
SILENT_MONITOR → ACTIVE    : any authorized role (return to call)
UNIT_DISPATCHED → UNIT_EN_ROUTE : any authorized role
UNIT_EN_ROUTE → UNIT_ARRIVED   : any authorized role OR geofence engine
UNIT_ARRIVED → CLOSED          : any authorized role (closure gate satisfied)
* → UNIT_DISPATCHED             : if adding first unit

Invalid transitions return 400.
Transition to CLOSED from any state != UNIT_ARRIVED requires supervisor override.

Logic:
1. Fetch existing call — 404 if not found, 403 if agencyId mismatch
2. Validate state transition is legal
3. If transition is to SILENT_MONITOR: set silentMonitorStart = now
4. If new state is UNIT_EN_ROUTE: set enRouteTime = now
5. If new state is UNIT_ARRIVED: set arrivedTime = now
6. If request includes a unit: merge into assignedUnits (upsert by unitId)
7. Update DynamoDB with new state
8. If state = SILENT_MONITOR: schedule EventBridge escalation events
   (see section 2.6 — Escalation Scheduler)
9. Write audit log
10. Publish WebSocket event: { type: "rcs:call:state_changed", data: { callId, newState } }
```

### 2.4 Lambda — List Active Calls
**File:** `apps/api/src/handlers/rcs-calls-list.ts`
**Route:** `GET /api/rcs/calls`
**Roles:** dispatcher, supervisor, admin, analyst

```
Query params:
  agencyId?: string  (optional — admins can scope; defaults to user.agencyId)
  state?: RcsCallState[]  (comma-separated filter)

Response: { calls: RcsCall[]; count: number }

Logic:
1. Use user.agencyId (never allow cross-agency without RC admin role)
2. Query GSI-1 (AgencyActiveCalls) by agencyId
3. Filter out CLOSED calls client-side if not requested
4. Sort by currentEscalationLevel DESC, then callStart ASC (most critical first)
5. Return max 50 results
```

### 2.5 Lambda — Close Call (Closure Gate)
**File:** `apps/api/src/handlers/rcs-call-close.ts`
**Route:** `POST /api/rcs/calls/{callId}/close`
**Roles:** dispatcher (normal closure only), supervisor, admin

```
Path param: callId
Request body: RcsCloseCallRequest
Response: { success: boolean; callId: string; closedAt: string }

CRITICAL RULE: This is the Closure Gate.

Normal closure (no override):
- Call MUST be in UNIT_ARRIVED state
- If callState != UNIT_ARRIVED → return 409:
  { message: "Cannot close: unit arrival not confirmed. Use override with supervisor authorization." }

Supervisor override closure:
- Requires isSupervisorOrAdmin(user.role) = true
- Requires body.override.supervisorBadge (non-empty string)
- Requires body.override.reason (minimum 20 characters)
- Can close from any non-CLOSED state
- Creates RcsClosureOverride record on the call

Logic:
1. Fetch call, verify agencyId
2. Check state and role (rules above)
3. Write closure to DynamoDB (closeCall repository method)
4. Write escalation table entry documenting closure type
5. Write AuditLogger event:
   type: "rcs.call.closed" | "rcs.call.override_closed"
   Include: callId, agencyId, closedBy, closureType, override details if applicable
6. Cancel any pending EventBridge escalation schedules for this call
7. Publish WebSocket: { type: "rcs:call:closed", data: { callId } }
8. Return 200
```

### 2.6 Lambda — Ingest Unit Position (CAD AVL)
**File:** `apps/api/src/handlers/rcs-unit-position.ts`
**Route:** `POST /api/rcs/units/position`
**Roles:** dispatcher, supervisor, admin, agencyit (CAD integration calls this)

```
Request body: RcsUnitPositionRequest
Response: { updated: boolean; geofenceHit?: boolean; callId?: string }

Logic:
1. Validate lat/lng are valid numbers (-90..90, -180..180)
2. Upsert unit position in RcsUnitsTable
3. If body.activeCallId is provided:
   a. Fetch the call
   b. Run geofence check (see 2.7 below)
   c. If geofence hit: call rcsRepository.updateCallState(callId, agencyId, "UNIT_ARRIVED", ...)
      and notify WebSocket
4. Return result
```

### 2.7 Geofence Engine (Internal Helper)
**File:** `apps/api/src/features/rcs/rcs-geofence.ts`

```typescript
const ARRIVAL_RADIUS_METERS = 150; // Configurable via env RCS_ARRIVAL_RADIUS_M

/**
 * Haversine distance calculation between two lat/lng points.
 * Returns distance in meters.
 */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number { /* implement */ }

/**
 * Returns true if unit position is within ARRIVAL_RADIUS_METERS of the call's
 * callerLat/callerLng. If call has no caller coordinates, returns false.
 */
export function isUnitOnScene(unit: RcsUnitPosition, call: RcsCall): boolean { /* implement */ }
```

### 2.8 Lambda — Escalation Trigger
**File:** `apps/api/src/features/rcs/rcs-escalation-trigger.ts`
**Trigger:** EventBridge Scheduler (NOT HTTP API)
**Event payload:** `{ callId: string; agencyId: string; targetLevel: RcsEscalationLevel }`

```
This Lambda is invoked by EventBridge at T+10, T+20, T+30, T+40 from
silentMonitorStart for each monitored call. It only acts if the call is
still not in UNIT_ARRIVED or CLOSED state.

Escalation thresholds:
Level 1 (T+10 min):  WATCH   — notify dispatcher, flash on supervisor dashboard
Level 2 (T+20 min):  WARNING — notify supervisor via WebSocket push + SNS (if configured)
Level 3 (T+30 min):  CRITICAL — notify supervisor, push to command staff contacts
Level 4 (T+40 min):  EMERGENCY — notify agency admin, push SNS alert

Logic:
1. Fetch call from DynamoDB
2. If callState is UNIT_ARRIVED or CLOSED: return early (no-op)
3. Calculate current escalation level from elapsed time (now - callStart)
4. If call.currentEscalationLevel >= targetLevel: skip (already escalated)
5. Append escalation event to call record
6. Update currentEscalationLevel on call
7. Write to RcsEscalationTable
8. Publish WebSocket: { type: "rcs:call:escalated", data: { callId, level, label } }
9. For level >= 2: send SNS notification (if RCS_SNS_ESCALATION_TOPIC_ARN is set)
10. Write audit log
```

### 2.9 Lambda — Audio Alert
**File:** `apps/api/src/handlers/rcs-audio-alert.ts`
**Route:** `POST /api/rcs/calls/{callId}/audio-alert`
**Roles:** dispatcher, supervisor, admin (also called by audio bridge internal service)

```
Request body: RcsAudioAlertRequest
Response: { alertId: string; appended: boolean }

Logic:
1. Fetch call, verify agencyId
2. Build RcsAudioAlert with alertId = randomUUID(), timestamp = now
3. Update call's audioStatus to match request.audioStatus
4. Append alert to audioAlerts list
5. Publish WebSocket: { type: "rcs:audio:alert", data: { callId, alert } }
6. Return 200
```

### 2.10 Lambda — Supervisor Acknowledge
**File:** `apps/api/src/handlers/rcs-supervisor-ack.ts`
**Route:** `POST /api/rcs/calls/{callId}/acknowledge`
**Roles:** supervisor, admin ONLY

```
Response: { acknowledged: boolean }

Logic:
1. Verify isSupervisorOrAdmin(user.role) — 403 otherwise
2. Fetch call, verify agencyId
3. Set supervisorAcknowledged = true, supervisorAcknowledgedBy = user.userId
4. Write audit log: { type: "rcs.call.supervisor_acknowledged" }
5. Publish WebSocket update
```

---

## PHASE 3: INFRASTRUCTURE (SAM/CloudFormation)

**File:** `template.yaml` (root SAM template)

Add the following under the `Resources:` section. Follow the existing nested stack
pattern visible in the template. Add new env vars to Lambda function environments
that need them. Only add what's needed — do not touch unrelated resources.

### 3.1 DynamoDB Tables

```yaml
# Add to template.yaml Resources:

RcsCallsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${DDBTablePrefix}-rcs-calls"
    BillingMode: PAY_PER_REQUEST
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: !If [IsProd, true, false]
    AttributeDefinitions:
      - { AttributeName: pk, AttributeType: S }
      - { AttributeName: sk, AttributeType: S }
      - { AttributeName: agencyId, AttributeType: S }
      - { AttributeName: callStart, AttributeType: S }
      - { AttributeName: callState, AttributeType: S }
    KeySchema:
      - { AttributeName: pk, KeyType: HASH }
      - { AttributeName: sk, KeyType: RANGE }
    GlobalSecondaryIndexes:
      - IndexName: AgencyActiveCalls
        KeySchema:
          - { AttributeName: agencyId, KeyType: HASH }
          - { AttributeName: callStart, KeyType: RANGE }
        Projection: { ProjectionType: ALL }
      - IndexName: StateIndex
        KeySchema:
          - { AttributeName: callState, KeyType: HASH }
          - { AttributeName: callStart, KeyType: RANGE }
        Projection: { ProjectionType: ALL }
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
    Tags:
      - { Key: Feature, Value: RCS }

RcsUnitsTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${DDBTablePrefix}-rcs-units"
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - { AttributeName: pk, AttributeType: S }
      - { AttributeName: sk, AttributeType: S }
    KeySchema:
      - { AttributeName: pk, KeyType: HASH }
      - { AttributeName: sk, KeyType: RANGE }
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
    Tags:
      - { Key: Feature, Value: RCS }

RcsEscalationTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: !Sub "${DDBTablePrefix}-rcs-escalations"
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - { AttributeName: pk, AttributeType: S }
      - { AttributeName: sk, AttributeType: S }
    KeySchema:
      - { AttributeName: pk, KeyType: HASH }
      - { AttributeName: sk, KeyType: RANGE }
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
    Tags:
      - { Key: Feature, Value: RCS }
```

### 3.2 Lambda Functions

Add these Lambda functions to the SAM template. Follow the existing function patterns
(runtime, handler path, environment variables, policies). Each function needs:
- `RCS_CALLS_TABLE` env var → `!Ref RcsCallsTable`
- `RCS_UNITS_TABLE` env var → `!Ref RcsUnitsTable`
- `RCS_ESCALATION_TABLE` env var → `!Ref RcsEscalationTable`
- IAM policy: `DynamoDBCrudPolicy` on all three tables

HTTP API routes to add to the existing HttpApi:
```
POST   /api/rcs/calls                          → RcsCallStartFunction
PATCH  /api/rcs/calls/{callId}/state           → RcsCallStateFunction
GET    /api/rcs/calls                          → RcsCallsListFunction
POST   /api/rcs/calls/{callId}/close           → RcsCallCloseFunction
POST   /api/rcs/calls/{callId}/audio-alert     → RcsAudioAlertFunction
POST   /api/rcs/calls/{callId}/acknowledge     → RcsSupervisorAckFunction
POST   /api/rcs/units/position                 → RcsUnitPositionFunction
```

The escalation trigger is NOT HTTP — it is an EventBridge Scheduler target:
```yaml
RcsEscalationFunction:
  Type: AWS::Serverless::Function
  Properties:
    # No Events here — invoked directly by EventBridge Scheduler
    # Add permission: events.amazonaws.com to invoke
    Policies:
      - DynamoDBCrudPolicy: { TableName: !Ref RcsCallsTable }
      - DynamoDBCrudPolicy: { TableName: !Ref RcsEscalationTable }
      - SNSPublishMessagePolicy: { TopicName: !If [HasEscalationTopic, ..., ""] }
```

Add template parameter:
```yaml
Parameters:
  RcsEscalationSnsTopicArn:
    Type: String
    Default: ""
    Description: "Optional SNS topic ARN for RCS escalation notifications"
  RcsArrivalRadiusMeters:
    Type: Number
    Default: 150
    Description: "Geofence radius in meters for unit arrival detection"
```

### 3.3 EventBridge Scheduler Helper

The `rcs-call-state.ts` Lambda must schedule EventBridge rules when a call enters
SILENT_MONITOR. Use `@aws-sdk/client-scheduler`:

```typescript
import { SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler";

// Schedule 4 escalation triggers when call enters SILENT_MONITOR:
const ESCALATION_OFFSETS_MIN = [10, 20, 30, 40];

async function scheduleEscalations(call: RcsCall): Promise<void> {
  const client = new SchedulerClient({});
  const silentStart = new Date(call.silentMonitorStart!);

  for (const offsetMin of ESCALATION_OFFSETS_MIN) {
    const fireAt = new Date(silentStart.getTime() + offsetMin * 60000);
    if (fireAt <= new Date()) continue; // already past, skip

    const scheduleName = `rcs-esc-${call.callId}-l${offsetMin}`;
    await client.send(new CreateScheduleCommand({
      Name: scheduleName,
      ScheduleExpression: `at(${fireAt.toISOString().slice(0,19)})`,
      ScheduleExpressionTimezone: "UTC",
      Target: {
        Arn: process.env.RCS_ESCALATION_FUNCTION_ARN!,
        RoleArn: process.env.SCHEDULER_ROLE_ARN!,
        Input: JSON.stringify({
          callId: call.callId,
          agencyId: call.agencyId,
          targetLevel: ESCALATION_OFFSETS_MIN.indexOf(offsetMin) + 1,
        }),
      },
      FlexibleTimeWindow: { Mode: "OFF" },
      ActionAfterCompletion: "DELETE", // Auto-delete after firing
    }));
  }
}

// Cancel schedules when call closes:
async function cancelEscalationSchedules(callId: string): Promise<void> {
  // Delete all schedules matching pattern rcs-esc-{callId}-*
  // Use ListSchedules + DeleteSchedule from @aws-sdk/client-scheduler
}
```

Add `RCS_ESCALATION_FUNCTION_ARN` and `SCHEDULER_ROLE_ARN` to env vars.
Create a `RcsSchedulerRole` IAM role in template.yaml with permission to
invoke the escalation Lambda.

---

## PHASE 4: FRONTEND COMPONENTS

### 4.1 API Client
**File:** `apps/web/src/lib/rcs/rcs-api.ts`

```typescript
// All functions take an optional `bearerToken` param or read from session
// Use the existing API base URL pattern from other API client files in the project

export async function rcsStartCall(body: RcsStartCallRequest): Promise<{ callId: string; call: RcsCall }>
export async function rcsUpdateCallState(callId: string, body: RcsUpdateCallStateRequest): Promise<{ call: RcsCall }>
export async function rcsListActiveCalls(): Promise<{ calls: RcsCall[]; count: number }>
export async function rcsCloseCall(callId: string, body: RcsCloseCallRequest): Promise<{ success: boolean }>
export async function rcsSupervisorAck(callId: string): Promise<{ acknowledged: boolean }>
export async function rcsPostAudioAlert(callId: string, body: RcsAudioAlertRequest): Promise<{ alertId: string }>
export async function rcsPostUnitPosition(body: RcsUnitPositionRequest): Promise<{ updated: boolean }>
```

### 4.2 Real-Time Hook
**File:** `apps/web/src/hooks/use-rcs-monitor.ts`

```typescript
"use client";
// Manages RCS state: polls /api/rcs/calls every 30s, merges real-time
// WebSocket events for instant updates

import { useAgencyWebSocket } from "@/hooks/use-agency-websocket";

export function useRcsMonitor(agencyId: string) {
  // State: calls: RcsCall[], loading, error
  // On mount: fetch all active calls
  // Poll every 30s
  // WebSocket events to handle:
  //   "rcs:call:started"      → add to list
  //   "rcs:call:state_changed"→ update specific call in list
  //   "rcs:call:escalated"    → update escalation level + trigger visual alert
  //   "rcs:audio:alert"       → append alert to call
  //   "rcs:call:closed"       → remove from list
  // Exposed: calls, loading, error, refresh, closeCall, acknowledgeCall

  return {
    calls,        // RcsCall[]
    loading,      // boolean
    error,        // string | null
    criticalCount, // number
    refresh,      // () => void
    closeCall,    // (callId, body) => Promise<void>
    acknowledgeCall, // (callId) => Promise<void>
  };
}
```

### 4.3 Color Tokens
**File:** `apps/web/src/lib/rcs/rcs-colors.ts`

```typescript
// Centralize all RCS color tokens so they're consistent across components
export const RCS_COLORS = {
  bg:         "#060c1a",
  surface:    "#0c1428",
  card:       "#101c32",
  border:     "#1b2b47",
  blue:       "#3b82f6",
  blueLight:  "#93c5fd",
  cyan:       "#22d3ee",
  text:       "#dce6f5",
  textSub:    "#6b83a8",
  textMuted:  "#334466",
} as const;

export const RCS_ESCALATION_COLORS: Record<number, string> = {
  0: "#22c55e",  // nominal
  1: "#eab308",  // watch
  2: "#f97316",  // warning
  3: "#ef4444",  // critical
  4: "#dc2626",  // emergency
};

export const RCS_ESCALATION_LABELS: Record<number, string> = {
  0: "NOMINAL", 1: "WATCH", 2: "WARNING", 3: "CRITICAL", 4: "EMERGENCY",
};

export const RCS_AUDIO_COLORS: Record<string, string> = {
  ACTIVE: "#22d3ee",
  AMBIENT: "#eab308",
  UNRESPONSIVE: "#f97316",
  SILENT: "#ef4444",
};
```

### 4.4 Main Monitor Panel
**File:** `apps/web/src/components/rcs/RcsMonitorPanel.tsx`

This is the primary component mounted in the dispatcher console. It renders the
full silent monitor queue.

```typescript
"use client";
// Props: { agencyId: string; userRole: string; userId: string }
// Uses useRcsMonitor hook
// Renders:
//   - Header bar (system name, live stats, protection notice)
//   - Filter bar (ALL | NOMINAL | WATCH | WARNING | CRITICAL | EMERGENCY)
//   - Call grid (2-3 columns responsive)
//   - Empty state
//   - Footer status strip
// When criticalCount > 0: play a soft chime (use Web Audio API, 1-2 beeps)
//   on state change (not on every render)
```

### 4.5 Call Card
**File:** `apps/web/src/components/rcs/RcsCallCard.tsx`

```typescript
"use client";
// Props: { call: RcsCall; userRole: string; onReturnToCall, onEscalate, onClose }
// Renders everything from the designed card:
//   - Priority badge + call ID + escalation badge (with pulse if level >= 3)
//   - Incident type + address + caller info
//   - Elapsed timer (updates via passed-in tick or internal interval)
//   - Response timeline (Called → Dispatched → En Route → On Scene)
//   - Audio Sentinel strip with animated waveform
//   - Unit cards (one per unit with EMS/LE/FIRE type badge, distance, ETA)
//   - Audio alerts (collapsible, starts expanded for P1 calls)
//   - Supervisor ack warning (if not acknowledged)
//   - Action buttons: RETURN TO CALL | ESCALATE | MAP
//   - Closure Gate footer

// IMPORTANT: The elapsed timer must update every second.
// Use a single interval from the parent (pass tick prop) rather than N intervals.
// This prevents timer drift across many cards.
```

### 4.6 Closure Gate Modal
**File:** `apps/web/src/components/rcs/RcsClosureModal.tsx`

```typescript
"use client";
// Two modes based on whether unit is on scene:
//
// MODE 1 — Normal Closure (callState === "UNIT_ARRIVED"):
//   Simple confirmation: "Unit arrival confirmed. Close this call?"
//   [Cancel] [CLOSE CALL]
//
// MODE 2 — Supervisor Override (callState !== "UNIT_ARRIVED"):
//   Requires: isSupervisorOrAdmin(userRole)
//   If dispatcher tries override: show "Supervisor authorization required" error
//   Fields:
//     - Supervisor Badge # (required)
//     - Reason (required, min 20 chars, shows char count)
//   Confirm button disabled until both fields valid
//   Warning: "This action is permanently logged to the audit record."
//   [Cancel] [CONFIRM OVERRIDE & LOG]
```

### 4.7 Supervisor Dashboard Strip
**File:** `apps/web/src/components/rcs/RcsSupervisorStrip.tsx`

```typescript
"use client";
// A compact horizontal strip for the supervisor dashboard showing:
//   - Count of monitored calls
//   - Count of critical/emergency calls (red badge if > 0)
//   - Link to open full RCS monitor panel
// Props: { agencyId: string }
// Uses useRcsMonitor but only subscribes to count/escalation data
// Suitable for embedding at top of existing supervisor dashboard
```

### 4.8 Page Route
**File:** `apps/web/src/app/[agencySlug]/rcs/page.tsx`

```typescript
// Server component — fetch session, pass agencyId and role to client components
// Route: /<agencySlug>/rcs
// Auth: redirect to login if no session
// Render: <RcsMonitorPanel agencyId={...} userRole={...} userId={...} />
// Title: "Response Continuity System | Rapid Cortex"
// Add this route to the existing agency nav (follow venue nav pattern in venue-nav.tsx)
```

### 4.9 Silent Monitor Trigger ⬅ CRITICAL — THIS IS HOW CALLS ENTER RCS
**File:** `apps/web/src/components/rcs/RcsSilentMonitorTrigger.tsx`

This is the entry point for the entire system. Without it, no calls can be registered
into RCS. It renders inside the dispatcher's active call UI as a single action button.

```typescript
"use client";

// Props:
export interface RcsSilentMonitorTriggerProps {
  // Data about the active call being backgrounded
  cadIncidentId?: string;
  callerPhone?: string;
  callerAddress: string;
  incidentType: string;
  priority: "P1" | "P2" | "P3";
  audioSessionId?: string;
  // Context
  agencyId: string;
  userRole: string;
  // Callback: called after successful RCS registration so the parent can
  // update its own state (e.g. show a "monitoring" badge on the call)
  onMonitoringStarted?: (callId: string) => void;
}

// Internal state machine:
// "idle"       → button reads "Silent Monitor" with shield icon
// "confirming" → inline confirmation: "Keep audio live and take another call?"
//                [Cancel] [Confirm — Silent Monitor]
// "submitting" → button disabled, spinner, "Protecting call..."
// "monitoring" → success state: green badge "Protected · RC-XXXX"
//                (this state persists until dispatcher clicks "Return to Call")
// "error"      → red inline error message, retry button

// On confirm click:
// 1. Call rcsStartCall({ cadIncidentId, callerPhone, callerAddress,
//                        incidentType, priority, audioSessionId })
//    → receives { callId, call }
// 2. Call rcsUpdateCallState(callId, { callState: "SILENT_MONITOR" })
// 3. On success:
//    a. Transition to "monitoring" state showing callId badge
//    b. Call onMonitoringStarted(callId)
//    c. Fire a window custom event "rcs:monitoring:started" so RcsNavBadge
//       can update its count without waiting for the next WebSocket poll:
//       window.dispatchEvent(new CustomEvent("rcs:monitoring:started", { detail: { callId } }))
// 4. On failure: transition to "error" state with message from API response

// Visual requirements:
// - "idle" button: dark blue background (#1e3a5f), shield icon (lucide Shield),
//   text "Silent Monitor", 11px font, compact — fits in a call action bar
// - "confirming" state: renders inline (no modal) directly below/beside the button
//   with a brief warning: "Audio stays live. Call is protected until a unit arrives."
// - "monitoring" badge: green (#22c55e) with a lock icon and the RC call ID
//   e.g. "🔒 Protected · RC-0847" — replaces the button entirely
// - "error" state: red text inline, "Retry" link

// RBAC: Render for BOTH dispatchers AND supervisors.
// Check: canManageRcsCall(userRole) — import from @/lib/rcs/rcs-authz
// If role is not authorized: render nothing (null) — do not show a disabled button
```

**Integration points — mount this component in TWO places:**

**1. Dispatcher console active call component.** Search for:
```
apps/web/src/components/dispatch/ActiveCallCard.tsx
apps/web/src/components/dispatch/CallWorkspace.tsx
apps/web/src/components/dispatcher/LiveCallPanel.tsx
apps/web/src/app/[agencySlug]/dispatch/...
```
Find the component that renders the per-call action bar (where buttons like
"Transfer", "Hold", "End Call" live). Import and mount `RcsSilentMonitorTrigger`
there with the call's data as props.

**2. Supervisor console active call / floor view component.** Supervisors can also
background a call they are directly handling. Search for:
```
apps/web/src/components/supervisor/ActiveCallView.tsx
apps/web/src/components/supervisor/FloorMonitorCard.tsx
apps/web/src/app/[agencySlug]/supervisor/...
```
Mount the same `RcsSilentMonitorTrigger` component wherever the supervisor's
per-call action controls render. Same props, same behavior.

If you cannot locate either console component, add a clearly marked TODO comment
at the closest identified integration point and create a standalone demo page at:
`apps/web/src/app/[agencySlug]/rcs/trigger-demo/page.tsx`
that mounts the trigger with mock call data so it can be tested independently.

**Authorization helper to create:**
**File:** `apps/web/src/lib/rcs/rcs-authz.ts`

```typescript
// Client-side RBAC helpers — mirror the server-side rcs-authz.ts
// These gate what the UI renders, not what the API allows (API enforces its own RBAC)
//
// Both dispatchers AND supervisors can initiate silent monitoring and view the
// RCS monitor. Supervisors additionally get the override close permission.

const SILENT_MONITOR_ROLES = new Set([
  "dispatcher", "supervisor", "agencyadmin", "agencyit",
  "commsupervisor", "rcadmin", "rcsuperadmin",
]);

export function canManageRcsCall(role: string): boolean {
  return SILENT_MONITOR_ROLES.has(role?.toLowerCase());
}

export function canSupervisorOverride(role: string): boolean {
  const r = role?.toLowerCase();
  return r === "supervisor" || r === "commsupervisor" ||
         r === "agencyadmin" || r === "agencyit" ||
         r === "rcadmin" || r === "rcsuperadmin";
}
```

### 4.10 Dispatcher Nav Badge
**File:** `apps/web/src/components/rcs/RcsNavBadge.tsx`

A persistent indicator in the dispatcher and supervisor nav showing live monitored
call count. Always visible without navigating to the `/rcs` page.

```typescript
"use client";

// Props: { agencyId: string; agencySlug: string; userRole: string }

// Renders as a compact nav item:
//
//   [🔒] RCS Monitor   [3]
//        ↑ icon  ↑ label  ↑ count badge
//
// VISUAL STATES — implement all four precisely:
//
// STATE 1 — No monitored calls:
//   Quiet nav link, no badge. Icon and label at normal opacity (0.5).
//
// STATE 2 — Active calls, none critical (escalationLevel 0–2):
//   Blue count badge (#3b82f6). No animation. Static.
//
// STATE 3 — One or more CRITICAL calls (escalationLevel 3):
//   The entire nav item — icon, label, AND badge — pulses.
//   CSS animation: opacity alternates 1.0 ↔ 0.4 over 1.2s ease-in-out infinite.
//   Badge color: #ef4444 (red).
//   Icon color shifts to red.
//
// STATE 4 — One or more EMERGENCY calls (escalationLevel 4):
//   Full nav item pulses faster and more aggressively.
//   CSS animation: opacity alternates 1.0 ↔ 0.15 over 0.7s ease-in-out infinite.
//   Badge color: #dc2626 (deep red).
//   Badge also scales: transform alternates scale(1.0) ↔ scale(1.25) in sync.
//   Icon color: #dc2626. Nav item gets a left border: 2px solid #dc2626.
//   This should feel like an alarm, not a notification.
//
// IMPLEMENTATION — use inline keyframe injection, not Tailwind:
//   Inject a <style> tag once on mount with the keyframe definitions:
//
//   @keyframes rcsBadgePulseCritical {
//     0%, 100% { opacity: 1; }
//     50%       { opacity: 0.4; }
//   }
//   @keyframes rcsBadgePulseEmergency {
//     0%, 100% { opacity: 1;    transform: scale(1); }
//     50%       { opacity: 0.15; transform: scale(1.25); }
//   }
//
//   Apply animation via inline style on the wrapper div:
//   style={{ animation: isEmergency
//     ? "rcsBadgePulseEmergency 0.7s ease-in-out infinite"
//     : isCritical
//       ? "rcsBadgePulseCritical 1.2s ease-in-out infinite"
//       : "none" }}
//
// The pulsing must be immediately visible in the nav WITHOUT the user
// clicking anything. It is an ambient alarm, always in peripheral vision.
// - Clicking anywhere on the item navigates to /<agencySlug>/rcs

// Data source:
// - On mount: call rcsListActiveCalls() to get initial count
// - Subscribe to window "rcs:monitoring:started" custom event
//   (fired by RcsSilentMonitorTrigger on success) to increment immediately
// - Subscribe to useAgencyWebSocket for "rcs:call:closed" and
//   "rcs:call:escalated" events to keep count and critical state current
// - Re-fetch full list every 60s as a backstop

// Placement: add to BOTH the dispatcher nav AND the supervisor nav.
// Follow the exact pattern used in venue-nav.tsx for NavItem rendering.
// Render for any role where canManageRcsCall(userRole) is true —
// that means dispatchers and supervisors both see the live badge in their nav.

// The nav item definition to add to the agency nav items array:
// {
//   id: "rcs",
//   label: "RCS Monitor",
//   href: `${linkBase}/rcs`,
//   icon: Shield,    // from lucide-react
// }
// Wrap the label with <RcsNavBadge> for the live count overlay.
```

---

## PHASE 5: SECURITY REQUIREMENTS

### 5.1 Cross-Agency Isolation (MANDATORY)

Every Lambda handler MUST:
1. Extract `agencyId` from the JWT claims (never from request body alone)
2. When fetching a call: `getCall(callId, user.agencyId)` — passes agencyId to repo
3. Repository `getCall` must verify `record.agencyId === agencyId` before returning
4. Unit position updates: verify unit's agencyId matches calling user's agencyId
5. Escalation Lambda (internal) does not use HTTP auth — it reads agencyId from
   the EventBridge payload which was written by an authenticated Lambda

### 5.2 Role-Based Access Control

```
Dispatcher  → can: start call, update state, list calls, add audio alert, ingest position
              cannot: supervisor override close, acknowledge as supervisor
Supervisor  → can: all dispatcher actions + supervisor override close + acknowledge
Admin       → can: all actions
Analyst     → can: list calls (read-only)
```

Implement a helper:
```typescript
// apps/api/src/features/rcs/rcs-authz.ts
export function canManageRcsCall(role: string): boolean
export function canSupervisorOverride(role: string): boolean
export function canReadRcs(role: string): boolean
```

### 5.3 Audit Requirements

Every state change, closure, escalation, and override MUST write an audit entry.
Use the existing `AuditLogger` from `rapid-cortex-shared`.

Required audit event types (add to AUDIT_ACTIONS or a local enum):
```
"rcs.call.started"
"rcs.call.state_changed"
"rcs.call.escalated"
"rcs.call.audio_alert"
"rcs.call.supervisor_acknowledged"
"rcs.call.closed"
"rcs.call.override_closed"   ← most critical — includes full override details
```

The `override_closed` event MUST include:
- supervisorBadge
- reason (full text)
- callState at time of override
- elapsedMilliseconds at time of override

### 5.4 Input Validation

- All request bodies: validate with explicit field checks (no Zod — use manual validation
  matching the existing pattern in the codebase)
- callId in path params: validate format matches `rcs-{timestamp}-{uuid}` or reject
- lat/lng: validate numeric range before storing
- supervisorBadge: non-empty string, max 20 chars
- override reason: string, min 20 chars, max 500 chars

---

## PHASE 6: SMOKE TESTS

**File:** `scripts/rcs-smoke-test.ts`

Follow the pattern in `scripts/pilot-smoke-test.ts`. Add these checks:

```
PASS — rcs_call_create          POST /api/rcs/calls → 201
PASS — rcs_call_state_update    PATCH /api/rcs/calls/{id}/state → 200
PASS — rcs_calls_list           GET /api/rcs/calls → 200 with array
PASS — rcs_closure_gate_block   POST /api/rcs/calls/{id}/close (no unit arrived) → 409
PASS — rcs_closure_normal       POST /api/rcs/calls/{id}/close (unit arrived) → 200
PASS — rcs_cross_agency_block   Agency B JWT cannot GET Agency A's calls → 403 or empty
PASS — rcs_dispatcher_override_block  Dispatcher cannot do override close → 403
PASS — rcs_supervisor_override  Supervisor with badge+reason can override → 200
PASS — rcs_audio_alert          POST audio alert → 200, appended to call
PASS — rcs_escalation_level     Call at T+10 has escalationLevel >= 1
```

Also add an `rcs_health` check to `scripts/post-deploy-smoke.sh`.

---

## PHASE 7: ENV VAR ADDITIONS

Add to `apps/api/src/lib/env.ts`:
```typescript
rcsCallsTable?: string;        // process.env.RCS_CALLS_TABLE
rcsUnitsTable?: string;        // process.env.RCS_UNITS_TABLE
rcsEscalationTable?: string;   // process.env.RCS_ESCALATION_TABLE
rcsEscalationFunctionArn?: string;  // process.env.RCS_ESCALATION_FUNCTION_ARN
rcsSchedulerRoleArn?: string;       // process.env.SCHEDULER_ROLE_ARN
rcsEscalationSnsTopicArn?: string;  // process.env.RCS_ESCALATION_SNS_TOPIC_ARN
rcsArrivalRadiusMeters?: number;    // process.env.RCS_ARRIVAL_RADIUS_M (default 150)
```

Add to `scripts/env-api-dev.sh` (with dev placeholder values):
```bash
export RCS_CALLS_TABLE="rapid-cortex-dev-rcs-calls"
export RCS_UNITS_TABLE="rapid-cortex-dev-rcs-units"
export RCS_ESCALATION_TABLE="rapid-cortex-dev-rcs-escalations"
export RCS_ARRIVAL_RADIUS_M="150"
```

---

## IMPLEMENTATION ORDER

Work in this sequence to avoid blocking dependencies:

```
1.  Shared types            → packages/rapid-cortex-shared/src/rcs-types.ts
2.  SAM tables              → template.yaml (DynamoDB resources only)
3.  Repository              → apps/api/src/features/rcs/rcs-repository.ts
4.  Server authz helper     → apps/api/src/features/rcs/rcs-authz.ts
5.  Geofence engine         → apps/api/src/features/rcs/rcs-geofence.ts
6.  Lambda: start call      → apps/api/src/handlers/rcs-call-start.ts
7.  Lambda: list calls      → apps/api/src/handlers/rcs-calls-list.ts
8.  Lambda: state update    → apps/api/src/handlers/rcs-call-state.ts
9.  Lambda: close call      → apps/api/src/handlers/rcs-call-close.ts
10. Lambda: unit pos        → apps/api/src/handlers/rcs-unit-position.ts
11. Lambda: audio alert     → apps/api/src/handlers/rcs-audio-alert.ts
12. Lambda: supervisor ack  → apps/api/src/handlers/rcs-supervisor-ack.ts
13. Lambda: escalation      → apps/api/src/features/rcs/rcs-escalation-trigger.ts
14. SAM functions           → template.yaml (Lambda + EventBridge resources)
15. Frontend: api client    → apps/web/src/lib/rcs/rcs-api.ts
16. Frontend: client authz  → apps/web/src/lib/rcs/rcs-authz.ts   ← gates UI rendering
17. Frontend: hook          → apps/web/src/hooks/use-rcs-monitor.ts
18. Frontend: colors        → apps/web/src/lib/rcs/rcs-colors.ts
19. Frontend: Trigger       → apps/web/src/components/rcs/RcsSilentMonitorTrigger.tsx
20. Frontend: NavBadge      → apps/web/src/components/rcs/RcsNavBadge.tsx
21. Frontend: CallCard      → apps/web/src/components/rcs/RcsCallCard.tsx
22. Frontend: Modal         → apps/web/src/components/rcs/RcsClosureModal.tsx
23. Frontend: Panel         → apps/web/src/components/rcs/RcsMonitorPanel.tsx
24. Frontend: Strip         → apps/web/src/components/rcs/RcsSupervisorStrip.tsx
25. Frontend: Page          → apps/web/src/app/[agencySlug]/rcs/page.tsx
26. Integration: nav        → add RcsNavBadge to dispatcher nav AND supervisor nav
27. Integration: console    → mount RcsSilentMonitorTrigger in dispatcher call workspace AND supervisor call view
28. Smoke tests             → scripts/rcs-smoke-test.ts
29. Env vars                → scripts/env-api-dev.sh
```

**Steps 26 and 27 are integration steps into existing files.** Do not skip them.
If the exact dispatcher console component cannot be located, implement the
trigger-demo page fallback described in section 4.9 and leave a clearly marked
`// TODO: mount RcsSilentMonitorTrigger in <ComponentName> here` comment at
the integration point you identified.

---

## ACCEPTANCE CRITERIA

A correct implementation satisfies ALL of the following:

**API & Backend**
- [ ] `POST /api/rcs/calls` creates a DynamoDB record with correct agencyId scoping
- [ ] `GET /api/rcs/calls` returns only calls for the requesting user's agency
- [ ] A call in ACTIVE or SILENT_MONITOR state returns 409 when close is attempted without override
- [ ] A call in UNIT_ARRIVED state closes successfully with 200
- [ ] A dispatcher (non-supervisor) cannot use the override close endpoint (403)
- [ ] A supervisor override without `supervisorBadge` or with `reason` < 20 chars returns 400
- [ ] Override closure writes an audit record with full override details
- [ ] Unit position update within 150m of call's callerLat/callerLng transitions state to UNIT_ARRIVED
- [ ] EventBridge schedules are created when a call enters SILENT_MONITOR
- [ ] EventBridge schedules are deleted when a call is closed
- [ ] Escalation Lambda no-ops if call is already UNIT_ARRIVED or CLOSED
- [ ] Agency B's JWT cannot read, update, or close Agency A's calls
- [ ] WebSocket events fire on every state change, escalation, and audio alert

**Dispatcher Trigger (RcsSilentMonitorTrigger)**
- [ ] Trigger renders in the dispatcher console call workspace for dispatcher and supervisor roles
- [ ] Trigger renders in the supervisor console call view for supervisor roles
- [ ] Trigger renders nothing (null) for roles where `canManageRcsCall()` returns false
- [ ] Clicking "Silent Monitor" shows inline confirmation before making any API call
- [ ] Clicking "Cancel" in confirmation returns to idle state with no API call made
- [ ] On confirm: calls `rcsStartCall()` then `rcsUpdateCallState("SILENT_MONITOR")` in sequence
- [ ] On success: button is replaced by a green "Protected · RC-XXXX" badge
- [ ] On success: fires `window.dispatchEvent(new CustomEvent("rcs:monitoring:started", ...))`
- [ ] On API error: shows inline error message and a retry option; does not crash
- [ ] While submitting: button is disabled and shows loading state

**Nav Badge (RcsNavBadge)**
- [ ] Nav badge renders in the agency nav for dispatcher and supervisor roles
- [ ] Nav badge shows accurate monitored call count on mount
- [ ] Nav badge increments immediately when `rcs:monitoring:started` custom event fires
- [ ] Nav badge updates when WebSocket `rcs:call:closed` event fires
- [ ] Nav badge count badge is blue and static when all calls are NOMINAL/WATCH/WARNING
- [ ] Nav badge — entire item (icon + label + badge) pulses at 1.2s when any call is CRITICAL
- [ ] Nav badge — entire item pulses faster (0.7s) AND badge scales when any call is EMERGENCY
- [ ] Nav badge pulsing is visible in the nav without the user taking any action
- [ ] Nav badge shows no count badge when monitored call count is 0
- [ ] Clicking nav badge navigates to `/<agencySlug>/rcs`

**Monitor Panel & Closure Gate**
- [ ] RcsMonitorPanel renders with live elapsed timers updating every second
- [ ] Closure Gate modal shows normal mode when callState is UNIT_ARRIVED
- [ ] Closure Gate modal shows override mode when callState is not UNIT_ARRIVED
- [ ] Override modal submit is disabled until both supervisorBadge and reason (≥20 chars) are filled

**General**
- [ ] RCS smoke test script passes all probes against a running dev stack
- [ ] No existing tests or Lambda functions are broken by this change

---

## DO NOT

- Do not use `process.env.X` directly in Lambda handlers — always go through `env.ts`
- Do not allow any DynamoDB read without agencyId scoping
- Do not trust `agencyId` from the request body — always use JWT claims
- Do not close a call without writing an audit log entry
- Do not add Tailwind classes to RCS frontend components — use inline styles matching
  the existing color token pattern
- Do not add new npm packages unless strictly necessary — prefer AWS SDK v3 clients
  already in the project
- Do not modify existing Lambda handlers, repositories, or SAM resources unless
  explicitly required for RCS integration
- Do not expose the escalation Lambda via HTTP API — it is an internal EventBridge target only

---

*Rapid Cortex — Intelligence at the speed of response.*
*This feature exists to prevent the next Ryleigh Daigle.*
