# Rapid Cortex — Feature Roadmap Cursor Prompt
## F6 through F17 · Stepped Implementation Guide

Drop this file in the repo root. Open it in Cursor alongside:
- `dev-staging-phase2.env` (feature flag patterns)
- `apps/api/src/lib/triage/classifier.ts` (Bedrock Converse + mock pattern — THE reference)
- `apps/api/src/lib/sop/` (F4 SOP — the original in-process service pattern)
- `apps/api/src/handlers/triage/triageQueueHttp.ts` (HTTP handler naming convention)
- `packages/shared/src/triage/f3-queue.ts` (shared type pattern)
- `infra/stack-data-layer.yaml` (where DynamoDB tables are defined)
- `infra/template.yaml` + `infra/nested/stack-app-sam.yaml` (wiring pattern)

Work through each step independently. Each step is self-contained and deployable
before the next one begins. Follow all existing RC conventions exactly:
TypeScript, AWS SAM, DynamoDB, `AuthorizationService`, `AuditLogger`,
`isSupervisorOrAdmin`, ENABLE_* / NEXT_PUBLIC_* flag pairs.

---

## TECHNICAL CONTEXT (read before every step)

**Stack:** TypeScript · Next.js (apps/web) · AWS Lambda + SAM (apps/api) ·
DynamoDB · S3 · Cognito · API Gateway HTTP API · Bedrock Converse API

**Monorepo packages:**
- `rapid-cortex-shared` → `packages/shared/src/`
- `rapid-cortex-security` → `packages/security/src/`
- `rapid-cortex-integrations` → `packages/integrations/src/`
- `rapid-cortex-api` → `apps/api/src/`
- `rapid-cortex-web` → `apps/web/src/`

**Roles:** `dispatcher | supervisor | admin | it_admin | staff |
platform_superadmin | analyst | readonly_auditor`

**Auth pattern:** Every HTTP Lambda handler calls
`AuthorizationService.fromEvent(event)` first. Returns `{ ok, agencyId, userId, role }`.
Return 401 if `!auth.ok`. Check `isSupervisorOrAdmin(role)` for elevated routes.

**Audit pattern:** `new AuditLogger(AUDIT_TABLE).log({ agencyId, incidentId,
action: 'feature.action', actorId: userId, actorRole: role, metadata: {} })`

Established audit action names for new features follow the pattern:
`<feature>.<verb>` e.g. `staffing.forecast_generated`, `pattern.detected`,
`prebrief.delivered`, `grants.report_generated`.

---

## ⚠ CRITICAL PATTERN: TWO EXECUTION MODES — READ THIS FIRST

F3 and F4 established two distinct patterns. Every new feature must use the
correct one. Using the wrong pattern will break the build.

---

### Pattern A — IN-PROCESS SERVICE (for features that run during active calls)

**Used by:** F4 SOP (`SopService`), F3 Triage (`TriageService`)
**Canonical reference:** `apps/api/src/lib/triage/` + `TriageService.runAutoIfNeeded()`

Logic lives in a **service class** inside `apps/api/src/lib/<feature>/`.
The service is called directly from `addTranscriptChunk` (or another existing
handler), not as a separate Lambda invocation. The service is gated by:
1. `process.env.ENABLE_<FEATURE> !== 'true'` → return early
2. `agencyConfig?.<feature>?.enabled !== true` → return early
3. Segment count modulo (`DETECT_EVERY_N_SEGMENTS`) → return early

No new Lambda function is created. No async Lambda invocation. The service
runs synchronously within the existing `AddTranscriptChunkFunction` execution.
The service's env vars are added to `AddTranscriptChunkFunction` in SAM.

**Use Pattern A for:** F11 Caller Emotion, F16 Protocol Coaching — features
that analyse transcript data as calls progress.

---

### Pattern B — SEPARATE LAMBDA (for HTTP handlers, scheduled jobs, async work)

**Used by:** `triageQueueHttp.ts`, `triageOverrideQueueHttp.ts`, all HTTP routes
**Canonical reference:** `apps/api/src/handlers/triage/triageQueueHttp.ts`

A dedicated Lambda function with its own SAM resource, triggered by API Gateway
or EventBridge. Used for:
- HTTP GET/PATCH/POST routes that serve UI data
- Scheduled/periodic jobs (EventBridge rules)
- Background async processing that should not block transcript chunk handling

**Use Pattern B for:** F6 Staffing (scheduled + HTTP), F7 Pre-Brief (dispatch
event), F8 Pattern Detection (scheduled + HTTP), F9 Grants (HTTP), F10
Community Portal (HTTP), F12 Radio (HTTP + stream), F13 Address (HTTP),
F14 Mutual Aid (HTTP), F15 Silent 911 (webhook + HTTP), F17 Wellness (HTTP).

---

## INFRA PATTERN — WHERE THINGS LIVE

**DynamoDB tables → `infra/stack-data-layer.yaml`**
All new DynamoDB tables are defined here, NOT in `template.yaml` directly.
Wire them through: `stack-data-layer.yaml` → outputs → `template.yaml`
parameters → `stack-app-sam.yaml` environment variables.

Pattern for a new table:
```yaml
# In stack-data-layer.yaml Resources:
<FeatureName>Table:
  Type: AWS::DynamoDB::Table
  Condition: Has<Feature>
  Properties:
    TableName: !Sub "${DynamoTableNamePrefix}-<feature-name>-${DeploymentStage}"
    BillingMode: !Ref DynamoBillingMode
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: !Ref DynamoPointInTimeRecovery
    SSESpecification:
      SSEEnabled: true
    TimeToLiveSpecification:
      AttributeName: ttl
      Enabled: true
    # ... AttributeDefinitions, KeySchema, GSIs

# In stack-data-layer.yaml Outputs:
<FeatureName>TableName:
  Condition: Has<Feature>
  Value: !Ref <FeatureName>Table

# In template.yaml Parameters (forwarded from data layer stack output):
<FeatureName>TableName:
  Type: String
  Default: ""

# In stack-app-sam.yaml, on the relevant Lambda function Environment.Variables:
<FEATURE>_TABLE: !Ref <FeatureName>TableName
```

**Lambda functions → `infra/nested/stack-app-sam.yaml`**
All new Lambda functions (Pattern B) go in `stack-app-sam.yaml`.
They reference table names via Parameters, not `!GetAtt Table.Arn` directly
(tables live in the data layer stack).

**SAM Condition pattern:**
```yaml
# In both stack-data-layer.yaml and stack-app-sam.yaml Conditions:
Has<Feature>: !Equals [!Ref Enable<Feature>, "true"]
```

---

## AI PATTERN — BEDROCK CONVERSE API

All AI calls use the **Bedrock Converse API**, not `InvokeModelCommand`.
Reference implementation: `apps/api/src/lib/triage/classifier.ts`

```ts
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

const response = await client.send(new ConverseCommand({
  modelId: process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  system: [{ text: systemPrompt }],
  messages: [{ role: 'user', content: [{ text: userPrompt }] }],
  inferenceConfig: { maxTokens: 1024, temperature: 0 },
}));

const text = response.output?.message?.content?.[0]?.text ?? '';
```

**Mock pattern:** Check `process.env.<FEATURE>_MOCK === 'true'` before
constructing the Bedrock client. Return deterministic fixture. Never instantiate
`BedrockRuntimeClient` in mock mode.

**Safety default:** On any Bedrock error or JSON parse failure, return a safe
default (e.g. `UNCERTAIN` for classification, empty result for summarisation).
Never throw. Never crash the parent handler.

---

## FEATURE FLAG PATTERN

```
# dev-staging-phase2.env additions for each feature:
# ENABLE_<FEATURE>=true          → Lambda env var (server-side gate)
# <FEATURE>_MOCK=false           → skip AI, return fixture
# NEXT_PUBLIC_ENABLE_<FEATURE>=1 → web env var (client-side gate)
```

For Pattern A features (in-process), the env vars are added to
`AddTranscriptChunkFunction` in SAM. For Pattern B features (separate Lambda),
the env vars are on the new function's `Environment.Variables`.

**Agency config gate:** Always check agency-level opt-in before running AI
or writing to feature-specific tables:
```ts
const agencyConfig = await loadAgencyConfig(agencyId);
if (!agencyConfig?.<feature>?.enabled) return safeDefault;
```

**SAM Condition:** Every new resource (table, Lambda, EventBridge rule) is
wrapped in `Condition: Has<Feature>` so it only deploys when the flag is on.
Run `sam validate --lint` after every infra change.

---

---

# STEP 1 · F6 · PREDICTIVE STAFFING INTELLIGENCE

**Goal:** Analyze 90 days of agency call volume history against time-of-day,
day-of-week, seasonal trends, and scheduled local events to generate a 7-day
staffing forecast. Surface it to supervisors and directors as a weekly briefing
and a live shift-level alert.

**Buyer:** Shift supervisor, communications director, agency administrator.

**Competitive gap:** No competitor has this. Directly addresses the #1 agency
complaint (chronic understaffing). Creates a compounding data advantage — the
longer RC runs, the more accurate the forecasts.

---

### 1.1 Env vars — add to dev-staging-phase2.env

```
# --- F6 predictive staffing ---
# ENABLE_PREDICTIVE_STAFFING=true
# PREDICTIVE_STAFFING_MOCK=false
# STAFFING_FORECAST_TABLE=<stack-output StaffingForecastTable>
# NEXT_PUBLIC_ENABLE_PREDICTIVE_STAFFING=1
```

Agency config patch:
```json
{ "staffing": { "enabled": true, "forecastDays": 7, "shiftLengthHours": 8 } }
```

---

### 1.2 Files to create

```
packages/shared/src/staffing/
  types.ts
  index.ts

apps/api/src/lib/staffing/
  aggregator.ts        ← query call volume history from DDB, group by hour/day
  forecaster.ts        ← ConverseCommand call (Bedrock Converse API, not InvokeModel)
  prompt.ts            ← system + user prompt builders

apps/api/src/handlers/staffing/
  forecastHttp.ts      ← Lambda: GET+POST /api/staffing/forecast (naming: *Http.ts)

apps/web/src/components/staffing/
  StaffingForecastPanel.tsx   ← 7-day forecast grid with risk bands
  ShiftAlertBadge.tsx         ← inline badge on supervisor dashboard
  useStaffingForecast.ts      ← SWR hook, 1hr refresh
```

### 1.3 Files to modify

| File | Change |
|------|--------|
| `infra/stack-data-layer.yaml` | Add `StaffingForecastTable` + Output |
| `infra/template.yaml` | Add Parameters + Conditions; forward table name to app stack |
| `infra/nested/stack-app-sam.yaml` | Add `StaffingForecastFunction` + `StaffingGenerateSchedule` |
| `apps/web/src/components/supervisor/SupervisorDashboard.tsx` | Mount `<ShiftAlertBadge />` and `<StaffingForecastPanel />` |

---

### 1.4 Shared types — packages/shared/src/staffing/types.ts

```ts
export type RiskLevel = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

export interface HourlyBucket {
  hourOfDay: number;          // 0–23
  dayOfWeek: number;          // 0=Sun … 6=Sat
  avgCallVolume: number;
  p95CallVolume: number;
  sampleCount: number;        // weeks of data used
}

export interface ShiftForecast {
  date: string;               // ISO date YYYY-MM-DD
  shiftStart: number;         // hour 0–23
  shiftEnd: number;
  predictedCallVolume: number;
  confidenceRange: [number, number];  // [low, high]
  recommendedDispatchers: number;
  currentScheduledDispatchers: number | null;
  riskLevel: RiskLevel;
  riskReason: string;
}

export interface WeeklyStaffingForecast {
  agencyId: string;
  generatedAt: string;
  forecastStartDate: string;
  shifts: ShiftForecast[];
  weekSummary: {
    peakRiskShift: ShiftForecast;
    avgRecommended: number;
    criticalShiftCount: number;
    dataQualityNote: string | null;
  };
  modelUsed: string;          // provider name
}
```

---

### 1.5 DynamoDB — StaffingForecastTable

```
PK: agencyId
SK: forecastDate        (ISO date — one forecast record per agency per day)
GSI: none required
TTL: ttl (90 days)
Attributes: all WeeklyStaffingForecast fields marshalled
```

---

### 1.6 API contracts

```
GET  /api/staffing/forecast           → supervisor+ only
     query: ?startDate=YYYY-MM-DD     (default: today)
     response: WeeklyStaffingForecast | null

POST /api/staffing/forecast/generate  → admin only, triggers on-demand generation
     response: { ok: true, jobId: string }
```

---

### 1.7 Aggregator logic — apps/api/src/lib/staffing/aggregator.ts

Query the IncidentsTable for the past `lookbackDays` (default 90) of incidents
for `agencyId`. Group by `hourOfDay` + `dayOfWeek`. Compute `avgCallVolume` and
`p95CallVolume` per bucket. Return `HourlyBucket[]`. Handle sparse data (< 4
weeks) by setting `dataQualityNote`.

---

### 1.8 AI forecaster prompt — apps/api/src/lib/staffing/prompt.ts

**System:** You are a 911 dispatch staffing analyst. Given historical call volume
buckets, generate a 7-day shift-level staffing forecast. For each shift apply
the industry standard of 1 dispatcher per 3–4 simultaneous calls, factoring in
break coverage (add 20%). Return valid JSON only matching `WeeklyStaffingForecast`.

**User:** Include the serialized `HourlyBucket[]` and any known upcoming events
from `agencyConfig.staffing.scheduledEvents[]`.

---

### 1.9 Mock strategy

When `PREDICTIVE_STAFFING_MOCK=true`, `forecaster.ts` returns a hardcoded 7-day
fixture with one `CRITICAL` shift (Friday 18:00–02:00), two `HIGH` shifts, and
the rest `NORMAL`. Do not call the AI provider.

---

### 1.10 SAM additions

Tables go in `stack-data-layer.yaml`. Functions go in `stack-app-sam.yaml`.
Parameters and Conditions go in all three files where referenced.
Run `sam validate --lint` after every change.

**`infra/stack-data-layer.yaml` → Resources:**
```yaml
StaffingForecastTable:
  Type: AWS::DynamoDB::Table
  Condition: HasPredictiveStaffing
  Properties:
    TableName: !Sub "${DynamoTableNamePrefix}-staffing-forecast-${DeploymentStage}"
    BillingMode: !Ref DynamoBillingMode
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: !Ref DynamoPointInTimeRecovery
    SSESpecification: { SSEEnabled: true }
    AttributeDefinitions:
      - { AttributeName: agencyId, AttributeType: S }
      - { AttributeName: forecastDate, AttributeType: S }
    KeySchema:
      - { AttributeName: agencyId, KeyType: HASH }
      - { AttributeName: forecastDate, KeyType: RANGE }
    TimeToLiveSpecification: { AttributeName: ttl, Enabled: true }
```

**`infra/stack-data-layer.yaml` → Outputs:**
```yaml
StaffingForecastTableName:
  Condition: HasPredictiveStaffing
  Value: !Ref StaffingForecastTable
```

**`infra/template.yaml` → Parameters (add):**
```yaml
EnablePredictiveStaffing:
  Type: String
  Default: "false"
  AllowedValues: ["true", "false"]
PredictiveStaffingMock:
  Type: String
  Default: "false"
StaffingForecastTableName:
  Type: String
  Default: ""
```

**`infra/template.yaml` → Conditions (add):**
```yaml
HasPredictiveStaffing: !Equals [!Ref EnablePredictiveStaffing, "true"]
```

**`infra/nested/stack-app-sam.yaml` → Resources:**
```yaml
StaffingForecastFunction:
  Type: AWS::Serverless::Function
  Condition: HasPredictiveStaffing
  Properties:
    FunctionName: !Sub "${AppName}-staffing-forecast-${DeploymentStage}"
    Handler: handlers/staffing/forecastHttp.handler
    Timeout: 15
    MemorySize: 256
    Environment:
      Variables:
        ENABLE_PREDICTIVE_STAFFING: !Ref EnablePredictiveStaffing
        PREDICTIVE_STAFFING_MOCK: !Ref PredictiveStaffingMock
        STAFFING_FORECAST_TABLE: !Ref StaffingForecastTableName
        INCIDENTS_TABLE: !Ref IncidentsTable
        AUDIT_TABLE: !Ref AuditTable
    Events:
      GetForecast:
        Type: HttpApi
        Properties:
          ApiId: !Ref Api
          Path: /api/staffing/forecast
          Method: GET
          Auth: { Authorizer: CognitoJwtAuthorizer }
      GenerateForecast:
        Type: HttpApi
        Properties:
          ApiId: !Ref Api
          Path: /api/staffing/forecast/generate
          Method: POST
          Auth: { Authorizer: CognitoJwtAuthorizer }
    Policies:
      - DynamoDBCrudPolicy: { TableName: !Ref StaffingForecastTableName }
      - DynamoDBReadPolicy:  { TableName: !Ref IncidentsTable }
      - DynamoDBCrudPolicy:  { TableName: !Ref AuditTable }
      - Statement:
          Effect: Allow
          Action: bedrock:InvokeModel
          Resource: "*"

StaffingGenerateSchedule:
  Type: AWS::Events::Rule
  Condition: HasPredictiveStaffing
  Properties:
    ScheduleExpression: "cron(0 2 ? * SUN *)"
    State: ENABLED
    Targets:
      - Arn: !GetAtt StaffingForecastFunction.Arn
        Id: WeeklyStaffingGenerate
        Input: '{"source":"eventbridge","action":"generate"}'
```

**Handler file naming:** `forecastHttp.ts` not `forecast.ts` — follow the
`triageQueueHttp.ts` naming convention for HTTP handlers.

**Bedrock in `forecaster.ts`:** Use `ConverseCommand` not `InvokeModelCommand`.
Reference `apps/api/src/lib/triage/classifier.ts` for the exact client pattern.

---

---

# STEP 2 · F7 · RESPONDER PRE-BRIEF CARD

**Goal:** The moment a call is dispatched, generate a plain-language intelligence
card and push it to the responding unit's MDT. Card includes incident summary,
address history, known hazards, prior incidents at location, and caller-extracted
entities.

**Buyer:** Police chief, fire chief, EMS director — not just the dispatcher.
Opens new procurement conversations.

**Hard rule:** The card is advisory only. The responder reads it; it does not
affect dispatch decisions. Always labelled "AI-GENERATED BRIEF — VERIFY ON SCENE".

---

### 2.1 Env vars

```
# --- F7 responder pre-brief ---
# ENABLE_RESPONDER_PREBRIEF=true
# RESPONDER_PREBRIEF_MOCK=false
# PREBRIEF_DELIVERY_MODE=cad_note   # cad_note | sms | push | all
# NEXT_PUBLIC_ENABLE_RESPONDER_PREBRIEF=1
```

Agency config:
```json
{ "prebrief": { "enabled": true, "deliveryMode": "cad_note", "includePriorIncidentDays": 365 } }
```

---

### 2.2 Files to create

```
packages/shared/src/prebrief/
  types.ts
  index.ts

apps/api/src/lib/prebrief/
  builder.ts          ← assemble context: entities + address history + hazards
  prompt.ts
  deliver.ts          ← write to CAD note field / send SMS / push

apps/api/src/handlers/prebrief/
  generate.ts         ← Lambda: invoked internally on dispatch event
  get.ts              ← Lambda: GET /api/prebrief/{incidentId} (dispatcher+)

apps/web/src/components/prebrief/
  PrebriefCard.tsx    ← read-only card shown in dispatcher console after dispatch
```

---

### 2.3 Shared types

```ts
export interface PrebriefCard {
  incidentId: string;
  agencyId: string;
  generatedAt: string;
  unitIds: string[];                // units this brief was sent to
  headline: string;                 // one-sentence plain English summary
  locationIntel: {
    address: string;
    priorIncidentCount: number;
    priorIncidentSummary: string;
    knownHazards: string[];
    vulnerablePersonsNote: string | null;
  };
  callerEntities: {
    suspectDescription: string | null;
    weaponsNote: string | null;
    injuriesNote: string | null;
    numberOfPersons: string | null;
    callerStatus: string | null;    // "hiding in bathroom", "fled scene", etc.
  };
  warningFlags: string[];           // e.g. "PRIOR ARMED SUSPECT AT THIS ADDRESS"
  disclaimer: string;               // always: "AI-GENERATED BRIEF — VERIFY ON SCENE"
  deliveryStatus: Record<string, 'SENT' | 'FAILED' | 'PENDING'>;
}
```

---

### 2.4 Builder logic — apps/api/src/lib/prebrief/builder.ts

1. Load the current incident's confidence analysis from DDB (FieldConfidence[])
2. Query IncidentsTable for prior incidents at the same address within
   `agencyConfig.prebrief.includePriorIncidentDays`
3. Query a HazardsTable (or premises notes field) for known address flags
4. Pass all context to `completeWithFallback()` with the prebrief prompt
5. Parse response into `PrebriefCard`
6. Write card to DDB PrebriefTable
7. Call `deliver.ts` based on `agencyConfig.prebrief.deliveryMode`

---

### 2.5 API contracts

```
POST /api/prebrief/generate   → internal only (invoked by dispatch handler, not HTTP)
GET  /api/prebrief/{incidentId} → dispatcher+ · returns PrebriefCard or 404
```

---

### 2.6 DynamoDB — PrebriefTable

```
PK: agencyId
SK: incidentId
TTL: ttl (from agency retention policy)
Attributes: full PrebriefCard marshalled
```

---

### 2.7 SAM additions

Follow the same pattern as `StaffingForecastFunction`. Parameter:
`EnableResponderPrebrief`. Condition: `HasResponderPrebrief`. Add IAM for
DynamoDB read on IncidentsTable + CrudPolicy on PrebriefTable + bedrock:InvokeModel.

---

---

# STEP 3 · F8 · INCIDENT PATTERN DETECTION

**Goal:** Continuously analyse the agency's incident history and surface
actionable patterns — repeat locations, repeat callers, linked vehicle
descriptions, surge clusters — to supervisors and analysts without anyone
asking.

**Buyer:** Supervisor, analyst, agency administrator.

**Moat:** The more incidents RC processes, the more valuable this becomes.
Data advantage compounds over time.

---

### 3.1 Env vars

```
# --- F8 incident patterns ---
# ENABLE_INCIDENT_PATTERNS=true
# PATTERN_DETECTION_MOCK=false
# PATTERN_DETECTION_TABLE=<stack-output PatternDetectionTable>
# PATTERN_RUN_SCHEDULE="cron(0 */6 * * ? *)"   # every 6 hours
# NEXT_PUBLIC_ENABLE_INCIDENT_PATTERNS=1
```

Agency config:
```json
{ "patterns": { "enabled": true, "lookbackDays": 90, "minIncidentsToFlag": 3 } }
```

---

### 3.2 Files to create

```
packages/shared/src/patterns/
  types.ts
  index.ts

apps/api/src/lib/patterns/
  detector.ts         ← run pattern queries against IncidentsTable
  classifiers/
    repeat-location.ts
    repeat-caller.ts
    vehicle-link.ts
    surge-cluster.ts
  prompt.ts           ← AI narrative for each detected pattern

apps/api/src/handlers/patterns/
  detect.ts           ← Lambda: scheduled + on-demand
  list.ts             ← Lambda: GET /api/patterns (supervisor+ / analyst)
  dismiss.ts          ← Lambda: PATCH /api/patterns/{patternId}/dismiss

apps/web/src/components/patterns/
  PatternAlertFeed.tsx        ← supervisor dashboard panel
  PatternDetailDrawer.tsx     ← full pattern with incidents listed
  usePatternAlerts.ts         ← SWR hook, 5 min refresh
```

---

### 3.3 Shared types

```ts
export type PatternType =
  | 'REPEAT_LOCATION'
  | 'REPEAT_CALLER'
  | 'VEHICLE_LINK'
  | 'SURGE_CLUSTER'
  | 'TIME_BASED_RISK';

export type PatternSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface DetectedPattern {
  patternId: string;           // uuid
  agencyId: string;
  patternType: PatternType;
  severity: PatternSeverity;
  title: string;               // "Repeat Location: 847 Elm St — 14 incidents in 90 days"
  summary: string;             // AI-generated plain English description
  recommendation: string;      // "Recommend proactive patrol 3–6pm weekdays"
  incidentIds: string[];       // incidents that form this pattern
  supportingData: Record<string, unknown>;  // pattern-specific evidence
  detectedAt: string;
  dismissedAt: string | null;
  dismissedBy: string | null;
  ttl: number;
}
```

---

### 3.4 Classifier logic pattern — apps/api/src/lib/patterns/classifiers/repeat-location.ts

```ts
// Query IncidentsTable with agencyId + date range.
// Group by normalized address (strip apt/unit numbers for matching).
// Flag any address with >= minIncidentsToFlag incidents in lookbackDays.
// For each flagged address, build supportingData: { address, count, incidentTypes, peakHour }.
// Return PatternCandidate[].
```

All four classifiers follow this same query → group → threshold pattern.
Each returns `PatternCandidate[]`. The detector aggregates, deduplicates, calls
the AI prompt for a human-readable summary + recommendation, then writes to DDB.

---

### 3.5 API contracts

```
GET   /api/patterns              → supervisor+ / analyst
      query: ?type=REPEAT_LOCATION&severity=HIGH&limit=20
      response: { patterns: DetectedPattern[], total: number }

PATCH /api/patterns/{patternId}/dismiss → supervisor+
      body: { reason?: string }
      response: { ok: true }
```

---

### 3.6 DynamoDB — PatternDetectionTable

```
PK: agencyId
SK: detectedAt#patternId
GSI: TypeIndex  PK=agencyId SK=patternType   (filter by type)
GSI: SeverityIndex PK=agencyId SK=severity   (filter by severity)
TTL: ttl (30 days)
```

---

---

# STEP 4 · F9 · GRANT INTELLIGENCE MODULE

**Goal:** Analyse an agency's RC data (call volumes, incident types, language
gaps, response times, staffing ratios) and generate pre-filled narrative content
for federal grant applications. One-click draft for common grant programs.

**Buyer:** Agency administrator, grants coordinator, finance director.

**Commercial differentiation:** RC helps agencies fund RC. Unique in the market.

---

### 4.1 Env vars

```
# --- F9 grant intelligence ---
# ENABLE_GRANT_INTELLIGENCE=true
# GRANT_INTELLIGENCE_MOCK=false
# GRANT_REPORTS_BUCKET=<stack-output GrantReportsBucket>
# NEXT_PUBLIC_ENABLE_GRANT_INTELLIGENCE=1
```

Agency config:
```json
{ "grants": { "enabled": true } }
```

---

### 4.2 Files to create

```
packages/shared/src/grants/
  types.ts
  index.ts

apps/api/src/lib/grants/
  data-collector.ts   ← pull agency metrics from IncidentsTable + TranscriptsTable
  prompt.ts
  templates/
    bsir.ts           ← Biennial Submission of State 911 Implementation Report
    psap-mod.ts       ← PSAP Modernization Grant narrative sections
    fy911.ts          ← FY 911 Grant Program sections

apps/api/src/handlers/grants/
  generate.ts         ← Lambda: POST /api/grants/generate (admin only)
  download.ts         ← Lambda: GET /api/grants/{reportId}/download → S3 presigned

apps/web/src/components/grants/
  GrantGeneratorPanel.tsx    ← grant type selector + generate button
  GrantReportHistory.tsx     ← list of prior generated reports with download links
```

---

### 4.3 Shared types

```ts
export type GrantType = 'BSIR' | 'PSAP_MODERNIZATION' | 'FY911' | 'CUSTOM';

export interface AgencyGrantMetrics {
  agencyId: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
  totalCallsHandled: number;
  avgCallHandleTimeSeconds: number;
  languagesServed: string[];
  topLanguages: Array<{ language: string; callCount: number }>;
  nonEmergencyCallPct: number;
  estimatedDispatcherHoursSaved: number;
  avgTranscriptionLatencyMs: number;
  incidentTypeBreakdown: Record<string, number>;
  staffingGapDays: number | null;    // days where recommended > scheduled
}

export interface GrantReport {
  reportId: string;
  agencyId: string;
  grantType: GrantType;
  generatedAt: string;
  generatedBy: string;
  metrics: AgencyGrantMetrics;
  sections: Array<{
    sectionName: string;
    sectionNumber: string;
    narrative: string;            // AI-generated, ready to paste into application
    wordCount: number;
    dataPoints: string[];         // specific numbers cited in narrative
  }>;
  s3Key: string;
  status: 'GENERATING' | 'READY' | 'FAILED';
}
```

---

### 4.4 Data collector — apps/api/src/lib/grants/data-collector.ts

Query IncidentsTable for the specified date range. Aggregate:
- Total incident count, incident type breakdown
- Language distribution from transcript metadata
- Average handle time
- Non-emergency percentage (from triage classifications if F3 is enabled)
- Dispatcher hours saved estimate: `totalIncidents × avgTimeSavedSeconds / 3600`

Return `AgencyGrantMetrics`. This is read-only — no AI call, pure DynamoDB aggregation.

---

### 4.5 Prompt pattern — apps/api/src/lib/grants/prompt.ts

Each grant template defines its required sections and character/word limits.
System prompt instructs the AI to write factual, formal grant narrative using
only the provided metrics (no fabrication). User prompt includes the serialized
`AgencyGrantMetrics` and the specific section being generated.

Generate sections sequentially, not in one call. Each section is one AI call
with its specific guidance. Assemble into `GrantReport`.

---

### 4.6 API contracts

```
POST /api/grants/generate       → admin only
     body: { grantType: GrantType, periodStart: string, periodEnd: string }
     response: { reportId: string, status: 'GENERATING' }

GET  /api/grants                → admin only
     response: { reports: GrantReport[] }

GET  /api/grants/{reportId}/download → admin only
     response: { url: string }  (S3 presigned URL, 15min TTL)
```

---

### 4.7 S3 storage

Store generated reports as PDF or DOCX in an agency-scoped prefix:
`grant-reports/{agencyId}/{reportId}.pdf`

Use the existing `AssetsBucket` or add a `GrantReportsBucket` parameter in SAM.
Enforce server-side encryption (SSE-S3) and block public access.

---

---

# STEP 5 · F10 · COMMUNITY NON-EMERGENCY PORTAL

**Goal:** A public-facing, agency-branded portal where citizens submit
non-emergency reports (noise, parking, property damage, found items) with
optional photo/video, without calling 911 or a non-emergency line. AI
categorizes, routes to the non-emergency queue, and sends the citizen a
status update.

**Buyer:** Agency administrator, city manager, community affairs office.

**Integration:** Feeds directly into the F3 Non-Emergency Queue. Completes
the non-emergency routing loop.

---

### 5.1 Env vars

```
# --- F10 community portal ---
# ENABLE_COMMUNITY_PORTAL=true
# COMMUNITY_PORTAL_MOCK=false
# COMMUNITY_REPORTS_TABLE=<stack-output CommunityReportsTable>
# COMMUNITY_MEDIA_BUCKET=<stack-output CommunityMediaBucket>
# NEXT_PUBLIC_ENABLE_COMMUNITY_PORTAL=1
```

Agency config:
```json
{
  "communityPortal": {
    "enabled": true,
    "brandName": "City of Springfield — Report a Concern",
    "allowedCategories": ["noise", "parking", "propertyDamage", "foundProperty", "other"],
    "mediaUploadEnabled": true,
    "statusNotificationsEnabled": true
  }
}
```

---

### 5.2 Files to create

```
packages/shared/src/community/
  types.ts
  index.ts

apps/api/src/handlers/community/
  submit.ts           ← POST /api/community/report (public, no auth)
  status.ts           ← GET /api/community/report/{trackingId} (public)
  list.ts             ← GET /api/community/reports (dispatcher+ · internal queue)
  update.ts           ← PATCH /api/community/reports/{reportId} (dispatcher+)
  media-upload-url.ts ← GET /api/community/upload-url (public, rate-limited)

apps/web/src/app/(community)/
  [agencySlug]/
    page.tsx           ← public portal landing
    report/page.tsx    ← multi-step report form (no auth required)
    status/[trackingId]/page.tsx ← citizen status tracker
    layout.tsx         ← agency-branded layout (logo, name from agency config)

apps/web/src/components/community/
  ReportForm.tsx       ← step 1: category + description
  LocationStep.tsx     ← step 2: address or map pin
  MediaStep.tsx        ← step 3: optional photo/video upload
  ConfirmStep.tsx      ← step 4: review + submit
  StatusTracker.tsx    ← citizen-facing status view
  CommunityQueuePanel.tsx  ← dispatcher-facing incoming portal reports
```

---

### 5.3 Shared types

```ts
export type CommunityReportStatus =
  | 'SUBMITTED'
  | 'REVIEWING'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED_NO_ACTION';

export type CommunityReportCategory =
  | 'noise' | 'parking' | 'propertyDamage' | 'foundProperty'
  | 'other';

export interface CommunityReport {
  reportId: string;
  trackingId: string;           // short public ID shown to citizen (8 chars)
  agencyId: string;
  agencySlug: string;
  category: CommunityReportCategory;
  description: string;          // max 1000 chars
  address: string | null;
  coordinates: { lat: number; lng: number } | null;
  mediaKeys: string[];          // S3 keys
  submittedAt: string;
  submitterEmail: string | null; // optional for status notifications
  status: CommunityReportStatus;
  statusUpdatedAt: string;
  statusNote: string | null;    // shown to citizen
  assignedTo: string | null;    // dispatcher userId
  aiCategory: string | null;    // AI-refined category label
  aiPriority: 'P2' | 'P3' | null;
  linkedToNonEmergencyQueueSk: string | null;  // if routed to F3 queue
  ttl: number;
}
```

---

### 5.4 Submit handler — apps/api/src/handlers/community/submit.ts

This route is **public** (no Cognito auth). Apply:
- Agency rate limiting: max 10 submissions per IP per hour (use DynamoDB counter)
- Input validation: description max 1000 chars, category must be in allowed list
- reCAPTCHA token validation if `agencyConfig.communityPortal.recaptchaEnabled`
- After writing to DDB: invoke AI categorizer (classify + assign priority)
- If `nonEmergencyQueueEnabled`: write to F3 NonEmergencyQueueTable as PENDING
- If `statusNotificationsEnabled` + email provided: send confirmation via SES

---

### 5.5 API contracts

```
POST /api/community/report              → public (no auth), rate-limited per IP
     body: { agencySlug, category, description, address?, coordinates?,
             submitterEmail? }
     response: { trackingId: string, estimatedResponseHours: number }

GET  /api/community/report/{trackingId} → public
     response: { status, statusNote, updatedAt }

GET  /api/community/upload-url          → public, rate-limited
     query: ?agencySlug=&fileType=image/jpeg
     response: { uploadUrl: string, s3Key: string, expiresIn: 300 }

GET  /api/community/reports             → dispatcher+ (internal)
     query: ?status=SUBMITTED&limit=50
     response: { reports: CommunityReport[] }

PATCH /api/community/reports/{reportId} → dispatcher+
     body: { status, statusNote?, assignedTo? }
     response: { ok: true }
```

---

### 5.6 Public routing — apps/web

Agency portal lives at `/[agencySlug]` — a public Next.js route. The
`agencySlug` maps to an `agencyId` via a lightweight lookup table or a GSI
on the AgenciesTable. No Cognito session required for submit or status routes.
Apply `next/headers` rate limiting and input sanitization.

---

---

# STEP 6 · F11 · CALLER EMOTIONAL INTELLIGENCE

**Goal:** Analyse caller voice patterns (stress level, speech rate, silence
duration, physiological indicators) in real time, separate from transcript
content. Flag calls where vocal patterns suggest extreme distress, cognitive
decline, or possible medical event independent of what the caller says.

**Hard rule:** Emotional scores are advisory only. Never labelled as "lie
detection". Always flagged as "VOICE STRESS INDICATOR — VERIFY WITH CALLER".
Requires explicit agency opt-in.

---

### 6.1 Env vars

```
# --- F11 caller emotional intelligence ---
# ENABLE_CALLER_EMOTION=true
# CALLER_EMOTION_MOCK=false
# EMOTION_DETECT_EVERY_N_SEGMENTS=3   # more frequent than triage
# NEXT_PUBLIC_ENABLE_CALLER_EMOTION=1
```

Agency config:
```json
{
  "callerEmotion": {
    "enabled": true,
    "flagThreshold": 75,
    "medicalFlagEnabled": true
  }
}
```

---

### 6.2 Files to create

```
packages/shared/src/emotion/
  types.ts
  index.ts

apps/api/src/lib/emotion/
  analyzer.ts         ← analyse audio features from transcript metadata
  scorer.ts           ← call AI with acoustic + linguistic signals
  prompt.ts

apps/api/src/handlers/emotion/
  analyze.ts          ← Lambda: internal, invoked from segment-added handler

apps/web/src/components/emotion/
  EmotionIndicator.tsx       ← subtle live indicator in dispatcher workspace
  EmotionAlertBanner.tsx     ← shown when flag threshold exceeded
```

---

### 6.3 Shared types

```ts
export type EmotionFlag = 'EXTREME_STRESS' | 'POSSIBLE_MEDICAL' | 'COGNITIVE_DECLINE' | 'CALM';

export interface EmotionAnalysis {
  incidentId: string;
  agencyId: string;
  analysisAt: string;
  segmentCount: number;
  stressScore: number;            // 0–100
  speechRateWordsPerMin: number | null;
  silencePct: number | null;      // % of audio that is silence
  primaryFlag: EmotionFlag;
  flags: EmotionFlag[];
  suggestedDispatcherAction: string | null;
  // e.g. "Ask caller to take a breath and confirm their location"
  // or "Caller may be experiencing medical event — consider EMS dispatch"
  confidence: number;
  disclaimer: string;             // always rendered with the result
}
```

---

### 6.4 Implementation note

The emotional analysis operates on transcript **metadata** (word timings,
segment durations, pause lengths) rather than raw audio — avoiding the need
to re-process audio through a separate pipeline. The transcript provider
(Transcribe / Azure / Whisper) returns word-level timing data that RC already
captures. Use these timing signals as inputs to the AI analysis alongside
the transcript text itself.

The prompt instructs the AI to reason about: words per minute, pause frequency,
sentence completeness, lexical choices under stress, and any explicit distress
language — and to return a scored, flagged `EmotionAnalysis`.

---

---

# STEP 7 · F12 · RADIO INTELLIGENCE

**Goal:** Transcribe and synthesise radio channel traffic alongside 911 calls.
Flag unexpected unit silence, surface critical transmissions, and present a
unified radio + phone picture in the supervisor dashboard.

**Buyer:** Supervisor, communications director, incident commander.

**Moat:** Extends RC from phone intake into the full communications environment.
Dramatically increases switching cost once deployed.

---

### 7.1 Env vars

```
# --- F12 radio intelligence ---
# ENABLE_RADIO_INTELLIGENCE=true
# RADIO_INTELLIGENCE_MOCK=false
# RADIO_CHANNELS_TABLE=<stack-output RadioChannelsTable>
# RADIO_TRANSCRIPTION_PROVIDER=transcribe   # transcribe | azure | whisper
# RADIO_SILENCE_THRESHOLD_SECONDS=120       # flag unit silent for > 2 min
# NEXT_PUBLIC_ENABLE_RADIO_INTELLIGENCE=1
```

Agency config:
```json
{
  "radio": {
    "enabled": true,
    "channels": [
      { "channelId": "ch1", "label": "Police Primary", "unitIds": ["UNIT-1","UNIT-2"] },
      { "channelId": "ch2", "label": "Fire/EMS", "unitIds": ["ENG-1","MED-3"] }
    ],
    "silenceThresholdSeconds": 120
  }
}
```

---

### 7.2 Files to create

```
packages/shared/src/radio/
  types.ts
  index.ts

apps/api/src/lib/radio/
  transcriber.ts      ← submit audio chunks to transcription provider
  silence-detector.ts ← track last heard timestamp per unit, emit silence events
  synthesizer.ts      ← AI: summarise multi-channel radio activity
  prompt.ts

apps/api/src/handlers/radio/
  ingest.ts           ← Lambda: POST /api/radio/ingest (internal, from radio bridge)
  status.ts           ← Lambda: GET /api/radio/status (supervisor+)
  channels.ts         ← Lambda: GET/POST /api/radio/channels (admin)

apps/web/src/components/radio/
  RadioChannelPanel.tsx       ← live channel grid with last transmission
  RadioSilenceAlert.tsx       ← badge when unit unexpectedly silent
  RadioSynthesisCard.tsx      ← AI-generated multi-channel summary
  useRadioStatus.ts           ← WebSocket or SWR polling hook
```

---

### 7.3 Shared types

```ts
export interface RadioChannel {
  channelId: string;
  agencyId: string;
  label: string;
  unitIds: string[];
  isActive: boolean;
  lastTransmissionAt: string | null;
  lastTransmissionText: string | null;
  silenceAlertActive: boolean;
}

export interface RadioTransmission {
  transmissionId: string;
  agencyId: string;
  channelId: string;
  unitId: string | null;
  recordedAt: string;
  durationMs: number;
  transcript: string;
  isFlagged: boolean;           // critical keyword detected
  flagReason: string | null;
}

export interface RadioSynthesis {
  agencyId: string;
  synthesisAt: string;
  windowMinutes: number;        // e.g. last 10 minutes
  channelSummaries: Array<{
    channelId: string;
    label: string;
    summary: string;
    criticalTransmissions: string[];
    silentUnits: string[];
  }>;
  overallSituation: string;     // cross-channel AI narrative
}
```

---

### 7.4 Key implementation note

Radio audio ingestion requires a "radio bridge" component — a local or
cloud agent at the agency that captures radio audio and streams it to the
RC API. In the first version, support two ingest modes:

1. **File upload**: agency uploads recorded audio chunks via `/api/radio/ingest`
   (usable immediately, no special hardware)
2. **Streaming**: future WebSocket stream (architect the ingest handler to
   support both; implement file mode first)

The radio bridge itself is out of scope for this step — define the ingest API
contract precisely so a third-party bridge can be built against it.

---

---

# STEP 8 · F13 · SMART ADDRESS INTELLIGENCE

**Goal:** When a location appears in an active call, automatically surface a
contextual address card: prior incident count + types, known hazards, vulnerable
persons flags, premise notes from prior dispatchers, and security camera presence.

**Buyer:** Dispatcher (reduces lookup time), supervisor (improves situational
awareness during call).

---

### 8.1 Env vars

```
# --- F13 smart address intelligence ---
# ENABLE_SMART_ADDRESS=true
# SMART_ADDRESS_MOCK=false
# PREMISES_TABLE=<stack-output PremisesTable>
# NEXT_PUBLIC_ENABLE_SMART_ADDRESS=1
```

Agency config:
```json
{ "smartAddress": { "enabled": true, "priorIncidentLookbackDays": 365 } }
```

---

### 8.2 Files to create

```
packages/shared/src/address/
  types.ts
  index.ts

apps/api/src/lib/address/
  normalizer.ts       ← strip apt/unit, standardise format for matching
  lookup.ts           ← query IncidentsTable + PremisesTable by normalised address

apps/api/src/handlers/address/
  intel.ts            ← Lambda: GET /api/address/intel?q=<address>&agencyId=
  premises.ts         ← Lambda: GET/PUT /api/address/premises/{addressHash} (dispatcher+)

apps/web/src/components/address/
  AddressIntelCard.tsx        ← slides into view when location extracted
  PremisesNoteEditor.tsx      ← dispatcher adds/edits notes for this address
  HazardFlagList.tsx          ← read-only list of known hazards
  useAddressIntel.ts          ← triggered by confidence analysis location update
```

---

### 8.3 Shared types

```ts
export interface PremisesRecord {
  addressHash: string;          // SHA-256 of normalised address — PK
  agencyId: string;
  normalizedAddress: string;
  displayAddress: string;
  hazards: string[];            // "gas shutoff inside", "aggressive dog", "lead paint"
  vulnerablePersons: Array<{
    description: string;        // "Elderly resident, mobility impaired" — no PII by default
    addedAt: string;
    addedBy: string;
  }>;
  cameraPresent: boolean;
  cameraNotes: string | null;
  dispatcherNotes: Array<{
    note: string;
    addedAt: string;
    addedBy: string;
  }>;
  lastUpdatedAt: string;
}

export interface AddressIntelResult {
  addressHash: string;
  normalizedAddress: string;
  premises: PremisesRecord | null;
  priorIncidents: {
    total: number;
    last90Days: number;
    typeBreakdown: Record<string, number>;
    mostRecentAt: string | null;
    mostRecentType: string | null;
  };
  warningFlags: string[];       // surfaced prominently in UI
}
```

---

### 8.4 DynamoDB — PremisesTable

```
PK: agencyId
SK: addressHash        (SHA-256 of normalised address string)
Attributes: full PremisesRecord
No TTL — premises records are long-lived
```

---

### 8.5 Auto-trigger

When the confidence analysis fires and `fields.location.score >= 60` and
`fields.location.value` is non-null, the confidence handler automatically
triggers an address intel lookup. The result is stored in the incident record
and pushed to the dispatcher via the existing WebSocket event bus as event
type `ADDRESS_INTEL_READY`.

---

---

# STEP 9 · F14 · MUTUAL AID COORDINATION

**Goal:** When an incident exceeds local resource capacity, enable commanders
to request and accept mutual aid from neighbouring RC-connected agencies through
a structured workflow — replacing ad-hoc phone calls during major events.

**Buyer:** Incident commander, communications director, emergency manager.

**Network effect:** Every additional RC agency in a region increases the value
of RC for all neighbouring agencies. Classic network moat.

---

### 9.1 Env vars

```
# --- F14 mutual aid ---
# ENABLE_MUTUAL_AID=true
# MUTUAL_AID_TABLE=<stack-output MutualAidTable>
# NEXT_PUBLIC_ENABLE_MUTUAL_AID=1
```

Agency config:
```json
{
  "mutualAid": {
    "enabled": true,
    "neighbourAgencyIds": ["agency-456", "agency-789"],
    "autoShareIncidentPacket": true
  }
}
```

---

### 9.2 Files to create

```
packages/shared/src/mutual-aid/
  types.ts
  index.ts

apps/api/src/handlers/mutual-aid/
  request.ts          ← Lambda: POST /api/mutual-aid/request (supervisor+)
  respond.ts          ← Lambda: POST /api/mutual-aid/respond (supervisor+ receiving agency)
  list.ts             ← Lambda: GET /api/mutual-aid (supervisor+)
  packet.ts           ← Lambda: GET /api/mutual-aid/{requestId}/packet

apps/web/src/components/mutual-aid/
  MutualAidPanel.tsx          ← war room component: request + status board
  MutualAidRequestModal.tsx   ← form: resource type, quantity, urgency
  MutualAidIncomingAlert.tsx  ← receiving agency notification
  useMutualAidStatus.ts       ← SWR + WebSocket
```

---

### 9.3 Shared types

```ts
export type MutualAidStatus =
  | 'REQUESTED' | 'ACKNOWLEDGED' | 'ACCEPTED' | 'DECLINED' | 'EN_ROUTE' | 'ON_SCENE' | 'CLOSED';

export type ResourceType = 'DISPATCHER' | 'POLICE_UNIT' | 'FIRE_UNIT' | 'EMS_UNIT' | 'COMMAND_STAFF';

export interface MutualAidRequest {
  requestId: string;
  requestingAgencyId: string;
  receivingAgencyId: string;
  incidentId: string;
  status: MutualAidStatus;
  resourceType: ResourceType;
  quantityRequested: number;
  quantityCommitted: number | null;
  urgency: 'IMMEDIATE' | 'URGENT' | 'ROUTINE';
  incidentSummary: string;      // plain-text brief for receiving agency
  incidentPacketS3Key: string | null;  // full incident packet if shared
  requestedAt: string;
  respondedAt: string | null;
  respondedBy: string | null;
  declineReason: string | null;
  estimatedArrival: string | null;
  closedAt: string | null;
  auditLog: Array<{ action: string; actorId: string; at: string; note?: string }>;
}
```

---

### 9.4 Security note

Mutual aid requests cross agency boundaries. The receiving agency Lambda must
verify that the requesting agency is in the receiving agency's
`mutualAid.neighbourAgencyIds` list before exposing any incident data.
Never expose full incident records without explicit opt-in from both agencies.
Incident packet sharing (`autoShareIncidentPacket`) must be explicitly enabled.

---

---

# STEP 10 · F15 · SILENT 911 / TEXT-TO-911 INTELLIGENCE

**Goal:** Full AI-powered text-based emergency intake for callers who cannot
speak — hostage situations, domestic violence, hearing-impaired callers.
Same intelligence layer as voice calls: entity extraction, confidence scoring,
triage classification. Legally required in many states (FCC text-to-911 mandate).

---

### 10.1 Env vars

```
# --- F15 text-to-911 ---
# ENABLE_TEXT_911=true
# TEXT_911_MOCK=false
# TEXT_911_TABLE=<stack-output Text911Table>
# TEXT_911_INBOUND_NUMBER=<Twilio/AWS SMS number>
# NEXT_PUBLIC_ENABLE_TEXT_911=1
```

Agency config:
```json
{ "text911": { "enabled": true, "silentModeEnabled": true } }
```

---

### 10.2 Files to create

```
packages/shared/src/text911/
  types.ts
  index.ts

apps/api/src/lib/text911/
  session.ts          ← manage SMS conversation state
  responder.ts        ← AI: generate next question / response in text conversation
  prompt.ts

apps/api/src/handlers/text911/
  inbound.ts          ← Lambda: POST /api/text911/inbound (Twilio/SNS webhook, no auth)
  session-list.ts     ← Lambda: GET /api/text911/sessions (dispatcher+)
  session-detail.ts   ← Lambda: GET /api/text911/sessions/{sessionId}

apps/web/src/components/text911/
  Text911QueuePanel.tsx      ← active text sessions, listed for dispatcher
  Text911ConversationView.tsx ← message thread + dispatcher reply box
  SilentCallerBadge.tsx      ← indicator on active call list
```

---

### 10.3 Shared types

```ts
export type Text911SessionStatus = 'ACTIVE' | 'CLAIMED' | 'DISPATCHED' | 'CLOSED';

export interface Text911Message {
  messageId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  sentAt: string;
  sentBy: string | null;     // null = AI, userId = dispatcher
}

export interface Text911Session {
  sessionId: string;
  agencyId: string;
  callerPhone: string;       // hashed/masked in UI unless supervisor
  status: Text911SessionStatus;
  startedAt: string;
  messages: Text911Message[];
  aiExtractedEntities: Record<string, string>;   // same shape as ConfidenceAnalysis fields
  triageClassification: string | null;
  linkedIncidentId: string | null;
  claimedBy: string | null;
  ttl: number;
}
```

---

### 10.4 Conversation AI pattern

On each inbound message, the AI receives the full conversation history and
produces the next outbound message. The system prompt instructs the AI to:
1. Extract any new entities (location, incident type, etc.) from the message
2. Determine the single most important piece of missing critical information
3. Ask for that information in plain, calm language
4. If the caller indicates they cannot safely respond, switch to yes/no question mode
5. If location is captured and incident type is known, output `[READY_FOR_DISPATCH]`

When `[READY_FOR_DISPATCH]` is detected, alert the dispatcher via WebSocket
and pre-populate the dispatch form with extracted entities.

---

---

# STEP 11 · F16 · AUTOMATED PROTOCOL COMPLIANCE COACHING

**Goal:** During an active call, track whether the dispatcher is following the
agency's configured EMD/EFD/EPD protocol. Surface gentle real-time prompts when
a protocol step appears to have been missed. NOT punitive — coaching aid, not
surveillance.

**Hard rule:** Coaching prompts are never logged as violations unless explicitly
reviewed and confirmed by a supervisor in the QA workflow.

---

### 11.1 Env vars

```
# --- F16 protocol compliance coaching ---
# ENABLE_PROTOCOL_COACHING=true
# PROTOCOL_COACHING_MOCK=false
# PROTOCOL_CHECK_EVERY_N_SEGMENTS=4
# NEXT_PUBLIC_ENABLE_PROTOCOL_COACHING=1
```

Agency config:
```json
{
  "protocolCoaching": {
    "enabled": true,
    "protocols": {
      "MEDICAL": { "s3Key": "agency-protocols/agency-id/emd.json" },
      "FIRE":    { "s3Key": "agency-protocols/agency-id/efd.json" },
      "POLICE":  { "s3Key": "agency-protocols/agency-id/epd.json" }
    }
  }
}
```

---

### 11.2 Files to create

```
packages/shared/src/protocol/
  types.ts
  index.ts

apps/api/src/lib/protocol/
  loader.ts           ← fetch protocol JSON from S3, cache in memory
  checker.ts          ← call AI with transcript + protocol, check step completion
  prompt.ts

apps/api/src/handlers/protocol/
  check.ts            ← Lambda: internal, invoked from segment-added handler
  upload.ts           ← Lambda: PUT /api/protocol/upload (admin) → S3 presigned

apps/web/src/components/protocol/
  ProtocolCoachCard.tsx      ← non-intrusive prompt card in dispatcher workspace
  ProtocolProgressBar.tsx    ← visual step tracker (collapsed by default)
  ProtocolUploadPanel.tsx    ← admin UI for uploading protocol files
```

---

### 11.3 Shared types

```ts
export interface ProtocolStep {
  stepId: string;
  stepNumber: number;
  description: string;
  requiredFor: string[];     // incident types this step applies to
  isRequired: boolean;
  keyPhrases: string[];      // phrases that indicate step was completed
}

export interface ProtocolCheckResult {
  incidentId: string;
  agencyId: string;
  checkedAt: string;
  incidentType: string;
  completedSteps: string[];      // stepIds
  missedSteps: string[];         // stepIds — surfaced as coaching prompts
  nextSuggestedStep: ProtocolStep | null;
  coachingMessage: string | null;
  overallCompletionPct: number;
}
```

---

### 11.4 Protocol file format — S3 JSON

```json
{
  "protocolName": "Emergency Medical Dispatch",
  "incidentTypes": ["MEDICAL", "CARDIAC", "BREATHING"],
  "steps": [
    {
      "stepId": "emd-1",
      "stepNumber": 1,
      "description": "Confirm exact address",
      "isRequired": true,
      "keyPhrases": ["what is the address", "where are you", "confirm your address"]
    }
  ]
}
```

---

---

# STEP 12 · F17 · DISPATCHER WELLNESS MONITOR

**Note:** Feature flag F5 (`ENABLE_DISPATCHER_WELLNESS`) already exists in
`dev-staging-phase2.env` and the agency config schema references
`wellness.keywords`. This step implements the full feature against that scaffold.

**Goal:** Monitor internal dispatcher communications (not caller audio) for
language patterns indicating burnout, trauma response, or crisis. Route welfare
check recommendations to supervisors. Protect dispatcher mental health.

**Hard rule:** Monitors ONLY dispatcher-typed notes, chat, and internal messages.
NEVER analyses caller audio or content for dispatcher wellness. Never surfaces
raw messages to supervisors — only a flag and a recommended check-in.

---

### 12.1 Env vars

Already in `dev-staging-phase2.env`:
```
# ENABLE_DISPATCHER_WELLNESS=true
# TRAUMA_FLAGS_TABLE=<stack-output TraumaFlagsTable>
# NEXT_PUBLIC_ENABLE_DISPATCHER_WELLNESS=1
```

Extend with:
```
# WELLNESS_MOCK=false
# WELLNESS_SUPERVISOR_NOTIFICATION_MODE=dashboard   # dashboard | email | both
```

Agency config (already defined):
```json
{ "wellness": { "enabled": true, "keywords": ["i can't do this", "panic attack"] } }
```

---

### 12.2 Files to create

```
packages/shared/src/wellness/
  types.ts
  index.ts

apps/api/src/lib/wellness/
  scanner.ts          ← scan dispatcher notes/chat for agency keywords + AI patterns
  scorer.ts           ← AI: assess wellness signal strength, recommend action
  notifier.ts         ← alert supervisor (dashboard event / SES email)
  prompt.ts

apps/api/src/handlers/wellness/
  scan.ts             ← Lambda: internal, triggered on dispatcher note save
  flags-list.ts       ← Lambda: GET /api/wellness/flags (supervisor only)
  acknowledge.ts      ← Lambda: POST /api/wellness/flags/{flagId}/acknowledge
  dismiss.ts          ← Lambda: POST /api/wellness/flags/{flagId}/dismiss

apps/web/src/components/wellness/
  WellnessFlagPanel.tsx      ← supervisor-only panel (sensitive, gated)
  WellnessFlagCard.tsx       ← flag card: dispatcher initials, signal type, recommended action
  WellnessAcknowledgeModal.tsx  ← supervisor records check-in outcome
```

---

### 12.3 Shared types

```ts
export type WellnessSignalType =
  | 'KEYWORD_MATCH'
  | 'PATTERN_BURNOUT'
  | 'PATTERN_TRAUMA'
  | 'PATTERN_CRISIS'
  | 'CALL_LOAD_SPIKE';   // unusually high consecutive difficult calls

export type WellnessRecommendation =
  | 'WELFARE_CHECK'
  | 'BREAK_SUGGESTED'
  | 'SUPERVISOR_CONVERSATION'
  | 'EAP_REFERRAL';

export interface WellnessFlag {
  flagId: string;
  agencyId: string;
  dispatcherId: string;       // anonymised in UI — show initials + role only
  signalType: WellnessSignalType;
  recommendation: WellnessRecommendation;
  signalStrength: number;     // 0–100
  triggerNote: string;        // what triggered it (agency keywords found, not full text)
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgeNote: string | null;   // outcome of check-in
  dismissedAt: string | null;
  dismissedBy: string | null;
  status: 'PENDING' | 'ACKNOWLEDGED' | 'DISMISSED';
  ttl: number;
}
```

---

### 12.4 Privacy constraints — enforce in code

1. `scanner.ts` receives only dispatcher-authored text (QA notes, chat messages,
   incident notes). Never receives call audio, transcript content, or caller data.
2. `WellnessFlagCard.tsx` shows dispatcher initials + role only. Never full name.
   Full name visible only to `platform_superadmin`.
3. The triggering text is never stored in DDB — only the signal type and
   matched keyword categories.
4. Supervisors see the recommendation, not the raw message. This is enforced
   at the API layer: `flags-list.ts` strips `triggerText` from the response
   for all roles below `platform_superadmin`.
5. All wellness flag access is logged via `AuditLogger`.

---

---

# DEPLOYMENT ORDER

Work through steps in this order. Each step is independently deployable.

```
Step 1  F6  Predictive Staffing        ← highest immediate value, new buyer
Step 2  F7  Responder Pre-Brief        ← new buyer (chiefs), low infra cost
Step 3  F8  Incident Pattern Detection ← data flywheel, supervisors love it
Step 4  F9  Grant Intelligence         ← unique commercial differentiator
Step 5  F10 Community Portal           ← completes non-emergency routing loop
Step 6  F11 Caller Emotion             ← technically complex, high novelty
Step 7  F12 Radio Intelligence         ← requires radio bridge partnership
Step 8  F13 Smart Address              ← dispatcher QOL, fast to build
Step 9  F14 Mutual Aid                 ← requires multi-agency network
Step 10 F15 Silent 911 / Text          ← legal requirement in many states
Step 11 F16 Protocol Coaching          ← requires agency protocol files
Step 12 F17 Dispatcher Wellness        ← F5 scaffold already exists, finish it
```

---

# CONVENTIONS REMINDER FOR CURSOR

## Service classes (Pattern A — in-process, called from addTranscriptChunk)

Reference: `apps/api/src/lib/triage/classifier.ts`, `TriageService.runAutoIfNeeded()`

1. Live in `apps/api/src/lib/<feature>/`
2. Export a service class with a `runAutoIfNeeded(params)` method
3. Gate on `process.env.ENABLE_<FEATURE> !== 'true'` → return `null` early
4. Gate on `agencyConfig?.<feature>?.enabled !== true` → return `null` early
5. Gate on segment count modulo: `if (segmentCount % N !== 0) return null`
6. Check `process.env.<FEATURE>_MOCK === 'true'` before any Bedrock call
7. Use `ConverseCommand` from `@aws-sdk/client-bedrock-runtime` — NOT `InvokeModelCommand`
8. On any Bedrock/parse error: log, return safe default, never throw
9. Write results to DDB and call `AuditLogger.log()` with established action name
10. Env vars for the service go on `AddTranscriptChunkFunction` in SAM

## HTTP Lambda handlers (Pattern B — separate function)

Reference: `apps/api/src/handlers/triage/triageQueueHttp.ts`

Naming: `<featureName>Http.ts` for HTTP handlers.

1. Call `AuthorizationService.fromEvent(event)` first — return 401 if `!auth.ok`
2. Check `process.env.ENABLE_<FEATURE> !== 'true'` → return 404
3. Check role with `isSupervisorOrAdmin(role)` for elevated routes → return 403
4. Call `AuditLogger.log()` for every write operation
5. Return `{ ok: true }` / `{ error: string }` JSON consistently
6. Export `handler` as a named export — never default export
7. Never call Bedrock directly from an HTTP handler — delegate to service/lib
8. Always wrap in try/catch — return 500 with error message, never crash

## Infra (tables + functions)

1. **Tables → `infra/stack-data-layer.yaml`** with output → template.yaml
   parameter → stack-app-sam.yaml env var wiring
2. **Lambda functions → `infra/nested/stack-app-sam.yaml`**
3. Every resource wrapped in `Condition: Has<Feature>`
4. All tables: `SSEEnabled: true`, TTL attribute, `PK=agencyId` for tenancy
5. Run `sam validate --lint` after every infra change — it must pass

## React components

Reference: `apps/web/src/components/triage/NonEmergencyQueuePanel.tsx`,
`TriageBadge.tsx`, `useTriagePolling.ts`

1. Check `process.env.NEXT_PUBLIC_ENABLE_<FEATURE>` at the mount point
2. Use RC dark theme tokens: bg `#07090e`, surface `#0b1118`, border `#182334`
3. Loading state · error state · empty state — all three required
4. Never use HTML `<form>` tags — use `onClick` handlers on buttons
5. SWR polling: follow `useTriagePolling.ts` pattern (10s refresh, revalidateOnFocus)
6. Role-gate at the parent that mounts the component, not inside the component
7. Proxy routes under `apps/web/src/app/api/<feature>/route.ts`

## Shared types

Reference: `packages/shared/src/triage/f3-queue.ts`

1. All new feature types go in `packages/shared/src/<feature>/`
2. Export a barrel from `<feature>/index.ts`
3. Export from `packages/shared/src/index.ts`
4. Use Zod schemas for API input validation where the feature already uses Zod
5. Keep types framework-agnostic — no React or AWS SDK imports in shared
