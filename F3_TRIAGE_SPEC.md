# F3 — Non-Emergency AI Triage
## Cursor Implementation Spec

> Drop this file into the repo root. Open it in Cursor alongside the files listed
> under **File Map** below. All patterns follow F4 SOP (ENABLE_SOP_PROTOCOL_AI /
> SOP_DETECT_EVERY_N_SEGMENTS) exactly — use that feature as your reference implementation.

---

## Overview

After every `TRIAGE_DETECT_EVERY_N_SEGMENTS` transcript segments, the API pipeline
sends accumulated transcript text to Claude (Bedrock) to classify the call as
`EMERGENCY`, `NON_EMERGENCY`, or `UNCERTAIN`.

- **EMERGENCY** — normal dispatch flow, no change.
- `UNCERTAIN` — always treated as EMERGENCY (safety default). Shown as a soft
  warning on the dispatcher console. Human remains in full control.
- `NON_EMERGENCY` — the incident is placed in the agency non-emergency queue.
  Dispatcher sees a badge and may override. Supervisor sees the queue panel.

After-action reports log the triage decision, confidence, reasoning, and any
human override so the agency has a complete audit trail.

**Hard rule:** The AI triage result is advisory only. A dispatcher can override to
EMERGENCY at any time. An override always wins and is logged.

---

## Environment Variables

Already present in `dev-staging-phase2.env` (uncomment to enable):

```
ENABLE_NON_EMERGENCY_TRIAGE=true
TRIAGE_DETECT_EVERY_N_SEGMENTS=5
TRIAGE_MOCK=false
NEXT_PUBLIC_ENABLE_NON_EMERGENCY_TRIAGE=1
```

Agency-level toggle (via PATCH /api/agencies/{agencyId}):
```json
{ "triage": { "enabled": true, "nonEmergencyQueueEnabled": true } }
```

---

## File Map — Create These Files

```
packages/shared/src/triage/
  types.ts                     ← shared types (TriageResult, TriageQueue*, etc.)
  index.ts                     ← barrel export

apps/api/src/handlers/triage/
  analyze.ts                   ← Lambda: classify N segments, write result to DDB
  queue.ts                     ← Lambda: GET/PATCH non-emergency queue
  override.ts                  ← Lambda: dispatcher override (EMERGENCY escalation)

apps/api/src/lib/triage/
  classifier.ts                ← AI classification logic (Bedrock / mock)
  prompt.ts                    ← system + user prompt builders
  queue-store.ts               ← DynamoDB read/write helpers for queue table

apps/web/src/app/api/triage/
  analyze/route.ts             ← Next.js proxy → Lambda analyze
  queue/route.ts               ← Next.js proxy → Lambda queue GET/PATCH
  override/route.ts            ← Next.js proxy → Lambda override

apps/web/src/components/triage/
  TriageBadge.tsx              ← Dispatcher console badge (EMERGENCY / NON-EMERGENCY / ANALYZING)
  NonEmergencyQueuePanel.tsx   ← Supervisor queue panel
  TriageOverrideModal.tsx      ← Override confirmation dialog
  useTriagePolling.ts          ← SWR hook — polls /api/triage/queue
```

---

## Modify These Files

| File | Change |
|------|--------|
| `infra/template.yaml` | Add `TriageAnalyzeFunction`, `TriageQueueFunction`, `TriageOverrideFunction`, `NonEmergencyQueueTable` |
| `packages/shared/src/index.ts` | Export from `./triage/index.js` |
| `apps/api/src/handlers/transcript/segment-added.ts` | After N segments, invoke triage analyze (same pattern as SOP detection invoke) |
| `apps/web/src/components/dispatcher/CallWorkspace.tsx` | Mount `<TriageBadge />` |
| `apps/web/src/components/supervisor/SupervisorDashboard.tsx` | Mount `<NonEmergencyQueuePanel />` when feature flag is on |

---

## DynamoDB — NonEmergencyQueueTable

```
PK: agencyId                         (String)
SK: queuedAt#incidentId              (String — ISO timestamp + UUID)

status          String   PENDING | IN_PROGRESS | CLOSED | ESCALATED
classification  String   NON_EMERGENCY | UNCERTAIN
confidence      Number   0–100
reasoning       String   AI explanation (≤500 chars)
suggestedCategory String  e.g. "Noise Complaint", "Property Damage", "Information Request"
suggestedPriority String  P2 | P3
incidentId      String
agencyId        String
callerId        String   (redacted after retention window)
transcriptSummary String  First 300 chars of transcript at time of triage
assignedTo      String?  userId who claimed this queue item
assignedAt      String?  ISO timestamp
closedAt        String?
closedBy        String?
closureNotes    String?
overrideBy      String?  userId — set when dispatcher escalates to EMERGENCY
overrideAt      String?
overrideReason  String?
ttl             Number   Unix epoch — set from agency retention policy

GSI: StatusIndex   PK=agencyId, SK=status   (for PENDING / IN_PROGRESS queries)
```

---

## Lambda: TriageAnalyzeFunction

**Trigger:** Called from `segment-added` handler after every N segments (not an HTTP route).

**Input event:**
```ts
{
  agencyId: string;
  incidentId: string;
  segments: TranscriptSegment[];   // all segments so far, not just the new batch
  agencyConfig: AgencyConfig;      // read from DDB before invoking
}
```

**Output (written to DDB IncidentsTable + NonEmergencyQueueTable):**
```ts
{
  classification: 'EMERGENCY' | 'NON_EMERGENCY' | 'UNCERTAIN';
  confidence: number;          // 0–100
  reasoning: string;
  suggestedCategory: string;
  suggestedPriority: 'P1' | 'P2' | 'P3';
  processedAt: string;
  segmentCount: number;
}
```

**Safety rule:** If classification is UNCERTAIN, write it as UNCERTAIN but treat
operationally as EMERGENCY — do NOT queue it. Only NON_EMERGENCY gets queued.

**Mock mode:** When `TRIAGE_MOCK=true`, return deterministic fixture. Use
`incidentId.includes('nonemerge')` → NON_EMERGENCY, else EMERGENCY.

---

## Lambda: TriageQueueFunction

**HTTP routes (via API Gateway):**
```
GET  /api/triage/queue                           supervisor/admin only
PATCH /api/triage/queue/{incidentId}             dispatcher/supervisor/admin
  body: { status, assignedTo?, closureNotes? }
```

**RBAC:** Enforce `isSupervisorOrAdmin` for GET. Dispatchers may only PATCH their
own assigned items or items in PENDING state. Use existing `AuthorizationService`.

---

## Lambda: TriageOverrideFunction

**HTTP route:**
```
POST /api/triage/override
body: { incidentId: string; reason?: string }
```

Any authenticated user (dispatcher+) may override. Writes:
- `overrideBy`, `overrideAt`, `overrideReason` to queue item
- Removes item from queue (sets status = ESCALATED)
- Appends audit log entry: `triage.override`
- Emits WebSocket event `TRIAGE_OVERRIDDEN` to incident room

---

## AI Classifier Prompt

### System prompt
```
You are a 911 dispatch triage assistant for the Rapid Cortex platform.
Your job is to classify an ongoing emergency call transcript as EMERGENCY,
NON_EMERGENCY, or UNCERTAIN based on the transcript so far.

Classification rules:
- EMERGENCY: Any life-safety threat, active crime, fire, medical distress, weapons
  mentioned, caller in danger, unconscious person, active accident, child welfare,
  domestic violence, or anything you are not highly confident is non-emergency.
- NON_EMERGENCY: Clearly non-threatening. Noise complaints, minor property damage
  already resolved, general information requests, non-injury parking complaints,
  nuisance issues with no ongoing threat.
- UNCERTAIN: When you are not highly confident. Default to UNCERTAIN rather than
  incorrectly classifying an emergency as non-emergency.

Safety rule: When in doubt, classify as UNCERTAIN. A false EMERGENCY is far less
harmful than a false NON_EMERGENCY.

Respond ONLY with valid JSON matching this schema exactly:
{
  "classification": "EMERGENCY" | "NON_EMERGENCY" | "UNCERTAIN",
  "confidence": <integer 0-100>,
  "reasoning": "<≤300 chars, plain English>",
  "suggestedCategory": "<short string, e.g. 'Noise Complaint'>",
  "suggestedPriority": "P1" | "P2" | "P3"
}
No markdown, no explanation outside the JSON object.
```

### User prompt
```
Agency: {agencyName}
Transcript so far ({segmentCount} segments, {durationSeconds}s):

{transcriptText}

Classify this call.
```

---

## React: TriageBadge

Mounted in `CallWorkspace` next to the call status indicator.

States:
- `idle` — feature not running yet (hidden)
- `analyzing` — show pulsing "Analyzing..." with spinner
- `emergency` — show green "EMERGENCY" badge (no action needed)
- `non_emergency` — show yellow "NON-EMERGENCY" badge + "Override →" button
- `uncertain` — show amber "UNCERTAIN — Treating as Emergency" badge
- `overridden` — show green "ESCALATED BY DISPATCHER" badge

On click of "Override →" → open `TriageOverrideModal`.

---

## React: NonEmergencyQueuePanel

Supervisor-only panel. Shows `PENDING` and `IN_PROGRESS` queue items.

Each row:
- Incident ID (truncated)
- Suggested category
- Confidence badge (color-coded: green ≥85, yellow ≥70, red <70)
- Wait time (elapsed since `queuedAt`)
- Status (PENDING / IN_PROGRESS / assigned to whom)
- Actions: Claim | Release | Close | Escalate to Emergency

Polling: SWR with 10s refresh (`useTriagePolling`). Show "LIVE" indicator.

Empty state: "No non-emergency calls in queue" with a ✓ icon.

---

## SAM Template Additions (add to infra/template.yaml)

### Parameters (add to Parameters section)
```yaml
EnableNonEmergencyTriage:
  Type: String
  Default: "false"
  AllowedValues: ["true", "false"]

TriageDetectEveryNSegments:
  Type: Number
  Default: 5

TriageMock:
  Type: String
  Default: "false"
  AllowedValues: ["true", "false"]
```

### Condition
```yaml
HasNonEmergencyTriage: !Equals [!Ref EnableNonEmergencyTriage, "true"]
```

### DynamoDB Table
```yaml
NonEmergencyQueueTable:
  Type: AWS::DynamoDB::Table
  Condition: HasNonEmergencyTriage
  Properties:
    TableName: !Sub "${DynamoTableNamePrefix}-non-emergency-queue-${DeploymentStage}"
    BillingMode: !Ref DynamoBillingMode
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: !Ref DynamoPointInTimeRecovery
    AttributeDefinitions:
      - AttributeName: agencyId
        AttributeType: S
      - AttributeName: sk
        AttributeType: S
      - AttributeName: status
        AttributeType: S
    KeySchema:
      - AttributeName: agencyId
        KeyType: HASH
      - AttributeName: sk
        KeyType: RANGE
    GlobalSecondaryIndexes:
      - IndexName: StatusIndex
        KeySchema:
          - AttributeName: agencyId
            KeyType: HASH
          - AttributeName: status
            KeyType: RANGE
        Projection:
          ProjectionType: ALL
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
    SSESpecification:
      SSEEnabled: true
```

### Lambda Functions (add under Resources)
```yaml
TriageAnalyzeFunction:
  Type: AWS::Serverless::Function
  Condition: HasNonEmergencyTriage
  Properties:
    FunctionName: !Sub "${AppName}-triage-analyze-${DeploymentStage}"
    Handler: handlers/triage/analyze.handler
    Description: "F3 Non-Emergency Triage — classify transcript segments"
    Timeout: 30
    MemorySize: 512
    Environment:
      Variables:
        ENABLE_NON_EMERGENCY_TRIAGE: !Ref EnableNonEmergencyTriage
        TRIAGE_DETECT_EVERY_N_SEGMENTS: !Ref TriageDetectEveryNSegments
        TRIAGE_MOCK: !Ref TriageMock
        NON_EMERGENCY_QUEUE_TABLE: !Ref NonEmergencyQueueTable
        INCIDENTS_TABLE: !Ref IncidentsTable
        AUDIT_TABLE: !Ref AuditTable
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref NonEmergencyQueueTable
      - DynamoDBCrudPolicy:
          TableName: !Ref IncidentsTable
      - DynamoDBCrudPolicy:
          TableName: !Ref AuditTable
      - Statement:
          Effect: Allow
          Action:
            - bedrock:InvokeModel
          Resource: "*"

TriageQueueFunction:
  Type: AWS::Serverless::Function
  Condition: HasNonEmergencyTriage
  Properties:
    FunctionName: !Sub "${AppName}-triage-queue-${DeploymentStage}"
    Handler: handlers/triage/queue.handler
    Description: "F3 Non-Emergency Triage — queue GET/PATCH"
    Timeout: 15
    MemorySize: 256
    Environment:
      Variables:
        NON_EMERGENCY_QUEUE_TABLE: !Ref NonEmergencyQueueTable
        AUDIT_TABLE: !Ref AuditTable
    Events:
      GetQueue:
        Type: HttpApi
        Properties:
          ApiId: !Ref Api
          Path: /api/triage/queue
          Method: GET
          Auth:
            Authorizer: CognitoJwtAuthorizer
      PatchQueue:
        Type: HttpApi
        Properties:
          ApiId: !Ref Api
          Path: /api/triage/queue/{incidentId}
          Method: PATCH
          Auth:
            Authorizer: CognitoJwtAuthorizer
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref NonEmergencyQueueTable
      - DynamoDBCrudPolicy:
          TableName: !Ref AuditTable

TriageOverrideFunction:
  Type: AWS::Serverless::Function
  Condition: HasNonEmergencyTriage
  Properties:
    FunctionName: !Sub "${AppName}-triage-override-${DeploymentStage}"
    Handler: handlers/triage/override.handler
    Description: "F3 Non-Emergency Triage — dispatcher escalation override"
    Timeout: 15
    MemorySize: 256
    Environment:
      Variables:
        NON_EMERGENCY_QUEUE_TABLE: !Ref NonEmergencyQueueTable
        AUDIT_TABLE: !Ref AuditTable
    Events:
      Override:
        Type: HttpApi
        Properties:
          ApiId: !Ref Api
          Path: /api/triage/override
          Method: POST
          Auth:
            Authorizer: CognitoJwtAuthorizer
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref NonEmergencyQueueTable
      - DynamoDBCrudPolicy:
          TableName: !Ref AuditTable
```

### Outputs (add to Outputs section)
```yaml
NonEmergencyQueueTableName:
  Condition: HasNonEmergencyTriage
  Value: !Ref NonEmergencyQueueTable
  Description: DynamoDB table for non-emergency triage queue (F3)

TriageAnalyzeFunctionName:
  Condition: HasNonEmergencyTriage
  Value: !Ref TriageAnalyzeFunction
  Description: Lambda ARN for triage segment analysis (F3)
```

---

## Deployment Activation

```bash
# dev — enable feature
ENABLE_NON_EMERGENCY_TRIAGE=true \
TRIAGE_DETECT_EVERY_N_SEGMENTS=5 \
TRIAGE_MOCK=true \
./scripts/deploy.sh dev

# staging — real AI, tune detection window
ENABLE_NON_EMERGENCY_TRIAGE=true \
TRIAGE_DETECT_EVERY_N_SEGMENTS=3 \
TRIAGE_MOCK=false \
./scripts/deploy.sh staging

# Enable per agency after deploy
aws dynamodb update-item \
  --table-name rapid-cortex-agencies-dev \
  --key '{"agencyId":{"S":"<AGENCY_ID>"}}' \
  --update-expression "SET #t = :v" \
  --expression-attribute-names '{"#t":"triage"}' \
  --expression-attribute-values '{":v":{"M":{"enabled":{"BOOL":true},"nonEmergencyQueueEnabled":{"BOOL":true}}}}'
```

---

## Test Cases (smoke)

```bash
# 1 — queue is empty on fresh agency
GET /api/triage/queue  → 200, { items: [] }

# 2 — mock classify as non-emergency
POST (internal) TriageAnalyzeFunction with incidentId containing 'nonemerge'
→ DDB item written, classification=NON_EMERGENCY

# 3 — dispatcher override
POST /api/triage/override { incidentId }
→ queue item status=ESCALATED, overrideBy set

# 4 — auth: dispatcher cannot GET /api/triage/queue
GET /api/triage/queue with dispatcher JWT → 403

# 5 — feature disabled: function does not exist in stack
ENABLE_NON_EMERGENCY_TRIAGE=false → TriageAnalyzeFunction not deployed
```
