# NexCort iQ — Conversational Voice Upgrade
## Cursor Implementation Prompt

---

## CONTEXT

You are upgrading the NexCort iQ non-emergency answering engine to deliver a natural, conversational caller experience comparable to Verizon's Conversational IVR — where callers speak naturally and the AI responds like a helpful, knowledgeable representative, not an automated phone menu.

The existing system uses:
- **Amazon Connect** for telephony (call handling, routing, recording, transfers)
- **Amazon Lex V2** for structured intents and existing non-emergency workflows
- **Amazon Nova Sonic** (or Nova 2.5 Sonic if available) for voice synthesis and streaming speech
- **NexCort iQ backend services** for agency knowledge, reporting rules, and CAD integrations

**DO NOT replace any of these.** This upgrade orchestrates them together more effectively.

---

## INSTRUCTIONS FOR CURSOR

### Step 1 — Inventory the existing setup before changing anything

Before writing a single line of new code:

1. Locate all Lambda functions connected to Amazon Connect contact flows for non-emergency calls. List their names, triggers, and what they currently do.
2. Find the existing Lex V2 bot configuration (intents, slots, utterances, fulfillment hooks). Note which intents handle the most common non-emergency call types (blocked vehicle, noise complaint, abandoned property, welfare check requests, etc.).
3. Identify how Nova Sonic is currently invoked — is it called from Connect directly, from a Lambda, or through a custom integration layer?
4. Find any existing session context passing between Connect, Lex, and downstream Lambda handlers.
5. Check if Nova 2.5 Sonic (released October 5, 2026) is available in this AWS account's region and note whether it has been enabled.

**Report what you found before proceeding.**

---

### Step 2 — Build the conversational orchestration layer

Create a new Lambda function: `nexcortiq-conversational-orchestrator`

This function acts as the brain of the conversation. It receives caller input from Connect/Lex, maintains conversation context, calls NexCort iQ agency services, and returns structured responses for Nova Sonic to speak.

```typescript
// nexcortiq-conversational-orchestrator/index.ts

import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

interface ConversationContext {
  callId: string;
  agencyId: string;
  callerPhone?: string;
  collectedInfo: {
    address?: string;
    callerName?: string;
    incidentType?: string;
    additionalDetails?: string[];
  };
  turnCount: number;
  lastIntent?: string;
  emergencyFlagged: boolean;
  transferRequested: boolean;
}

interface OrchestratorInput {
  sessionId: string;
  callerTranscript: string;
  currentIntent?: string;
  sessionAttributes: Record<string, string>;
  agencyId: string;
}

interface OrchestratorOutput {
  responseText: string;
  sessionAttributes: Record<string, string>;
  shouldTransfer: boolean;
  transferTarget?: 'dispatcher' | 'emergency_911' | 'supervisor';
  transferSummary?: string;
  incidentDraft?: object;
  closeCall: boolean;
}

export const handler = async (input: OrchestratorInput): Promise<OrchestratorOutput> => {
  const context = deserializeContext(input.sessionAttributes);
  
  // SAFETY CHECK: Emergency detection runs first, always
  if (isEmergencyKeyword(input.callerTranscript)) {
    return {
      responseText: "It sounds like this may be an emergency. I'm transferring you to a dispatcher right now. Please stay on the line.",
      sessionAttributes: serializeContext(context),
      shouldTransfer: true,
      transferTarget: 'emergency_911',
      transferSummary: `Caller said: "${input.callerTranscript}" — possible emergency detected, auto-transferred.`,
      closeCall: false
    };
  }

  // Build conversational response using Claude via Bedrock
  const response = await generateConversationalResponse(context, input.callerTranscript, input.currentIntent);
  
  // Update context with new information extracted from this turn
  const updatedContext = extractAndUpdateContext(context, input.callerTranscript, response);
  
  return {
    responseText: response.text,
    sessionAttributes: serializeContext(updatedContext),
    shouldTransfer: response.readyToTransfer,
    transferTarget: response.readyToTransfer ? 'dispatcher' : undefined,
    transferSummary: response.readyToTransfer ? buildTransferSummary(updatedContext) : undefined,
    incidentDraft: response.incidentDraft,
    closeCall: response.callComplete
  };
};

function isEmergencyKeyword(transcript: string): boolean {
  const emergencyPhrases = [
    'emergency', 'dying', 'bleeding', 'can\'t breathe', 'heart attack',
    'stroke', 'fire', 'shooting', 'stabbing', 'help me', 'call 911',
    'going to kill', 'going to hurt', 'weapon', 'gun', 'knife'
  ];
  const lower = transcript.toLowerCase();
  return emergencyPhrases.some(phrase => lower.includes(phrase));
}
```

---

### Step 3 — Configure the voice personality prompt

Create a system prompt file: `prompts/non-emergency-system.txt`

```
You are the automated non-emergency assistant for [AGENCY_NAME].

Your personality:
- Warm, calm, and professional — like a helpful city services representative
- Conversational: short, natural responses, not scripted paragraphs
- Patient: never rush the caller or make them feel like a burden
- Efficient: gather what you need without asking unnecessary questions

Your job:
1. Understand why the caller is contacting the non-emergency line
2. Collect the minimum information needed to help them or create a service request
3. Answer questions using the agency's current information when available
4. Transfer to a dispatcher when: the caller requests it, the situation is complex, 
   or safety concern is raised

Rules you must always follow:
- Always disclose at the start that the caller is speaking with an AI assistant
- Always detect and immediately transfer any emergency situation to a live dispatcher
- Never make promises about police response times
- Never diagnose medical situations or give medical advice
- Never collect payment information
- If you are unsure whether something is an emergency, err on the side of transfer

Tone examples:
✓ "Got it, 123 Main Street. Is the vehicle blocking the whole driveway or just part of it?"
✓ "Let me check how your city handles that type of report."
✓ "I want to make sure I have this right — the noise started around 10 PM?"
✗ "I have recorded your address as 123 Main Street. Please confirm this is correct."
✗ "Your request has been logged in the system."
✗ "I did not understand your response. Please try again."

When ready to transfer to a dispatcher, say:
"I have everything I need. Let me connect you with a dispatcher now. I'll give them a summary 
of what you've told me so you don't have to repeat yourself."
```

---

### Step 4 — Configure Nova Sonic turn-detection settings

In the Amazon Connect contact flow or Nova Sonic integration layer, apply these settings:

```json
{
  "voiceConfiguration": {
    "model": "amazon.nova-sonic-v2:5",
    "voiceId": "en-US-conversational-warm",
    "turnDetection": {
      "sensitivity": "MEDIUM",
      "endOfTurnPauseMs": 1750,
      "interruptionEnabled": true,
      "bargeinEnabled": true
    },
    "speechSettings": {
      "speakingRate": 0.95,
      "volumeGain": 0.0,
      "pitch": 0.0
    },
    "streamingEnabled": true,
    "contextWindowTurns": 20
  }
}
```

**Notes:**
- `MEDIUM` sensitivity (1750ms) is the recommended starting point. Tune lower (faster cutoff) or higher (more patient) based on test calls.
- `bargeinEnabled: true` lets callers interrupt without breaking the session — critical for natural conversation.
- `contextWindowTurns: 20` keeps 20 turns of conversation in context so the AI never asks for information it already has.

---

### Step 5 — Update the Connect contact flow

Modify the Amazon Connect non-emergency contact flow to:

1. **Opening disclosure** (required): Before any interaction, play:
   > "Thanks for calling [Agency Name]'s non-emergency line. You're speaking with an automated AI assistant. I can help with most non-emergency requests, or connect you with a dispatcher at any time. How can I help you today?"

2. **Route all non-emergency intents through the orchestrator Lambda** (Step 2) rather than directly to fulfillment.

3. **Add a "Transfer at any time" branch**: If the caller says "transfer me," "agent," "dispatcher," "real person," or "human," immediately execute the dispatcher transfer flow.

4. **Post-call recording tag**: Tag all non-emergency AI-handled calls with `NexCortIQ-Conversational-v2` for QA monitoring.

---

### Step 6 — Build a staging test before touching production

Create a parallel contact flow: `NexCortIQ-NE-Conversational-STAGING`

Route 5% of non-emergency calls to staging using Connect's traffic distribution. 

Add a CloudWatch dashboard to compare:
- Average handle time (AI-only vs. transferred)
- Transfer rate (how often callers request a human)
- Emergency detection triggers (confirms safety net is working)
- Caller satisfaction signals (call duration as a proxy)

Do not replace the production flow until staging runs for a minimum of 500 calls without safety incidents.

---

### Step 7 — Build the dispatcher handoff summary

When a transfer is triggered, pass this structured summary to the receiving dispatcher's screen via the Connect CTR (Contact Trace Record) or a screen-pop integration:

```typescript
function buildTransferSummary(context: ConversationContext): string {
  const lines = [
    `📞 NexCort iQ Non-Emergency AI Transfer`,
    `Incident Type: ${context.collectedInfo.incidentType || 'Not specified'}`,
    `Address: ${context.collectedInfo.address || 'Not provided'}`,
    `Caller Name: ${context.collectedInfo.callerName || 'Not provided'}`,
  ];

  if (context.collectedInfo.additionalDetails?.length) {
    lines.push(`Details: ${context.collectedInfo.additionalDetails.join('; ')}`);
  }

  lines.push(`Turns with AI: ${context.turnCount}`);
  lines.push(`Transfer reason: ${context.transferRequested ? 'Caller requested' : 'AI-initiated (complexity)'}`);

  return lines.join('\n');
}
```

---

## WHAT TO PRESERVE (DO NOT BREAK)

- All existing Lex V2 intents and trained utterances — the orchestrator calls Lex, it doesn't replace it
- All existing Connect contact flows for emergency calls — this upgrade is non-emergency only
- All existing CAD integration endpoints and authentication
- All existing call recording, retention, and compliance configurations
- All agency-specific routing rules (business hours, overflow, supervisor escalation)

---

## DELIVERABLES

When complete, provide:
1. The updated Lambda function(s) with TypeScript source
2. The updated Connect contact flow JSON (staging version)
3. The Nova Sonic configuration block
4. A short test script: 5 sample call scenarios to verify natural conversation, emergency detection, transfer trigger, and repeat-info prevention
5. CloudWatch alarm definitions for the safety monitoring dashboard

---

*NexCort iQ — Intelligence at the speed of response.*
