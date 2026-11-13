# NexCortIQ Call Assist — Nova 2 Sonic Upgrade & 311 Platform Cursor Prompt

## Context and Constraints

**AWS Account:** `158961537080` — nexcortiq-prod Intelligence Layer  
**DO NOT** touch account `991260941851` (CAD/RMS). These accounts must remain isolated.  
**DO NOT** modify: the CAD Next.js app, CAD DynamoDB tables, CAD AppSync schema, ANI/ALI receiver, or the Cognito pool `us-east-1_0z6tA6WBs` (those belong to the CAD account).

**Current Call Assist Stack (account 158961537080):**
- Amazon Connect (telephony, contact flows, queue routing)
- Amazon Lex V2 (STT + NLU, intent recognition)
- Amazon Bedrock (Claude/Nova — LLM reasoning for response generation)
- Amazon Polly (TTS — neural voice synthesis)
- Status: lab-only, no live agency deployments
- Location: `apps/call-assist/` in this repo

---

## ASSISTANT IDENTITY

The AI assistant's name is **Nexiq**.

**Pronunciation:**
- Pronounced "NEX-ik" — two syllables, emphasis on the first.
- Never "Nex-I-Q" (do not spell out letters).
- Never "Nex-iq" as three syllables.

**Opening greeting — live (short):**
> "City non-emergency line. I'm Nexiq — how can I help?"

**Opening greeting — full greenfield:**
> "Thank you for calling the city's non-emergency line. I'm Nexiq, your AI assistant. How can I help you today?"

Use the **live (short)** opener for all calls on the current stack. The full opener is reserved for the post-cutover greenfield launch.

**Identity rules:**
- Nexiq introduces itself by name on every call, immediately after the greeting.
- If a caller asks "What is your name?" or "Who am I speaking to?", Nexiq responds: "I'm Nexiq, your AI assistant for city services."
- Nexiq never claims to be a human, never claims to be a 911 operator.
- Nexiq refers to itself as "I" (first person), never "the system" or "the assistant."
- The name Nexiq must appear in the system prompt stored at SSM, in every Nova 2 Sonic promptStart event, and in the Lex bot response Lambda for the Lex/Polly fallback path.

**Multilingual identity:**
- Spanish: "Soy Nexiq, su asistente de IA para servicios municipales."
- Portuguese: "Sou o Nexiq, seu assistente de IA para serviços municipais."

---

**Nova Sonic Version Note:**  
The original Amazon Nova Sonic (`amazon.nova-sonic-v1:0`) reached end-of-service on **September 14, 2026**.  
This prompt targets **Amazon Nova 2 Sonic**, model ID `amazon.nova-2-5-sonic`, via Bedrock on-demand inference.  
Do not use `amazon.nova-sonic-v2:0` — that model string does not match the deployed stack.  
Do not attempt to invoke `amazon.nova-sonic-v1:0` — that endpoint no longer exists.

**Accepted Architecture (ADR-001):**  
The following are locked decisions. Future Cursor sessions must build against these values, not against earlier spec descriptions in this file.

| Dimension | ADR-001 Value |
|---|---|
| Voice gateway | Shared Nova gateway, port `:8080` |
| Model ID | `amazon.nova-2-5-sonic` |
| Audio sample rate | 16 kHz |
| Session state | Single DynamoDB table |
| Number prefix | `RC-` |
| 311 tools | Lex-based (not Nova Sonic tool-use blocks) |
| Fallback | Connect contact attribute (`VoiceEngine`) drives Lex/Polly path |
| Nexiq opener | Short live opener (see Identity section) |

**Operational status as of ADR-001:**
- ✅ Lex/Polly path: GO (live)
- 🔴 Full greenfield (Nova gateway + new tables + SMS DID): NO-GO

**Three required cutovers before full greenfield launch:**
1. SMS DID provisioning — Call Assist production DID (this is NOT `+13198358230`)
2. TTL enable — run `scripts/enable-call-assist-table-ttl.sh` (irreversible; opt-in only)
3. Connect queue bind

**Unit test baseline:** 67 shared Call Assist unit tests passing. All new code must maintain this count.


**This prompt is a targeted upgrade, not a rewrite.** Every existing:
- Dashboard component and layout
- Pricing configuration and entitlement flags
- Permission/RBAC definitions
- Emergency escalation safeguards
- CJIS gating logic
- Connect instance configuration and phone number assignments
- Lex bot intent taxonomy

…must be preserved. You are adding capabilities on top of what exists.

---

## PART 1 — AUDIT: Read Before Writing Any Code

Before writing a single line of new code, audit the existing implementation. Read the following and create a file `AUDIT.md` at `apps/call-assist/AUDIT.md` documenting what currently exists:

### 1.1 — Audit Checklist

Read every file under `apps/call-assist/` and document:

**Contact Flow Architecture**
- [ ] How many Amazon Connect contact flows exist?
- [ ] Which flows use Lex V2 bot invocation blocks?
- [ ] Are there separate flows for non-emergency vs. 311 vs. emergency detection?
- [ ] Is there a fallback/error handling path in each flow?
- [ ] Are contact attributes being set for downstream Lambda use?

**Lex Bot Inventory**
- [ ] What is the bot ID and alias ID for each Lex V2 bot in this account?
- [ ] What intents are defined? (List every intent name and sample utterances)
- [ ] Are slot types custom or built-in?
- [ ] Is there a fallback intent? What does it do?
- [ ] Are there session attributes being passed?

**Lambda Function Inventory**
- [ ] List every Lambda function under `apps/call-assist/`
- [ ] What triggers each (Connect, Lex, EventBridge, API Gateway)?
- [ ] Which functions call Bedrock? Which model? What prompt templates?
- [ ] Which functions call Polly? Neural voice? SSML support?
- [ ] Are there any functions with cold start sensitivity?

**Bedrock Configuration**
- [ ] What model(s) are currently invoked?
- [ ] Are prompt templates stored in code or in a config/DB table?
- [ ] Is there a `cjisAiAuthorized` gate on **every Lambda that calls Bedrock**?  
      This is zero-tolerance. Any Lambda that invokes Bedrock with call content (transcripts, session data, caller info)  
      MUST check `agency.cjisAiAuthorized === true` before the invocation.  
      If false → skip Bedrock entirely. Write `summary: null` to the session record. Do not throw.  
      If the gate is missing on any Bedrock-calling Lambda → flag as LAUNCH BLOCKER.
- [ ] What is the system prompt for non-emergency call handling?
- [ ] Is there an agency knowledge base (Bedrock Knowledge Base or DynamoDB config)?

**Database / State**
- [ ] Is there a DynamoDB table for call sessions? What attributes?
- [ ] Is call metadata being written anywhere for dashboard display?
- [ ] Is there an `agencies` table or config record in this account? (Different from CAD account)
- [ ] What data persists across a call vs. in-session only?

**Dashboard**
- [ ] What UI components exist under `apps/call-assist/src/` or `apps/call-assist/ui/`?
- [ ] Is there a supervisor dashboard showing active calls?
- [ ] Is there a call history or transcript view?
- [ ] Is there a 311 service request tracker?
- [ ] Is there a knowledge base editor for agency staff?

**Emergency Safeguards**
- [ ] What keywords trigger emergency detection?
- [ ] What is the escalation path (transfer to Connect queue? SMS alert? Both)?
- [ ] Is there a supervisor notification on escalation?
- [ ] Document every emergency safeguard as-found — none may be weakened.

**DID Isolation (critical):**  
`+13198358230` is the **Pre-Arrival iQ** DID — it belongs to the CAD-event-driven caller engagement module.  
It is NOT a Call Assist DID and must NEVER be assigned to, referenced in, or treated as a Call Assist phone number.  
Call Assist has its own DID (provisioning pending — see NO-GO cutover #1).  
Flag any code or config that references `+13198358230` within `apps/call-assist/` as a cross-module contamination bug.

**Gaps vs. Target Architecture**
After auditing, populate `AUDIT.md` with a "Gap Analysis" section comparing current state to each competitor capability:

| Capability | Aurelian | GovWorx | Polimorphic | CivicPlus | SoundHound | NexCortIQ Current | NexCortIQ Target |
|---|---|---|---|---|---|---|---|
| Streaming voice (barge-in) | ✓ | — | — | — | ✓ | ✗ | Nova 2 Sonic |
| Automated call summary/QA | ✓ | ✓ (CommsCoach) | — | — | — | ✗ | Bedrock post-call |
| Structured CAD-ready intake | ✓ | — | — | — | — | partial | Full schema |
| 311 service request creation | — | — | ✓ | ✓ | — | ✗ | SR flow |
| Department routing | — | — | ✓ | ✓ | — | ✗ | DynamoDB routing |
| Work order status updates | — | — | — | ✓ | — | ✗ | Outbound SMS |
| Multilingual support | — | — | — | — | ✓ | ✗ | Translate + Nova |
| Resident status lookup | — | — | ✓ | ✓ | — | ✗ | Knowledge base |
| Interruption handling | — | — | — | — | ✓ | ✗ | Nova Sonic |
| Conversation quality scoring | — | ✓ | — | — | — | ✗ | Bedrock scoring |

---

## PART 2 — SCHEMA: Database Migrations for New Capabilities

**Important:** Call Assist runs in account `158961537080`. If a DynamoDB table for agencies/config already exists in this account, add GSIs and attributes to it. If it does not exist, create `call-assist-agencies` as a new table — do NOT reference or connect to the CAD account's PostgreSQL Aurora or DynamoDB tables.

### 2.1 — DynamoDB: `call-assist-agencies` table

```typescript
// If table doesn't exist, create via CDK/CloudFormation at:
// infra/call-assist/dynamodb.yaml

// Table: call-assist-agencies
// PK: agencyId (string)
// Attributes to add (or verify exist):
{
  agencyId: string,                    // PK
  agencyName: string,
  
  // Voice engine config (NEW)
  voiceEngine: 'NOVA_SONIC' | 'LEX_POLLY',  // per-agency engine selection
  novaSonicEnabled: boolean,           // default false until validated
  novaSonicVoiceId: string,           // e.g. "matthew" (Nova Sonic voice)
  novaSonicLanguage: string,           // default "en-US"
  novaSonicFallbackToLex: boolean,    // always true during transition period
  
  // 311 capabilities (NEW)
  threeOneOneEnabled: boolean,         // default false
  threeOneOneDepartments: string[],   // ["Public Works", "Parks", "Utilities"]
  threeOneOneWorkOrderIntegration: string | null,  // "CITYWORKS" | "SALESFORCE" | null
  threeOneOneStatusSmsEnabled: boolean,
  threeOneOneOutboundPhoneNumber: string | null,  // Connect outbound number for SMS
  
  // Knowledge base (NEW)
  knowledgeBaseId: string | null,     // Bedrock Knowledge Base ID for this agency
  knowledgeBaseS3Prefix: string | null,  // s3://nexcortiq-call-assist-kb/{agencyId}/
  
  // Multilingual (NEW)
  multilingualEnabled: boolean,
  supportedLanguages: string[],       // ["en-US", "es-US", "pt-BR"]
  defaultLanguage: string,
  
  // CJIS + compliance (EXISTING — verify or add)
  cjisAiAuthorized: boolean,  // ZERO-TOLERANCE: false → Bedrock MUST NOT be called; write summary=null
  
  // Call quality (NEW)
  callQualityScoringEnabled: boolean,
  
  // Existing fields — preserve whatever is here
}
```

### 2.2 — DynamoDB: `call-assist-sessions` table

```typescript
// Table: call-assist-sessions
// PK: sessionId (string, Connect contactId)
// SK: agencyId (string)
// TTL: 90 days

{
  sessionId: string,          // Connect contactId
  agencyId: string,
  callStartedAt: string,      // ISO 8601
  callEndedAt: string | null,
  callType: 'NON_EMERGENCY' | 'THREE_ONE_ONE' | 'TRANSFERRED_911',
  
  // Voice engine used
  voiceEngineUsed: 'NOVA_SONIC' | 'LEX_POLLY',
  
  // Caller info (collected during call)
  callerPhone: string | null,
  callerName: string | null,
  callerAddress: string | null,
  callerLanguage: string | null,
  
  // Resolution
  resolution: 'SELF_SERVICE' | 'SERVICE_REQUEST_CREATED' | 'TRANSFERRED_HUMAN' | 'TRANSFERRED_911' | 'ABANDONED',
  transferredAt: string | null,
  transferReason: string | null,
  
  // 311 service request (if applicable)
  serviceRequestId: string | null,
  serviceRequestType: string | null,
  serviceRequestDepartment: string | null,
  
  // Quality scoring (NEW)
  qualityScore: number | null,          // 0-100
  qualityScoreSummary: string | null,   // Bedrock-generated, only if cjisAiAuthorized
  
  // Transcript (NEW)
  transcriptAvailable: boolean,
  transcriptS3Key: string | null,       // s3://nexcortiq-call-assist-transcripts/{agencyId}/{sessionId}.json
  
  // Emergency detection
  emergencyDetected: boolean,
  emergencyKeywordsMatched: string[],
  emergencyEscalatedAt: string | null,
}
```

### 2.3 — DynamoDB: `call-assist-service-requests` table (NEW)

```typescript
// Table: call-assist-service-requests
// PK: serviceRequestId (string, generated UUID)
// GSI1: agencyId-createdAt-index (for dashboard listing)
// GSI2: callerPhone-index (for status lookup by caller)

{
  serviceRequestId: string,
  agencyId: string,
  sessionId: string,               // Connect contactId that created this SR
  
  createdAt: string,               // ISO 8601
  updatedAt: string,
  
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED',
  
  // Request details
  requestType: string,             // "Pothole", "Street Light Outage", "Abandoned Vehicle", etc.
  department: string,              // owning department
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
  
  // Location
  address: string,
  latitude: number | null,
  longitude: number | null,
  
  // Caller
  callerName: string | null,
  callerPhone: string | null,
  callerEmail: string | null,
  
  // Description
  description: string,             // AI-structured from call transcript
  
  // Status updates
  statusHistory: Array<{
    status: string,
    note: string,
    updatedAt: string,
    updatedBy: string,
  }>,
  
  // External integration
  externalSystemId: string | null,     // CityWorks WO number, Salesforce case ID, etc.
  externalSystemType: string | null,
  
  // Notifications
  smsNotificationsSent: number,        // count
  lastSmsSentAt: string | null,
}
```

---

## PART 3 — NOVA 2 SONIC STREAMING VOICE ENGINE

This is the core architectural upgrade. Amazon Nova 2 Sonic is a speech-to-speech model accessed via Amazon Bedrock's `InvokeModelWithBidirectionalStream` API. It accepts raw PCM audio input and returns synthesized audio output — eliminating the Lex STT → Bedrock LLM → Polly TTS pipeline latency and enabling natural interruption handling.

**Model:** `amazon.nova-2-5-sonic` · **Inference type:** on-demand (no provisioned throughput setup required) · **Predecessor:** `amazon.nova-sonic-v1:0` reached end-of-service September 14, 2026.

### 3.1 — Architecture: Connect → Nova Sonic Bridge

**ADR-001 Architecture Note:**  
The per-call ECS Fargate bridge on port `:9001` described below is the **full greenfield target** — it is NOT the current live architecture.  
The live production architecture uses the **shared Nova gateway on port `:8080`**.  
Build against `:8080` for any work on the currently deployed stack.  
The ECS per-call bridge pattern below remains the target spec for the full greenfield launch after the three required cutovers are complete.

Amazon Connect does not have native Nova Sonic integration. The bridge pattern:

```
Inbound Call → Amazon Connect (telephony)
  → Contact Flow: Check voiceEngine flag for agency
  → If NOVA_SONIC: Invoke Lambda "nova-sonic-session-init"
      → Lambda starts ECS Fargate task: nova-sonic-bridge
      → Lambda sets Connect contact attribute: BRIDGE_ENDPOINT = {taskIP}:9001
      → Contact flow transfers call media stream to bridge via Connect streaming API
  → If LEX_POLLY: Existing Lex bot invocation (unchanged)
  → Both paths converge at resolution: agent queue transfer OR self-service end
```

### 3.2 — ECS Fargate Task: `nova-sonic-bridge`

Create `apps/call-assist/src/nova-sonic/bridge/index.ts`:

```typescript
/**
 * nova-sonic-bridge — ECS Fargate task (1 per active call using Nova Sonic)
 * 
 * Lifecycle:
 *   - Started per-call by Lambda nova-sonic-session-init
 *   - Receives PCM audio from Connect via WebSocket on port 9001
 *   - Streams audio to Bedrock Nova Sonic (bidirectional stream)
 *   - Streams Nova Sonic audio response back to Connect
 *   - Monitors for emergency keywords in transcribed turns
 *   - Publishes session events to EventBridge on resolution
 *   - Terminates when Connect ends the call
 * 
 * Environment variables injected at RunTask:
 *   AGENCY_ID, SESSION_ID, VOICE_ID, LANGUAGE, SYSTEM_PROMPT_SSM_PATH,
 *   KNOWLEDGE_BASE_ID, THREE_ONE_ONE_ENABLED, EMERGENCY_KEYWORDS_JSON
 */

import { WebSocketServer } from 'ws';
import {
  BedrockRuntimeClient,
} from '@aws-sdk/client-bedrock-runtime';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const BEDROCK_REGION = 'us-east-1';
const PORT = 9001;

// Nova 2 Sonic — on-demand inference (original v1 ended service 2026-09-14)
// Model ID confirmed by Jeff Coleman 2026-10-26
const NOVA_SONIC_MODEL_ID = 'amazon.nova-2-5-sonic';

interface BridgeConfig {
  agencyId: string;
  sessionId: string;
  voiceId: string;
  language: string;
  systemPrompt: string;
  knowledgeBaseId: string | null;
  threeOneOneEnabled: boolean;
  emergencyKeywords: string[];
}

async function loadConfig(): Promise<BridgeConfig> {
  const ssm = new SSMClient({ region: BEDROCK_REGION });
  const systemPromptParam = await ssm.send(new GetParameterCommand({
    Name: process.env.SYSTEM_PROMPT_SSM_PATH!,
    WithDecryption: false,
  }));

  return {
    agencyId: process.env.AGENCY_ID!,
    sessionId: process.env.SESSION_ID!,
    voiceId: process.env.VOICE_ID || 'matthew',
    language: process.env.LANGUAGE || 'en-US',
    systemPrompt: systemPromptParam.Parameter?.Value || defaultSystemPrompt(),
    knowledgeBaseId: process.env.KNOWLEDGE_BASE_ID || null,
    threeOneOneEnabled: process.env.THREE_ONE_ONE_ENABLED === 'true',
    emergencyKeywords: JSON.parse(process.env.EMERGENCY_KEYWORDS_JSON || '[]'),
  };
}

function defaultSystemPrompt(): string {
  return `Your name is Nexiq (pronounced "NEX-ik"). You are an AI assistant for city non-emergency services.

Your opening greeting on every call is:
"Thank you for calling the city's non-emergency line. I'm Nexiq, your AI assistant. How can I help you today?"

If a caller asks your name, say: "I'm Nexiq, your AI assistant for city services."
Never claim to be human. Never claim to be a 911 operator. Refer to yourself as "I," not "the system."

Your responsibilities:
1. Understand the caller's request clearly and completely.
2. Provide accurate information about city services.
3. Create service requests for issues that need department action.
4. Transfer immediately to a live agent if the caller requests it or seems distressed.
5. ALWAYS transfer to emergency services if you detect any life-safety emergency.

You are NOT a 911 dispatcher. If you hear anything involving immediate danger to life, fire, medical emergency, or violent crime, say: "I'm transferring you to emergency services now" and trigger an emergency transfer immediately.

Keep responses concise and natural. Do not use numbered lists verbally. Speak conversationally.`;
}

// Emergency keyword check — runs on every Nova Sonic text turn received
function checkEmergencyKeywords(text: string, keywords: string[]): string | null {
  const normalized = text.toLowerCase();
  return keywords.find(kw => normalized.includes(kw.toLowerCase())) || null;
}

async function run() {
  const config = await loadConfig();
  const bedrock = new BedrockRuntimeClient({ region: BEDROCK_REGION });
  const eventBridge = new EventBridgeClient({ region: BEDROCK_REGION });
  const dynamo = DynamoDBDocumentClient.from(
    new (require('@aws-sdk/client-dynamodb').DynamoDBClient)({ region: BEDROCK_REGION })
  );

  // Write initial session record
  await dynamo.send(new PutCommand({
    TableName: 'call-assist-sessions',
    Item: {
      sessionId: config.sessionId,
      agencyId: config.agencyId,
      callStartedAt: new Date().toISOString(),
      voiceEngineUsed: 'NOVA_SONIC',
      emergencyDetected: false,
      emergencyKeywordsMatched: [],
    },
  }));

  const wss = new WebSocketServer({ port: PORT });
  console.log(`[nova-sonic-bridge] Listening on port ${PORT} for session ${config.sessionId}`);

  wss.on('connection', (connectSocket) => {
    console.log(`[nova-sonic-bridge] Connect media stream connected`);
    
    let novaStream: AsyncGenerator<any, void, unknown> | null = null;
    let turnTranscript = '';
    let resolution: string | null = null;

    // Start Nova Sonic bidirectional stream
    // NOTE: The exact API shape for InvokeModelWithBidirectionalStream may differ
    // from standard InvokeModel. Check the Nova Sonic developer guide and adjust
    // the request shape, content-type, and audio chunk format accordingly.
    // The pattern below follows the Bedrock streaming conversation API with audio modality.
    const startNovaSonicStream = async () => {
      try {
        // Build the initial session event for Nova Sonic
        // Nova Sonic accepts: systemPrompt, voiceId, conversationHistory
        const sessionStartEvent = {
          event: {
            sessionStart: {
              inferenceConfiguration: {
                maxTokens: 1024,
                topP: 0.9,
                temperature: 0.7,
              },
            },
          },
        };

        const promptStartEvent = {
          event: {
            promptStart: {
              promptName: `nexcortiq-${config.agencyId}`,
              textOutputConfiguration: { mediaType: 'text/plain' },
              audioOutputConfiguration: {
                mediaType: 'audio/lpcm',
                sampleRateHertz: 16000,  // 16kHz — Nova 2 Sonic native; Connect media stream resampled at ingest
                sampleSizeBits: 16,
                channelCount: 1,
                voiceId: config.voiceId,
                encoding: 'base64',
              },
              systemPrompt: {
                text: config.systemPrompt,
              },
              toolUseConfiguration: config.threeOneOneEnabled
                ? { tools: buildNovaSonicTools(config) }
                : undefined,
            },
          },
        };

        // @ts-ignore — bidirectional stream API; adjust types per SDK version
        const response = await bedrock.send(
          new (require('@aws-sdk/client-bedrock-runtime').InvokeModelWithBidirectionalStreamCommand)({
            modelId: NOVA_SONIC_MODEL_ID,
            body: JSON.stringify(sessionStartEvent),
          })
        );

        // Process Nova Sonic output stream
        for await (const chunk of response.body) {
          if (chunk.chunk?.bytes) {
            const event = JSON.parse(Buffer.from(chunk.chunk.bytes).toString());

            // Audio response — forward to Connect
            if (event.event?.audioOutput?.content) {
              const audioBuffer = Buffer.from(event.event.audioOutput.content, 'base64');
              if (connectSocket.readyState === connectSocket.OPEN) {
                connectSocket.send(audioBuffer);
              }
            }

            // Text turn — check for emergency keywords and tool calls
            if (event.event?.textOutput?.content) {
              turnTranscript += event.event.textOutput.content;
            }

            // End of turn — process transcript
            if (event.event?.contentBlockStop || event.event?.textOutput?.stopReason) {
              if (turnTranscript) {
                const matchedKeyword = checkEmergencyKeywords(turnTranscript, config.emergencyKeywords);
                if (matchedKeyword) {
                  console.log(`[EMERGENCY] Keyword detected: ${matchedKeyword}`);
                  await handleEmergencyEscalation(config, matchedKeyword, dynamo, eventBridge);
                  resolution = 'TRANSFERRED_911';
                  connectSocket.close();
                }
              }
              turnTranscript = '';
            }

            // Tool use — handle 311 service request creation
            if (event.event?.toolUse) {
              await handleToolUse(event.event.toolUse, config, dynamo, eventBridge);
            }

            // Session end
            if (event.event?.sessionEnd) {
              console.log(`[nova-sonic-bridge] Session ended by Nova Sonic`);
            }
          }
        }
      } catch (err) {
        console.error(`[nova-sonic-bridge] Nova Sonic stream error:`, err);
        // On Nova Sonic failure, signal Connect to fall back to Lex
        await eventBridge.send(new PutEventsCommand({
          Entries: [{
            Source: 'nexcortiq.call-assist',
            DetailType: 'NovaSonicFallback',
            Detail: JSON.stringify({
              sessionId: config.sessionId,
              agencyId: config.agencyId,
              reason: (err as Error).message,
            }),
            EventBusName: 'nexcortiq-call-assist',
          }],
        }));
      }
    };

    startNovaSonicStream();

    // Receive PCM audio from Connect and forward to Nova Sonic input stream
    connectSocket.on('message', (data: Buffer) => {
      // Forward PCM to Nova Sonic input
      // The exact mechanism depends on whether Nova Sonic accepts streaming input
      // via a separate WebSocket or via the bidirectional stream's input side.
      // Consult Nova Sonic documentation for the correct ingest pattern.
      // This is a placeholder for the audio ingest pipe.
    });

    connectSocket.on('close', async () => {
      console.log(`[nova-sonic-bridge] Connect disconnected`);
      // Finalize session record
      await dynamo.send(new UpdateCommand({
        TableName: 'call-assist-sessions',
        Key: { sessionId: config.sessionId, agencyId: config.agencyId },
        UpdateExpression: 'SET callEndedAt = :t, #res = :r',
        ExpressionAttributeNames: { '#res': 'resolution' },
        ExpressionAttributeValues: {
          ':t': new Date().toISOString(),
          ':r': resolution || 'SELF_SERVICE',
        },
      }));
      process.exit(0);
    });
  });
}

/**
 * ADR-001: 311 service request intents are handled by Lex V2 (Lex/Polly path).
 * These Nova Sonic tool specs are for the full greenfield launch (post-cutover).
 * On the current live stack, 311 is routed through the existing Lex bot.
 * Do not wire Nova Sonic tool-use for 311 until the greenfield cutovers are complete.
 */
function buildNovaSonicTools(config: BridgeConfig) {
  return [
    {
      toolSpec: {
        name: 'create_service_request',
        description: 'Create a 311 service request for a non-emergency municipal issue reported by the caller.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              requestType: { type: 'string', description: 'Type of service request (e.g., Pothole, Street Light, Abandoned Vehicle)' },
              address: { type: 'string', description: 'Location address of the issue' },
              description: { type: 'string', description: 'Brief description of the issue' },
              priority: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'] },
              callerName: { type: 'string' },
              callerPhone: { type: 'string' },
            },
            required: ['requestType', 'address', 'description'],
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'lookup_service_request_status',
        description: 'Look up the status of an existing 311 service request by phone number or request ID.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              callerPhone: { type: 'string' },
              serviceRequestId: { type: 'string' },
            },
          },
        },
      },
    },
    {
      toolSpec: {
        name: 'transfer_to_department',
        description: 'Transfer the caller to a specific city department.',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              department: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['department'],
          },
        },
      },
    },
  ];
}

async function handleEmergencyEscalation(
  config: BridgeConfig,
  keyword: string,
  dynamo: any,
  eventBridge: EventBridgeClient,
) {
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'nexcortiq.call-assist',
      DetailType: 'EmergencyEscalation',
      Detail: JSON.stringify({
        sessionId: config.sessionId,
        agencyId: config.agencyId,
        keyword,
        escalatedAt: new Date().toISOString(),
      }),
      EventBusName: 'nexcortiq-call-assist',
    }],
  }));

  await dynamo.send(new UpdateCommand({
    TableName: 'call-assist-sessions',
    Key: { sessionId: config.sessionId, agencyId: config.agencyId },
    UpdateExpression: 'SET emergencyDetected = :t, emergencyKeywordsMatched = list_append(emergencyKeywordsMatched, :k), emergencyEscalatedAt = :ts',
    ExpressionAttributeValues: {
      ':t': true,
      ':k': [keyword],
      ':ts': new Date().toISOString(),
    },
  }));
}

async function handleToolUse(toolUse: any, config: BridgeConfig, dynamo: any, eventBridge: EventBridgeClient) {
  // Route tool calls from Nova Sonic to the appropriate handler
  switch (toolUse.name) {
    case 'create_service_request':
      await createServiceRequest(toolUse.input, config, dynamo, eventBridge);
      break;
    case 'lookup_service_request_status':
      // Return status — mechanism depends on Nova Sonic tool result injection API
      break;
    case 'transfer_to_department':
      await eventBridge.send(new PutEventsCommand({
        Entries: [{
          Source: 'nexcortiq.call-assist',
          DetailType: 'DepartmentTransfer',
          Detail: JSON.stringify({
            sessionId: config.sessionId,
            agencyId: config.agencyId,
            department: toolUse.input.department,
            reason: toolUse.input.reason,
          }),
          EventBusName: 'nexcortiq-call-assist',
        }],
      }));
      break;
  }
}

async function createServiceRequest(
  input: any,
  config: BridgeConfig,
  dynamo: any,
  eventBridge: EventBridgeClient,
) {
  const { randomUUID } = require('crypto');
  const srId = `RC-${config.agencyId.toUpperCase().slice(0, 4)}-${Date.now()}`;
  
  await dynamo.send(new PutCommand({
    TableName: 'call-assist-service-requests',
    Item: {
      serviceRequestId: srId,
      agencyId: config.agencyId,
      sessionId: config.sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'OPEN',
      requestType: input.requestType,
      department: resolveDepartment(input.requestType),
      priority: input.priority || 'NORMAL',
      address: input.address,
      latitude: null,
      longitude: null,
      callerName: input.callerName || null,
      callerPhone: input.callerPhone || null,
      callerEmail: null,
      description: input.description,
      statusHistory: [{
        status: 'OPEN',
        note: 'Created via AI-assisted call',
        updatedAt: new Date().toISOString(),
        updatedBy: 'NOVA_SONIC',
      }],
      externalSystemId: null,
      externalSystemType: null,
      smsNotificationsSent: 0,
      lastSmsSentAt: null,
    },
  }));

  // Publish for dashboard real-time update
  await eventBridge.send(new PutEventsCommand({
    Entries: [{
      Source: 'nexcortiq.call-assist',
      DetailType: 'ServiceRequestCreated',
      Detail: JSON.stringify({
        serviceRequestId: srId,
        agencyId: config.agencyId,
        sessionId: config.sessionId,
        requestType: input.requestType,
        address: input.address,
      }),
      EventBusName: 'nexcortiq-call-assist',
    }],
  }));

  console.log(`[nova-sonic-bridge] Service request created: ${srId}`);
  return srId;
}

function resolveDepartment(requestType: string): string {
  const map: Record<string, string> = {
    'Pothole': 'Public Works',
    'Street Light': 'Public Works',
    'Traffic Signal': 'Public Works',
    'Abandoned Vehicle': 'Parking Enforcement',
    'Graffiti': 'Code Enforcement',
    'Trash': 'Sanitation',
    'Water Leak': 'Utilities',
    'Sewer': 'Utilities',
    'Park': 'Parks & Recreation',
    'Noise': 'Code Enforcement',
    'Animal': 'Animal Services',
  };
  return Object.entries(map).find(([k]) =>
    requestType.toLowerCase().includes(k.toLowerCase())
  )?.[1] || 'General Services';
}

run().catch(console.error);
```

### 3.3 — Lambda: `nova-sonic-session-init`

Create `apps/call-assist/src/nova-sonic/session-init/handler.ts`:

```typescript
/**
 * Invoked by Amazon Connect contact flow to start a Nova Sonic bridge task.
 * Returns the bridge endpoint for the contact flow to use.
 * Falls back gracefully if ECS task start fails.
 */
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ecs = new ECSClient({ region: 'us-east-1' });

export const handler = async (event: any) => {
  const agencyId = event.Details?.Parameters?.AgencyId;
  const sessionId = event.Details?.ContactId;

  if (!agencyId || !sessionId) {
    console.error('[session-init] Missing AgencyId or ContactId');
    return { voiceEngine: 'LEX_POLLY', reason: 'missing_params' };
  }

  // Load agency config
  const dynamo = DynamoDBDocumentClient.from(
    new (require('@aws-sdk/client-dynamodb').DynamoDBClient)({})
  );
  const { Item: agency } = await dynamo.send(new GetCommand({
    TableName: 'call-assist-agencies',
    Key: { agencyId },
  }));

  if (!agency?.novaSonicEnabled) {
    return { voiceEngine: 'LEX_POLLY', reason: 'not_enabled' };
  }

  try {
    const taskResult = await ecs.send(new RunTaskCommand({
      cluster: process.env.ECS_CLUSTER_ARN!,
      taskDefinition: process.env.NOVA_SONIC_TASK_DEF_ARN!,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: process.env.ECS_SUBNETS!.split(','),
          securityGroups: [process.env.ECS_SECURITY_GROUP!],
          assignPublicIp: 'DISABLED',
        },
      },
      overrides: {
        containerOverrides: [{
          name: 'nova-sonic-bridge',
          environment: [
            { name: 'AGENCY_ID', value: agencyId },
            { name: 'SESSION_ID', value: sessionId },
            { name: 'VOICE_ID', value: agency.novaSonicVoiceId || 'matthew' },
            { name: 'LANGUAGE', value: agency.novaSonicLanguage || 'en-US' },
            { name: 'SYSTEM_PROMPT_SSM_PATH', value: `/nexcortiq/call-assist/${agencyId}/system-prompt` },
            { name: 'KNOWLEDGE_BASE_ID', value: agency.knowledgeBaseId || '' },
            { name: 'THREE_ONE_ONE_ENABLED', value: String(agency.threeOneOneEnabled || false) },
            {
              name: 'EMERGENCY_KEYWORDS_JSON',
              value: JSON.stringify(getEmergencyKeywords()),
            },
          ],
        }],
      },
    }));

    const task = taskResult.tasks?.[0];
    if (!task) throw new Error('No task returned');

    // Private IP of the task (available after task reaches RUNNING state)
    // Connect contact flow must poll or use a brief wait before connecting
    const taskArn = task.taskArn;

    // Store task ARN for cleanup
    await dynamo.send(new (require('@aws-sdk/lib-dynamodb').PutCommand)({
      TableName: 'call-assist-sessions',
      Item: {
        sessionId,
        agencyId,
        taskArn,
        voiceEngineUsed: 'NOVA_SONIC',
        callStartedAt: new Date().toISOString(),
        emergencyDetected: false,
        emergencyKeywordsMatched: [],
      },
    }));

    return {
      voiceEngine: 'NOVA_SONIC',
      taskArn,
      status: 'STARTING',
    };
  } catch (err) {
    console.error('[session-init] Failed to start ECS task, falling back to Lex:', err);
    return {
      voiceEngine: 'LEX_POLLY',
      reason: 'ecs_start_failed',
      error: (err as Error).message,
    };
  }
};

// ADR-001: Spanish emergency phrases ('fuego', 'disparos', 'necesito ayuda') added.
// All emergency keyword detection is case-insensitive (normalized in checkEmergencyKeywords).
function getEmergencyKeywords(): string[] {
  return [
    'help me', 'call 911', 'emergency', 'fire', 'shooting', 'stabbing',
    'can\'t breathe', 'not breathing', 'heart attack', 'chest pain',
    'unconscious', 'overdose', 'dying', 'he has a gun', 'she has a gun',
    'bomb', 'explosion', 'flood', 'gas leak', 'carbon monoxide',
    // Spanish emergency phrases (ADR-001 additive)
    'fuego',           // fire
    'disparos',        // shots fired
    'necesito ayuda',  // I need help
  ];
}
```

### 3.4 — EventBridge Rule: Nova Sonic Fallback Handler

Create `apps/call-assist/src/nova-sonic/fallback-handler/handler.ts`:

```typescript
/**
 * Triggered by NovaSonicFallback EventBridge event.
 * Updates session record and notifies dashboard that call fell back to Lex.
 * Connect contact flow independently handles the fallback via the voiceEngine attribute.
 */
export const handler = async (event: any) => {
  const { sessionId, agencyId, reason } = event.detail;
  console.warn(`[fallback-handler] Session ${sessionId} falling back to Lex. Reason: ${reason}`);
  
  // Update session record
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  
  await dynamo.send(new UpdateCommand({
    TableName: 'call-assist-sessions',
    Key: { sessionId, agencyId },
    UpdateExpression: 'SET voiceEngineUsed = :v, fallbackReason = :r',
    ExpressionAttributeValues: { ':v': 'LEX_POLLY', ':r': reason },
  }));
};
```

---

## PART 4 — EXISTING CONNECT FLOW UPGRADES

**Do not delete or modify existing contact flows.** Create new flows or add branches to existing ones.

### 4.1 — Add Nova Sonic Branch to Existing Non-Emergency Flow

In the existing Connect contact flow for non-emergency handling, add a branch **before** the Lex bot invocation block:

```
[Entry] → [Set Logging Behavior] → [Invoke Lambda: get-agency-config]
  → [Check Contact Attribute: VoiceEngine]
    → If NOVA_SONIC:
        → [Invoke Lambda: nova-sonic-session-init]
        → [Wait / Loop: Check task RUNNING (up to 5s, 5 iterations)]
        → [Start Media Streaming to task private IP:9001]
        → [On stream end] → [Check Contact Attribute: Resolution]
            → TRANSFERRED_911 → [Transfer to 911 queue]
            → DEPARTMENT_TRANSFER → [Transfer to appropriate queue]
            → SELF_SERVICE → [Play confirmation, disconnect]
        → [On stream error] → [Set Attribute: VoiceEngine=LEX_POLLY] → fall through to Lex
    → If LEX_POLLY (or fallback):
        → [Existing Lex bot invocation — UNCHANGED]
```

### 4.2 — Preserve ALL Existing Emergency Safeguards

Do not modify, weaken, or remove:
- Any existing `Check Contact Attributes` block that routes to emergency
- Any existing Lambda that detects emergency and transfers to a 911 queue
- Any existing supervisor notification Lambda
- The existing emergency keyword list in Lex (it remains active for Lex path)

Nova Sonic bridge has its own emergency detection (Part 3). Both paths must be independently capable of emergency escalation.

---

## PART 5 — 311 SERVICE REQUEST CAPABILITIES

### 5.1 — Lambda: `create-service-request`

Create `apps/call-assist/src/service-requests/create/handler.ts`:

```typescript
/**
 * Also callable directly from the Lex bot path via Lambda code hook,
 * for agencies using Lex who have threeOneOneEnabled=true.
 * The Nova Sonic path calls this via tool use (bridge handles it directly).
 */
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

export const handler = async (event: any) => {
  const {
    agencyId, sessionId, requestType, address, description,
    priority = 'NORMAL', callerName, callerPhone, callerEmail,
    latitude, longitude,
  } = event;

  // Validate agency has 311 enabled
  const dynamo = DynamoDBDocumentClient.from(
    new (require('@aws-sdk/client-dynamodb').DynamoDBClient)({}),
  );
  const { Item: agency } = await dynamo.send(new GetCommand({
    TableName: 'call-assist-agencies',
    Key: { agencyId },
  }));

  if (!agency?.threeOneOneEnabled) {
    throw new Error(`311 not enabled for agency ${agencyId}`);
  }

  const srId = `RC-${agencyId.toUpperCase().slice(0, 4)}-${Date.now()}`;
  const now = new Date().toISOString();

  await dynamo.send(new PutCommand({
    TableName: 'call-assist-service-requests',
    Item: {
      serviceRequestId: srId,
      agencyId,
      sessionId,
      createdAt: now,
      updatedAt: now,
      status: 'OPEN',
      requestType,
      department: resolveDepartment(requestType),
      priority,
      address,
      latitude: latitude || null,
      longitude: longitude || null,
      callerName: callerName || null,
      callerPhone: callerPhone || null,
      callerEmail: callerEmail || null,
      description,
      statusHistory: [{
        status: 'OPEN',
        note: 'Created via AI-assisted call',
        updatedAt: now,
        updatedBy: 'CALL_ASSIST_AI',
      }],
      externalSystemId: null,
      externalSystemType: null,
      smsNotificationsSent: 0,
      lastSmsSentAt: null,
    },
  }));

  // Send confirmation SMS if phone provided and agency has SMS enabled
  if (callerPhone && agency.threeOneOneStatusSmsEnabled && agency.threeOneOneOutboundPhoneNumber) {
    await sendStatusSms(callerPhone, srId, requestType, agency, dynamo);
  }

  // Publish event for dashboard
  const eb = new EventBridgeClient({});
  await eb.send(new PutEventsCommand({
    Entries: [{
      Source: 'nexcortiq.call-assist',
      DetailType: 'ServiceRequestCreated',
      Detail: JSON.stringify({ serviceRequestId: srId, agencyId, requestType, address }),
      EventBusName: 'nexcortiq-call-assist',
    }],
  }));

  return { serviceRequestId: srId, status: 'OPEN', department: resolveDepartment(requestType) };
};

async function sendStatusSms(
  phone: string,
  srId: string,
  requestType: string,
  agency: any,
  dynamo: DynamoDBDocumentClient,
) {
  // Use Amazon Connect outbound SMS via the agency's outbound number
  // Requires Connect instance to have SMS capabilities enabled
  const sns = new SNSClient({});
  try {
    await sns.send(new PublishCommand({
      PhoneNumber: phone,
      Message: `Your ${requestType} service request has been received. Reference: ${srId}. We'll notify you of updates. Reply STOP to opt out.`,
    }));
    await dynamo.send(new (require('@aws-sdk/lib-dynamodb').UpdateCommand)({
      TableName: 'call-assist-service-requests',
      Key: { serviceRequestId: srId },
      UpdateExpression: 'SET smsNotificationsSent = :n, lastSmsSentAt = :t',
      ExpressionAttributeValues: { ':n': 1, ':t': new Date().toISOString() },
    }));
  } catch (err) {
    // Non-fatal — SR was created; SMS failure should not fail the call
    console.error('[create-service-request] SMS send failed (non-fatal):', err);
  }
}

function resolveDepartment(requestType: string): string {
  const map: Record<string, string> = {
    'Pothole': 'Public Works',
    'Street Light': 'Public Works',
    'Traffic Signal': 'Public Works',
    'Sign': 'Public Works',
    'Sidewalk': 'Public Works',
    'Abandoned Vehicle': 'Parking Enforcement',
    'Illegal Parking': 'Parking Enforcement',
    'Graffiti': 'Code Enforcement',
    'Junk': 'Code Enforcement',
    'Overgrown': 'Code Enforcement',
    'Trash': 'Sanitation',
    'Recycling': 'Sanitation',
    'Bulk Pickup': 'Sanitation',
    'Water Leak': 'Utilities',
    'Water Pressure': 'Utilities',
    'Sewer': 'Utilities',
    'Drain': 'Utilities',
    'Park': 'Parks & Recreation',
    'Playground': 'Parks & Recreation',
    'Tree': 'Parks & Recreation',
    'Noise': 'Code Enforcement',
    'Animal': 'Animal Services',
    'Stray': 'Animal Services',
  };
  return Object.entries(map).find(([k]) =>
    requestType.toLowerCase().includes(k.toLowerCase())
  )?.[1] || 'General Services';
}
```

### 5.2 — Lambda: `update-service-request-status`

Create `apps/call-assist/src/service-requests/update-status/handler.ts`:

```typescript
/**
 * Called by department staff (via dashboard API) or external system webhook
 * to update service request status. Sends SMS if caller opted in.
 */
export const handler = async (event: any) => {
  const { serviceRequestId, agencyId, newStatus, note, updatedBy, sendSms = true } = event;
  
  const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  const now = new Date().toISOString();

  const { Item: sr } = await dynamo.send(new GetCommand({
    TableName: 'call-assist-service-requests',
    Key: { serviceRequestId },
  }));

  if (!sr) throw new Error(`Service request ${serviceRequestId} not found`);

  await dynamo.send(new UpdateCommand({
    TableName: 'call-assist-service-requests',
    Key: { serviceRequestId },
    UpdateExpression: 'SET #status = :s, updatedAt = :t, statusHistory = list_append(statusHistory, :h)',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: {
      ':s': newStatus,
      ':t': now,
      ':h': [{ status: newStatus, note, updatedAt: now, updatedBy }],
    },
  }));

  // Send status update SMS if caller has phone and agency has SMS enabled
  if (sendSms && sr.callerPhone && sr.smsNotificationsSent < 5) { // max 5 SMS per SR
    const statusMessages: Record<string, string> = {
      'IN_PROGRESS': `Update on SR ${serviceRequestId}: Your ${sr.requestType} request is now being worked on.`,
      'RESOLVED': `Update on SR ${serviceRequestId}: Your ${sr.requestType} request has been resolved. Thank you for reporting it.`,
      'CANCELLED': `Update on SR ${serviceRequestId}: Your ${sr.requestType} request has been cancelled. ${note || ''}`,
    };
    if (statusMessages[newStatus]) {
      const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
      const sns = new SNSClient({});
      try {
        await sns.send(new PublishCommand({
          PhoneNumber: sr.callerPhone,
          Message: statusMessages[newStatus],
        }));
      } catch (err) {
        console.error('[update-status] SMS send failed (non-fatal):', err);
      }
    }
  }

  return { serviceRequestId, newStatus, updatedAt: now };
};
```

---

## PART 6 — MULTILINGUAL SUPPORT

### 6.1 — Lambda: `language-detect-and-route`

Create `apps/call-assist/src/multilingual/handler.ts`:

```typescript
/**
 * Invoked early in the Connect contact flow to detect caller language.
 * Uses Transcribe streaming for a 5-second language sample, then routes:
 *   - English: continue normal flow
 *   - Spanish: set contact attribute, use es-US Nova Sonic voice
 *   - Unsupported: route to interpreter line or inform caller
 * 
 * Only runs if agency.multilingualEnabled === true
 */
import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from '@aws-sdk/client-transcribe-streaming';

export const handler = async (event: any) => {
  const agencyId = event.Details?.Parameters?.AgencyId;
  const supportedLanguages: string[] = JSON.parse(
    event.Details?.Parameters?.SupportedLanguages || '["en-US"]'
  );

  // Amazon Transcribe Streaming can auto-detect language from a short audio sample
  // Connect contact flow invokes this after a brief greeting and caller response
  // The audio sample comes as a base64 PCM in the event payload from Connect
  
  const detectedLanguage = event.Details?.Parameters?.DetectedLanguage || 'en-US';
  
  if (!supportedLanguages.includes(detectedLanguage)) {
    return {
      language: 'UNSUPPORTED',
      action: 'INTERPRETER',
      callerLanguage: detectedLanguage,
    };
  }

  return {
    language: detectedLanguage,
    action: 'CONTINUE',
    voiceId: getVoiceForLanguage(detectedLanguage),
  };
};

function getVoiceForLanguage(language: string): string {
  const voices: Record<string, string> = {
    'en-US': 'matthew',
    'es-US': 'lupe',
    'pt-BR': 'camila',
    'fr-CA': 'gabrielle',
  };
  return voices[language] || 'matthew';
}
```

---

## PART 7 — CALL QUALITY SCORING

### 7.1 — Lambda: `score-call-quality`

Create `apps/call-assist/src/quality/handler.ts`:

```typescript
/**
 * ADR-001 gates (both required):
 *   agency.callQualityScoringEnabled === true  — feature flag
 *   agency.cjisAiAuthorized === true            — CJIS AI authorization
 * If either is unset or false, function returns immediately. No Bedrock call is made.
 * Unset is treated as false (default-off for all Bedrock-touching features).
 *
 * Triggered by EventBridge when a call session ends (callEndedAt set).
 * Reads transcript from S3, sends to Bedrock for quality scoring.
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const bedrock = new BedrockRuntimeClient({ region: 'us-east-1' });
const s3 = new S3Client({ region: 'us-east-1' });

const QUALITY_SCORING_PROMPT = `You are evaluating an AI assistant's performance on a public non-emergency call.

Score the conversation 0–100 based on:
- Issue resolution (0–30): Was the caller's problem fully addressed or properly routed?
- Accuracy (0–25): Were all facts, department names, and instructions correct?
- Naturalness (0–25): Did the conversation flow naturally without robotic phrasing?
- Emergency awareness (0–20): Were any safety concerns appropriately escalated?

Output a JSON object:
{
  "score": <number 0-100>,
  "resolutionScore": <number 0-30>,
  "accuracyScore": <number 0-25>,
  "naturalnessScore": <number 0-25>,
  "emergencyAwarenessScore": <number 0-20>,
  "summary": "<one sentence>",
  "improvement": "<one specific improvement>"
}

DO NOT include any caller personally identifiable information in your output.
DO NOT reference specific addresses, names, or phone numbers.

Transcript:
`;

export const handler = async (event: any) => {
  const { sessionId, agencyId } = event.detail;

  const dynamo = DynamoDBDocumentClient.from(
    new (require('@aws-sdk/client-dynamodb').DynamoDBClient)({}),
  );
  const { Item: session } = await dynamo.send(new GetCommand({
    TableName: 'call-assist-sessions',
    Key: { sessionId, agencyId },
  }));
  const { Item: agency } = await dynamo.send(new GetCommand({
    TableName: 'call-assist-agencies',
    Key: { agencyId },
  }));

  // Both gates required: scoring flag AND CJIS authorization
  // If either is false, skip entirely — do not log a warning, do not call Bedrock
  if (!agency?.callQualityScoringEnabled || !agency?.cjisAiAuthorized) {
    console.log(`[quality] Skipping: scoring=${agency?.callQualityScoringEnabled}, cjis=${agency?.cjisAiAuthorized}`);
    return;
  }

  if (!session?.transcriptS3Key) {
    console.log(`[quality] No transcript for session ${sessionId}`);
    return;
  }

  // Read transcript from S3
  const transcriptObj = await s3.send(new GetObjectCommand({
    Bucket: process.env.TRANSCRIPTS_BUCKET!,
    Key: session.transcriptS3Key,
  }));
  const transcript = await transcriptObj.Body?.transformToString();
  if (!transcript) return;

  // Redact phone numbers before sending to Bedrock
  const redacted = transcript.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[REDACTED]');

  const response = await bedrock.send(new InvokeModelCommand({
    modelId: 'amazon.nova-lite-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      messages: [{
        role: 'user',
        content: QUALITY_SCORING_PROMPT + redacted,
      }],
      inferenceConfig: { maxTokens: 512, temperature: 0.1 },
    }),
  }));

  const result = JSON.parse(Buffer.from(response.body).toString());
  const scoring = JSON.parse(
    result.output?.message?.content?.[0]?.text || '{}'
  );

  await dynamo.send(new UpdateCommand({
    TableName: 'call-assist-sessions',
    Key: { sessionId, agencyId },
    UpdateExpression: 'SET qualityScore = :s, qualityScoreSummary = :q',
    ExpressionAttributeValues: {
      ':s': scoring.score || null,
      ':q': scoring.summary || null,
    },
  }));

  console.log(`[quality] Session ${sessionId} scored: ${scoring.score}/100`);
};
```

---

## PART 8 — DASHBOARD UPGRADES

**Do not remove, rename, or restructure any existing dashboard components.**  
Add new panels alongside existing ones.

### 8.1 — New: Service Request Panel

Create `apps/call-assist/src/ui/components/ServiceRequestPanel.tsx`:

```tsx
/**
 * Real-time 311 service request board.
 * Uses AppSync or EventBridge → API Gateway WebSocket for live updates.
 * Placed as a new tab/panel alongside existing Call Assist dashboard views.
 */
import { useEffect, useState } from 'react';

interface ServiceRequest {
  serviceRequestId: string;
  requestType: string;
  address: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
  department: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
  callerName?: string;
}

const STATUS_COLORS = {
  OPEN: '#2563EB',
  IN_PROGRESS: '#D97706',
  RESOLVED: '#16A34A',
  CANCELLED: '#6B7280',
};

const PRIORITY_COLORS = {
  LOW: '#6B7280',
  NORMAL: '#2563EB',
  HIGH: '#D97706',
  URGENT: '#DC2626',
};

export function ServiceRequestPanel({ agencyId }: { agencyId: string }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS'>('OPEN');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch initial requests and subscribe to updates
    // Implement using existing WebSocket/AppSync pattern from this repo
    fetchServiceRequests(agencyId, filter).then((data) => {
      setRequests(data);
      setLoading(false);
    });
  }, [agencyId, filter]);

  const filtered = requests.filter(r =>
    filter === 'ALL' ? true : r.status === filter
  );

  return (
    <div className="service-request-panel">
      <div className="panel-header">
        <h2>311 Service Requests</h2>
        <div className="filter-tabs">
          {(['ALL', 'OPEN', 'IN_PROGRESS'] as const).map(f => (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading service requests...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">No {filter.toLowerCase()} service requests</div>
      ) : (
        <div className="request-grid">
          {filtered.map(sr => (
            <div key={sr.serviceRequestId} className="request-card">
              <div className="request-card-header">
                <span
                  className="priority-badge"
                  style={{ backgroundColor: PRIORITY_COLORS[sr.priority] }}
                >
                  {sr.priority}
                </span>
                <span
                  className="status-badge"
                  style={{ color: STATUS_COLORS[sr.status] }}
                >
                  {sr.status.replace('_', ' ')}
                </span>
              </div>
              <div className="request-type">{sr.requestType}</div>
              <div className="request-address">{sr.address}</div>
              <div className="request-meta">
                <span>{sr.department}</span>
                <span>{new Date(sr.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="request-id">{sr.serviceRequestId}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Implement this using the existing API Gateway / fetch pattern in this repo
async function fetchServiceRequests(agencyId: string, status: string): Promise<ServiceRequest[]> {
  // GET /call-assist/service-requests?agencyId={agencyId}&status={status}
  throw new Error('Implement using existing API client in this repo');
}
```

### 8.2 — New: Call Quality Dashboard Row

Locate the existing call history/session list component and add a quality score column:

```tsx
// Find the existing call session list component and add:
// - qualityScore column: display as colored badge (0-59: red, 60-79: amber, 80-100: green)
// - voiceEngineUsed column: "Nova Sonic" or "Lex/Polly"
// Do not change the column order of existing columns.

const qualityBadgeColor = (score: number | null) => {
  if (score === null) return '#6B7280';  // gray — not scored
  if (score >= 80) return '#16A34A';    // green
  if (score >= 60) return '#D97706';    // amber
  return '#DC2626';                     // red
};
```

---

## PART 9 — INFRASTRUCTURE (IaC)

Create `infra/call-assist/nova-sonic.yaml` — CloudFormation template for:

```yaml
# Required SSM Parameters (create per agency before ECS tasks can start):
# /nexcortiq/call-assist/{agencyId}/system-prompt
#   → Store the full Nexiq system prompt string (see defaultSystemPrompt() in bridge/index.ts).
#     Every agency gets the Nexiq identity regardless of other customizations.
#     Default value: use the defaultSystemPrompt() function verbatim.
#     Agency-specific overrides append to the base prompt — they never replace the Nexiq identity section.

# Required resources:
# 1. ECS Task Definition: nova-sonic-bridge
#    - Container: nexcortiq/nova-sonic-bridge:latest
#    - CPU: 512, Memory: 1024
#    - Port: 9001 (TCP)
#    - IAM Task Role with permissions:
#      - bedrock:InvokeModelWithBidirectionalStream on amazon.nova-2-5-sonic
#      - bedrock:InvokeModel on nova-lite-v1:* (for quality scoring)
#      - dynamodb:PutItem, UpdateItem on call-assist-sessions, call-assist-service-requests
#      - eventbridge:PutEvents on nexcortiq-call-assist event bus
#      - ssm:GetParameter on /nexcortiq/call-assist/*
#      - s3:GetObject on nexcortiq-call-assist-kb/*
#      - s3:PutObject on nexcortiq-call-assist-transcripts/*

# 2. EventBridge Event Bus: nexcortiq-call-assist
#    - Rules:
#      - NovaSonicFallback → Lambda: nova-sonic-fallback-handler
#      - EmergencyEscalation → Lambda: emergency-notification (existing) + DynamoDB update
#      - ServiceRequestCreated → Lambda: notify-dashboard
#      - SessionEnded → Lambda: score-call-quality

# 3. Security Group: nova-sonic-bridge-sg
#    - Inbound: TCP 9001 from Connect media streaming IP ranges
#    - Outbound: HTTPS 443 to Bedrock service endpoint

# 4. IAM Role: nova-sonic-session-init-role
#    - ecs:RunTask on nova-sonic-bridge task definition
#    - iam:PassRole to nova-sonic-bridge task role
#    - dynamodb:PutItem on call-assist-sessions
#    - dynamodb:GetItem on call-assist-agencies

# 5. Lambda Function: nova-sonic-session-init
# 6. Lambda Function: nova-sonic-fallback-handler
# 7. Lambda Function: create-service-request
# 8. Lambda Function: update-service-request-status
# 9. Lambda Function: score-call-quality
# 10. Lambda Function: language-detect-and-route

# IMPORTANT: All resources in account 158961537080 ONLY.
# DO NOT create cross-account roles or policies referencing account 991260941851.
```

---

## PART 10 — AUTOMATED TESTING

Create `apps/call-assist/src/__tests__/`:

### 10.1 — Conversation Flow Tests

Create `apps/call-assist/src/__tests__/conversation-flows.test.ts`:

```typescript
/**
 * Tests simulate Connect → Lambda/ECS flow with mocked AWS services.
 * Use aws-sdk-client-mock for all AWS service mocks.
 * Tests MUST run without live AWS credentials.
 */
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';

const dynamoMock = mockClient(DynamoDBDocumentClient);
const ebMock = mockClient(EventBridgeClient);
const ecsMock = mockClient(ECSClient);

describe('nova-sonic-session-init', () => {
  beforeEach(() => {
    dynamoMock.reset();
    ebMock.reset();
    ecsMock.reset();
  });

  test('returns LEX_POLLY if novaSonicEnabled is false', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { agencyId: 'AGENCY001', novaSonicEnabled: false },
    });
    const { handler } = require('../nova-sonic/session-init/handler');
    const result = await handler({
      Details: { Parameters: { AgencyId: 'AGENCY001' }, ContactId: 'CONTACT001' },
    });
    expect(result.voiceEngine).toBe('LEX_POLLY');
    expect(result.reason).toBe('not_enabled');
  });

  test('starts ECS task when novaSonicEnabled is true', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: {
        agencyId: 'AGENCY001',
        novaSonicEnabled: true,
        novaSonicVoiceId: 'matthew',
        novaSonicLanguage: 'en-US',
        knowledgeBaseId: null,
        threeOneOneEnabled: false,
      },
    });
    dynamoMock.on(PutCommand).resolves({});
    ecsMock.on(RunTaskCommand).resolves({
      tasks: [{ taskArn: 'arn:aws:ecs:us-east-1:158961537080:task/test-task' }],
    });

    const { handler } = require('../nova-sonic/session-init/handler');
    const result = await handler({
      Details: { Parameters: { AgencyId: 'AGENCY001' }, ContactId: 'CONTACT002' },
    });
    expect(result.voiceEngine).toBe('NOVA_SONIC');
    expect(result.taskArn).toContain('test-task');
  });

  test('falls back to LEX_POLLY if ECS RunTask fails', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { agencyId: 'AGENCY001', novaSonicEnabled: true },
    });
    ecsMock.on(RunTaskCommand).rejects(new Error('ECS capacity unavailable'));
    ebMock.on(PutEventsCommand).resolves({});

    const { handler } = require('../nova-sonic/session-init/handler');
    const result = await handler({
      Details: { Parameters: { AgencyId: 'AGENCY001' }, ContactId: 'CONTACT003' },
    });
    expect(result.voiceEngine).toBe('LEX_POLLY');
    expect(result.reason).toBe('ecs_start_failed');
  });
});

describe('emergency escalation', () => {
  const EMERGENCY_PHRASES = [
    'he has a gun',
    'call 911',
    'I can\'t breathe',
    'there\'s a fire',
    'someone is shooting',
    'I\'m having a heart attack',
    'bomb',
    'gas leak',
  ];

  EMERGENCY_PHRASES.forEach(phrase => {
    test(`detects emergency keyword: "${phrase}"`, async () => {
      const { checkEmergencyKeywords } = require('../nova-sonic/bridge/emergencyDetection');
      const emergencyKeywords = [
        'help me', 'call 911', 'emergency', 'fire', 'shooting', 'stabbing',
        "can't breathe", 'not breathing', 'heart attack', 'chest pain',
        'unconscious', 'overdose', 'dying', 'he has a gun', 'she has a gun',
        'bomb', 'explosion', 'flood', 'gas leak', 'carbon monoxide',
      ];
      const matched = checkEmergencyKeywords(phrase, emergencyKeywords);
      expect(matched).not.toBeNull();
    });
  });

  test('does NOT flag non-emergency phrases as emergencies', () => {
    const { checkEmergencyKeywords } = require('../nova-sonic/bridge/emergencyDetection');
    const nonEmergencies = [
      'my street light is out',
      'there is a pothole on Main Street',
      'I want to pay my water bill',
      'what are the park hours',
      'I need to report graffiti',
    ];
    nonEmergencies.forEach(phrase => {
      const matched = checkEmergencyKeywords(phrase, [
        'fire', 'shooting', 'gun', 'bomb', 'dying', 'heart attack',
      ]);
      expect(matched).toBeNull();
    });
  });
});

describe('service request creation', () => {
  test('creates service request with correct department routing', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { agencyId: 'AGENCY001', threeOneOneEnabled: true, threeOneOneStatusSmsEnabled: false },
    });
    dynamoMock.on(PutCommand).resolves({});
    ebMock.on(PutEventsCommand).resolves({});

    const { handler } = require('../service-requests/create/handler');
    const result = await handler({
      agencyId: 'AGENCY001',
      sessionId: 'SESSION001',
      requestType: 'Pothole',
      address: '123 Main St',
      description: 'Large pothole near intersection',
    });

    expect(result.department).toBe('Public Works');
    expect(result.status).toBe('OPEN');
    expect(result.serviceRequestId).toMatch(/^RC-AGEN/);
  });

  test('throws if 311 not enabled for agency', async () => {
    dynamoMock.on(GetCommand).resolves({
      Item: { agencyId: 'AGENCY002', threeOneOneEnabled: false },
    });

    const { handler } = require('../service-requests/create/handler');
    await expect(handler({
      agencyId: 'AGENCY002',
      sessionId: 'SESSION002',
      requestType: 'Pothole',
      address: '456 Oak Ave',
      description: 'Pothole',
    })).rejects.toThrow('311 not enabled');
  });
});

describe('call quality scoring', () => {
  test('skips scoring if cjisAiAuthorized is false', async () => {
    dynamoMock.on(GetCommand)
      .resolvesOnce({ Item: { sessionId: 'S1', agencyId: 'A1', transcriptS3Key: 'A1/S1.json' } })
      .resolvesOnce({ Item: { agencyId: 'A1', callQualityScoringEnabled: true, cjisAiAuthorized: false } });

    const { handler } = require('../quality/handler');
    // Should complete without calling Bedrock
    await expect(handler({ detail: { sessionId: 'S1', agencyId: 'A1' } })).resolves.not.toThrow();
  });
});
```

### 10.2 — Nova Sonic Fallback Test

Create `apps/call-assist/src/__tests__/nova-sonic-fallback.test.ts`:

```typescript
/**
 * Tests that the fallback to Lex is triggered correctly on Nova Sonic errors
 * and that existing Lex emergency escalations still function independently.
 */

describe('fallback behavior', () => {
  test('fallback handler updates session voiceEngineUsed to LEX_POLLY', async () => {
    const dynamoMock = mockClient(DynamoDBDocumentClient);
    dynamoMock.on(UpdateCommand).resolves({});

    const { handler } = require('../nova-sonic/fallback-handler/handler');
    await handler({
      detail: {
        sessionId: 'SESSION001',
        agencyId: 'AGENCY001',
        reason: 'connection_timeout',
      },
    });

    const updateCall = dynamoMock.commandCalls(UpdateCommand)[0];
    expect(updateCall.args[0].input.ExpressionAttributeValues[':v']).toBe('LEX_POLLY');
  });
});
```

### 10.3 — Run Tests

```bash
# From repo root
cd apps/call-assist
npm test -- --coverage --passWithNoTests

# Coverage targets:
# nova-sonic/session-init: 90%
# service-requests/create: 85%
# quality: 85%
# emergencyDetection: 100% (safety critical)
```

---

## HARD CONSTRAINTS — DO NOT VIOLATE

1. **AWS account isolation:** ALL resources in account `158961537080`. No cross-account references to `991260941851`.
2. **Nova Sonic is additive:** `voiceEngine` flag defaults to `LEX_POLLY` for all agencies. Nova Sonic activates only when `novaSonicEnabled: true` is set explicitly by an admin.
3. **Lex/Polly fallback always active:** Even for agencies with Nova Sonic enabled, the Lex/Polly path must remain functional. `novaSonicFallbackToLex: true` is always set.
4. **Emergency safeguards are additive:** Every existing emergency detection block, escalation Lambda, and supervisor notification remains untouched. Nova Sonic adds its own emergency detection in the bridge — it does not replace existing safeguards.
5. **`cjisAiAuthorized` gates all Bedrock calls that process call content.** Quality scoring and call summarization are entirely blocked if this flag is false for the agency.
6. **No PII in CloudWatch logs at INFO level.** Do not log caller names, phone numbers, addresses, or transcript text at INFO. Use structured logging with redaction.
7. **Do not modify existing dashboard component files.** Add new components alongside them.
8. **Do not modify existing Lex bot intents, slots, or utterances.**
9. **Service request IDs must be human-readable** (`RC-AGCY-1234567890`), not raw UUIDs. Callers will reference them verbally.
10. **SMS is opt-in per agency** via `threeOneOneStatusSmsEnabled`. Never send SMS without this flag being true.
11. **ECS task per call.** Do not share a single Nova Sonic bridge task across multiple calls. Each call gets its own task, stopped when the call ends.
12. **Assistant identity is always Nexiq.** Every call — Nova 2 Sonic path and Lex/Polly fallback path — must open with the Nexiq greeting. The system prompt in SSM must include the name and pronunciation note. No code path may omit or override the identity. Never introduce the assistant as "the AI," "the assistant," or any other name.
13. **Use Nova 2 Sonic only.** Model ID throughout: `amazon.nova-2-5-sonic`, on-demand inference. The original `amazon.nova-sonic-v1:0` reached end-of-service **September 14, 2026** and no longer responds — any invocation will fail. On-demand throughput means no provisioned capacity setup is required; the model is invocable immediately after enabling it in the Bedrock console for account `158961537080`.
14. **311 tools use Lex on the current stack.** Nova Sonic tool-use blocks for 311 (`create_service_request`, etc.) are greenfield-only. Do not activate Nova Sonic tool-use for 311 until SMS DID + TTL + queue bind cutovers are complete. The Lex/Polly 311 path is live and must remain functional.

---

## IMPLEMENTATION ORDER

Execute in this sequence:

1. **Audit** (Part 1) — Complete `AUDIT.md` before any code changes.
2. **Schema** (Part 2) — Deploy DynamoDB table updates / create new tables.
3. **Nova Sonic Bridge** (Part 3) — Write bridge, session-init Lambda, fallback handler.
4. **Connect Flow Updates** (Part 4) — Add Nova Sonic branch to existing flows.
5. **311 Service Requests** (Part 5) — Create, update-status Lambdas + DynamoDB.
6. **Multilingual** (Part 6) — Language detect Lambda.
7. **Call Quality Scoring** (Part 7) — score-call-quality Lambda.
8. **Dashboard Upgrades** (Part 8) — ServiceRequestPanel, quality score column.
9. **Infrastructure** (Part 9) — CloudFormation template.
10. **Tests** (Part 10) — All test files + verify coverage targets.

Do not skip the audit. The audit determines what already exists and prevents duplicating or conflicting with it.
