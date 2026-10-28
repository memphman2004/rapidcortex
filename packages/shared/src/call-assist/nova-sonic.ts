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
export function novaSonicLexVoiceId(locale: string): "matthew" | "lupe" | null {
  if (locale === "en_US" || locale === "en-US") return "matthew";
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

export function defaultNovaSonicSystemPrompt(agencyAppend?: string | null): string {
  const base = systemPromptForAgency(agencyAppend);
  return `${base}

You answer this call. Your first spoken words are exactly:
"${NEXIQ_OPENING_GREETING}"
Say that once, then listen and finish the report yourself.
When the caller gives a street address, repeat that address back once and ask if it is right before you continue.
Stay on the line until you do one of these two things:
- Tell the caller their report number, using the exact number you were given.
- Tell the caller you are transferring them, then stop talking.
Do not end the call before one of those. You are not a 911 dispatcher. If you detect immediate danger to life, fire, a medical emergency, or a violent crime, say "I'm transferring you to emergency services now" and stop.`;
}

export type NovaSonicSessionEvent = {
  event: Record<string, unknown>;
};

export function novaSonicOpeningEvents(opts: {
  promptName: string;
  contentName: string;
  voiceId?: string;
  systemPrompt: string;
}): NovaSonicSessionEvent[] {
  const voiceId = opts.voiceId?.trim() || "matthew";
  return [
    {
      event: {
        sessionStart: {
          inferenceConfiguration: { maxTokens: 1024, topP: 0.9, temperature: 0.7 },
          turnDetectionConfiguration: { endpointingSensitivity: "HIGH" },
        },
      },
    },
    {
      event: {
        promptStart: {
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
        },
      },
    },
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
 */
export function decideCallAssistVoiceEngine(input: {
  agencyId?: string | null;
  sessionId?: string | null;
  novaSonicEnabled?: boolean | null;
  agencyPrompt?: string | null;
  voiceId?: string | null;
}): VoiceEngineDecision {
  const fallback = { novaSonicFallbackToLex: true as const };
  if (!input.agencyId?.trim()) {
    return { voiceEngine: "LEX_POLLY", reason: "missing_params", ...fallback };
  }
  if (input.novaSonicEnabled !== true) {
    return { voiceEngine: "LEX_POLLY", reason: "not_enabled", ...fallback };
  }
  return {
    voiceEngine: "NOVA_SONIC",
    modelId: NOVA_2_SONIC_MODEL_ID,
    systemPrompt: defaultNovaSonicSystemPrompt(input.agencyPrompt),
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
