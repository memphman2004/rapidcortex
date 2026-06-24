import { z } from "zod";

/** Dispatcher English → caller language playback on the live voice path (telephony adapter). */
export const voiceBridgeOutboundBodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
  /** Defaults to incident `callerLanguage` when omitted. */
  targetLanguage: z.string().min(2).max(16).optional(),
  /** Active call row from call-control (when bridged to SBC). */
  callId: z.string().min(1).max(120).optional(),
  /** Optional language session correlation id. */
  sessionId: z.string().min(1).max(120).optional(),
});

export type VoiceBridgeOutboundBody = z.infer<typeof voiceBridgeOutboundBodySchema>;

export const voiceBridgeOutboundResponseSchema = z.object({
  deliveryId: z.string(),
  targetLanguage: z.string(),
  translatedText: z.string(),
  englishText: z.string(),
  deliveryMode: z.enum(["mock", "webhook", "text_only"]),
  audioObjectKey: z.string().optional(),
  telephonyStatus: z.enum(["queued", "sent", "skipped"]),
});

export type VoiceBridgeOutboundResponse = z.infer<typeof voiceBridgeOutboundResponseSchema>;
