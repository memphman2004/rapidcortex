/**
 * Nova 2 Sonic session protocol for Nexiq.
 *
 * Bedrock model ID is `amazon.nova-2-5-sonic` (InvokeModelWithBidirectionalStream, on-demand).
 * Nova 2 Sonic (`amazon.nova-2-sonic-v1:0`) is the previous model. Same price, weaker instruction following.
 * `amazon.nova-sonic-v1:0` ended service on 2026-09-14.
 * `amazon.nova-sonic-v2:0` is not a Bedrock model ID.
 *
 * The system prompt is a SYSTEM text turn, not a field on promptStart.
 * When the agency flag is on, English and Spanish calls are answered by Nova 2 Sonic.
 * Nova speaks the greeting, the intake, and either the report number or the transfer line.
 * Other locales, and a Nova failure, stay on Lex and Polly.
 */
import { evaluateSafety } from "./safety.js";
import { NEXIQ_OPENING_GREETING, systemPromptForAgency } from "./nexiq-identity.js";
import { formatCallAssistConversationalSystemPrompt } from "./conversational-system-prompt-v2.js";

export const NOVA_2_SONIC_MODEL_ID = "amazon.nova-2-5-sonic";

/**
 * Lex speech-to-speech rejects `amazon.nova-2-5-sonic`.
 * The only model it accepts on a bot locale is Nova 2 Sonic.
 */
export const LEX_NOVA_SPEECH_MODEL_ID = "amazon.nova-2-sonic-v1:0";

/** Bedrock foundation-model ARN for the direct Nova 2.5 Sonic stream. */
export function novaSonicFoundationModelArn(region = "us-east-1"): string {
  const resolved = region.trim() || "us-east-1";
  return `arn:aws:bedrock:${resolved}::foundation-model/${NOVA_2_SONIC_MODEL_ID}`;
}

/** Bedrock foundation-model ARN Lex will store on an English or Spanish locale. */
export function lexNovaSpeechModelArn(region = "us-east-1"): string {
  const resolved = region.trim() || "us-east-1";
  return `arn:aws:bedrock:${resolved}::foundation-model/${LEX_NOVA_SPEECH_MODEL_ID}`;
}

/** Nova 2 Sonic voice id for an English or Spanish Lex locale. Other locales stay on Polly. */
export function novaSonicLexVoiceId(locale: string): "tiffany" | "lupe" | null {
  if (locale === "en_US" || locale === "en-US") return "tiffany";
  if (locale === "es_US" || locale === "es-US") return "lupe";
  return null;
}

export type CallAssistVoiceEngine = "NOVA_SONIC" | "LEX_POLLY";

/** Phrases the Safety engine does not already catch. Detection is the union, never a replacement. */
export const NOVA_SONIC_EXTRA_EMERGENCY_PHRASES = [
  "bomb",
  "gas leak",
  "carbon monoxide",
  "chest pain",
  "flood",
  "fire",
] as const;

export function checkEmergencyKeywords(
  text: string,
  extra: readonly string[] = NOVA_SONIC_EXTRA_EMERGENCY_PHRASES,
): string | null {
  const safety = evaluateSafety(text);
  if (safety.classification === "EMERGENCY" || safety.action === "TRANSFER_911") {
    return safety.matchedPhrases[0] ?? "emergency";
  }
  const normalized = text.toLowerCase();
  return extra.find((phrase) => normalized.includes(phrase.toLowerCase())) ?? null;
}

/**
 * Lex/Polly fallback path only. Nova Sonic path now uses formatCallAssistConversationalSystemPrompt.
 * Kept for the LEX_POLLY engine and for test stubs that call this directly.
 * Do NOT use this for novaSonicEnabled=true — it lacks the v2 intake protocol.
 */
export function defaultNovaSonicSystemPrompt(agencyAppend?: string | null): string {
  const base = systemPromptForAgency(agencyAppend);
  return `${base}

The telephony system spoke the opening greeting before this session.
Do NOT say your name. Do NOT say "How can I help you today?" again.
Listen for the caller. Your first spoken turn is a response to what they just said.

WHEN TO START TALKING
- After the caller finishes a full thought.
- When you need the next single missing piece of information.
- Once, to confirm a street address.
- To give the report number, or to announce a transfer.

WHEN TO STOP TALKING
- The moment the caller starts speaking — drop the rest of your sentence.
- After one question.
- After you speak the report number.
- After you announce a transfer.
- After an emergency line — once, then stop.

COMPLETION
Once you have confirmed the caller's location, generate and speak a report number immediately.
Format: RC dash [4-digit date MMDD] dash [4 random uppercase letters], example: RC-1102-7M4R.
Say: "Your report number is [number]. I'll repeat that — [number]. Someone will be in touch."
Then stop.

EMERGENCY
If you detect immediate danger to life, active fire, a medical emergency, or a violent crime:
Say "I'm transferring you to emergency services now." Then stop.`;
}

export type NovaSonicSessionEvent = {
  event: Record<string, unknown>;
};

/** Tool names the Nova Sonic gateway must implement for Connect handoff. */
export const NOVA_SONIC_TOOL_NAMES = [
  "transfer_emergency",
  "issue_report_number",
  "save_intake_fields",
  "request_human",
] as const;

export type NovaSonicToolName = (typeof NOVA_SONIC_TOOL_NAMES)[number];

export type NovaSonicToolSpec = {
  toolSpec: {
    name: NovaSonicToolName;
    description: string;
    inputSchema: { json: string };
  };
};

/** Bedrock promptStart toolConfiguration for Call Assist Nova Sonic. */
export function novaSonicCallAssistToolConfiguration(): {
  tools: NovaSonicToolSpec[];
  toolChoice: { auto: Record<string, never> };
} {
  return {
    toolChoice: { auto: {} },
    tools: [
      {
        toolSpec: {
          name: "transfer_emergency",
          description:
            "Transfer the caller to emergency services immediately when there is active danger to life, fire, medical emergency, or violent crime in progress.",
          inputSchema: {
            json: JSON.stringify({
              type: "object",
              properties: {
                reason: { type: "string", description: "Short reason for the emergency transfer" },
                matchedPhrase: { type: "string", description: "Caller phrase that triggered transfer" },
              },
              required: ["reason"],
            }),
          },
        },
      },
      {
        toolSpec: {
          name: "issue_report_number",
          description:
            "Issue a report confirmation number once location and issue type are confirmed. Speak the number to the caller after this tool returns.",
          inputSchema: {
            json: JSON.stringify({
              type: "object",
              properties: {
                locationText: { type: "string" },
                incidentTypeHint: { type: "string" },
                summary: { type: "string" },
              },
              required: ["locationText", "incidentTypeHint"],
            }),
          },
        },
      },
      {
        toolSpec: {
          name: "save_intake_fields",
          description: "Persist partial intake fields collected so far (location, vehicle, callback, notes).",
          inputSchema: {
            json: JSON.stringify({
              type: "object",
              properties: {
                locationText: { type: "string" },
                incidentTypeHint: { type: "string" },
                summary: { type: "string" },
                callbackNumber: { type: "string" },
                vehicleDescription: { type: "string" },
                plate: { type: "string" },
              },
            }),
          },
        },
      },
      {
        toolSpec: {
          name: "request_human",
          description: "Caller asked for a live person or the AI cannot complete the intake. Hand off to Lex/human queue.",
          inputSchema: {
            json: JSON.stringify({
              type: "object",
              properties: {
                reason: { type: "string" },
              },
              required: ["reason"],
            }),
          },
        },
      },
    ],
  };
}

/** Connect contact attributes the flow already branches on after Nova intake. */
export type NovaSonicConnectHandoffAttrs = {
  callerDone: "true" | "false";
  emergencyEscalation: "true" | "false";
  novaSonicFallbackToLex: "true" | "false";
  confirmationNumber: string;
  escalationAnnouncement: string;
  novaSessionStatus: "ACTIVE" | "COMPLETED" | "EMERGENCY" | "FALLBACK" | "HUMAN" | "ERROR";
  novaFallbackReason: string;
};

export function emptyNovaSonicConnectHandoffAttrs(
  overrides?: Partial<NovaSonicConnectHandoffAttrs>,
): NovaSonicConnectHandoffAttrs {
  return {
    callerDone: "false",
    emergencyEscalation: "false",
    novaSonicFallbackToLex: "false",
    confirmationNumber: "",
    escalationAnnouncement: "",
    novaSessionStatus: "ACTIVE",
    novaFallbackReason: "",
    ...overrides,
  };
}

export function novaSonicOpeningEvents(opts: {
  promptName: string;
  contentName: string;
  voiceId?: string;
  systemPrompt: string;
  /** Include Call Assist tools on promptStart (default true). */
  includeTools?: boolean;
}): NovaSonicSessionEvent[] {
  const voiceId = opts.voiceId?.trim() || "matthew";
  const includeTools = opts.includeTools !== false;
  const promptStart: Record<string, unknown> = {
    promptName: opts.promptName,
    textOutputConfiguration: { mediaType: "text/plain" },
    audioOutputConfiguration: {
      mediaType: "audio/lpcm",
      sampleRateHertz: 24000,
      sampleSizeBits: 16,
      channelCount: 1,
      voiceId,
      encoding: "base64",
      audioType: "SPEECH",
    },
  };
  if (includeTools) {
    promptStart.toolUseOutputConfiguration = { mediaType: "application/json" };
    promptStart.toolConfiguration = novaSonicCallAssistToolConfiguration();
  }
  return [
    {
      event: {
        sessionStart: {
          inferenceConfiguration: { maxTokens: 1024, topP: 0.9, temperature: 0.7 },
          // LOW: snappier turn-taking after short answers ("Yes." / street name).
          // Step back to MEDIUM if callers report being cut off mid-thought.
          // TODO: add bargein when nova-2-5-sonic / InvokeModelWithBidirectionalStream
          // exposes an interruption or barge-in flag (none on sessionStart today).
          turnDetectionConfiguration: { endpointingSensitivity: "LOW" },
        },
      },
    },
    { event: { promptStart } },
    {
      event: {
        contentStart: {
          promptName: opts.promptName,
          contentName: opts.contentName,
          type: "TEXT",
          interactive: true,
          role: "SYSTEM",
          textInputConfiguration: { mediaType: "text/plain" },
        },
      },
    },
    {
      event: {
        textInput: {
          promptName: opts.promptName,
          contentName: opts.contentName,
          content: opts.systemPrompt,
        },
      },
    },
    {
      event: {
        contentEnd: {
          promptName: opts.promptName,
          contentName: opts.contentName,
        },
      },
    },
  ];
}

/** Build a toolResult event after executing a toolUse from Nova. */
export function novaSonicToolResultEvent(opts: {
  promptName: string;
  contentName: string;
  toolUseId: string;
  result: unknown;
}): NovaSonicSessionEvent[] {
  const content = typeof opts.result === "string" ? opts.result : JSON.stringify(opts.result);
  return [
    {
      event: {
        contentStart: {
          promptName: opts.promptName,
          contentName: opts.contentName,
          interactive: false,
          type: "TOOL",
          role: "TOOL",
          toolResultInputConfiguration: {
            toolUseId: opts.toolUseId,
            type: "TEXT",
            textInputConfiguration: { mediaType: "text/plain" },
          },
        },
      },
    },
    {
      event: {
        toolResult: {
          promptName: opts.promptName,
          contentName: opts.contentName,
          content,
        },
      },
    },
    {
      event: {
        contentEnd: {
          promptName: opts.promptName,
          contentName: opts.contentName,
        },
      },
    },
  ];
}

export type VoiceEngineDecision = {
  voiceEngine: CallAssistVoiceEngine;
  reason?: string;
  modelId?: string;
  novaSonicFallbackToLex: true;
  systemPrompt?: string;
};

/**
 * Nova 2 Sonic is off until an admin sets novaSonicEnabled.
 * Lex remains available on every call. A Nova stream error uses that fallback.
 *
 * agencyVoiceName — display name interpolated into the v2 system prompt
 * ({{agency.voice.name}} placeholder). Falls back to empty string which
 * formatCallAssistConversationalSystemPrompt normalises to "this agency".
 */
export function decideCallAssistVoiceEngine(input: {
  agencyId?: string | null;
  sessionId?: string | null;
  novaSonicEnabled?: boolean | null;
  agencyPrompt?: string | null;
  agencyVoiceName?: string | null;
  voiceId?: string | null;
}): VoiceEngineDecision {
  const fallback = { novaSonicFallbackToLex: true as const };
  if (!input.agencyId?.trim()) {
    return { voiceEngine: "LEX_POLLY", reason: "missing_params", ...fallback };
  }
  if (input.novaSonicEnabled !== true) {
    return { voiceEngine: "LEX_POLLY", reason: "not_enabled", ...fallback };
  }
  const systemPrompt = formatCallAssistConversationalSystemPrompt(input.agencyVoiceName ?? "");
  const agencyExtra = input.agencyPrompt?.trim();
  return {
    voiceEngine: "NOVA_SONIC",
    modelId: NOVA_2_SONIC_MODEL_ID,
    // v2 conversational prompt: correct opening-sequence rules, proactive confirmation
    // number generation, and the completion protocol. Replaces defaultNovaSonicSystemPrompt.
    systemPrompt: agencyExtra ? `${systemPrompt}\n\n${agencyExtra}` : systemPrompt,
    ...fallback,
  };
}

export function novaSonicAudioInputEvent(opts: {
  promptName: string;
  contentName: string;
  audioBase64: string;
}): NovaSonicSessionEvent {
  return {
    event: {
      audioInput: {
        promptName: opts.promptName,
        contentName: opts.contentName,
        content: opts.audioBase64,
      },
    },
  };
}

export type NovaSonicTurnResult = {
  audioChunks: string[];
  transcript: string;
  emergencyKeyword: string | null;
  fallbackReason: string | null;
};

/** Apply one model event. Emergency uses the existing Safety engine plus the extra phrases. */
export function consumeNovaSonicOutput(event: unknown, transcriptSoFar = ""): NovaSonicTurnResult {
  const empty = (transcript: string): NovaSonicTurnResult => ({
    audioChunks: [],
    transcript,
    emergencyKeyword: null,
    fallbackReason: null,
  });
  if (!event || typeof event !== "object") {
    return { ...empty(transcriptSoFar), fallbackReason: "malformed_event" };
  }
  const body = event as { event?: Record<string, unknown>; error?: string };
  if (typeof body.error === "string" && body.error.trim()) {
    return { ...empty(transcriptSoFar), fallbackReason: body.error };
  }
  const inner = body.event;
  if (!inner) return empty(transcriptSoFar);
  const audio = inner.audioOutput as { content?: string } | undefined;
  if (typeof audio?.content === "string" && audio.content) {
    return { ...empty(transcriptSoFar), audioChunks: [audio.content] };
  }
  const text = inner.textOutput as { content?: string } | undefined;
  if (typeof text?.content === "string" && text.content) {
    const transcript = `${transcriptSoFar}${text.content}`;
    return {
      audioChunks: [],
      transcript,
      emergencyKeyword: checkEmergencyKeywords(transcript),
      fallbackReason: null,
    };
  }
  return empty(transcriptSoFar);
}
