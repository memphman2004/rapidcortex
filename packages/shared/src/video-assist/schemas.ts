import { z } from "zod";

/** Dispatcher-visible lifecycle for Caller Video Assist. */
export const videoAssistSessionStatusSchema = z.enum([
  "pending_send",
  "sms_sent",
  "delivered",
  "opened",
  "consent_pending",
  "permission_pending",
  "connecting",
  "live",
  "paused",
  "ended",
  "failed",
  "canceled",
]);

export type VideoAssistSessionStatus = z.infer<typeof videoAssistSessionStatusSchema>;

export const videoAssistEventTypeSchema = z.enum([
  "session.created",
  "token.issued",
  "sms.requested",
  "sms.logged",
  "link.opened",
  "consent.recorded",
  "stream.permission_prompted",
  "stream.started",
  "stream.paused",
  "stream.ended",
  "session.canceled",
  "signal.dispatcher_answer",
  "signal.caller_offer",
  "ice.caller",
  "ice.dispatcher",
  "photo.fallback_used",
  "viewer.joined",
  "viewer.left",
  "note.appended",
]);

export type VideoAssistEventType = z.infer<typeof videoAssistEventTypeSchema>;

export const videoAssistSessionEventSchema = z.object({
  at: z.string().min(20),
  type: videoAssistEventTypeSchema,
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type VideoAssistSessionEvent = z.infer<typeof videoAssistSessionEventSchema>;

export const createVideoAssistSessionBodySchema = z.object({
  /** E.164 phone number for SMS (e.g. +15551234567). */
  callerPhoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  /** Minutes until token expires (default 60). */
  ttlMinutes: z.number().int().min(5).max(240).optional(),
  /** Optional locale for caller page copy (e.g. es, en). */
  callerLocale: z.string().max(16).optional(),
  /** Base URL for the caller link (https://www.example.com). Must match deployment. */
  publicAppBaseUrl: z.string().url().optional(),
});

export type CreateVideoAssistSessionBody = z.infer<typeof createVideoAssistSessionBodySchema>;

export const videoAssistSignalBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("caller-offer"),
    sdp: z.string().min(10),
  }),
  z.object({
    kind: z.literal("dispatcher-answer"),
    sdp: z.string().min(10),
  }),
  z.object({
    kind: z.literal("ice-caller"),
    candidate: z.string().min(1),
  }),
  z.object({
    kind: z.literal("ice-dispatcher"),
    candidate: z.string().min(1),
  }),
]);

export type VideoAssistSignalBody = z.infer<typeof videoAssistSignalBodySchema>;

export const videoAssistConsentBodySchema = z.object({
  acknowledged: z.literal(true),
  /** Optional client metadata (user agent, coarse locale). */
  client: z
    .object({
      userAgent: z.string().max(512).optional(),
      language: z.string().max(32).optional(),
    })
    .optional(),
});

export type VideoAssistConsentBody = z.infer<typeof videoAssistConsentBodySchema>;

/** Public session snapshot (no secrets). */
export const videoAssistPublicSessionSchema = z.object({
  sessionId: z.string(),
  incidentId: z.string(),
  status: videoAssistSessionStatusSchema,
  expiresAt: z.string(),
  /** When true, caller may request microphone in addition to camera. */
  allowMicrophone: z.boolean(),
  /** Locale hint for caller UI. */
  callerLocale: z.string().optional(),
  /** SDP offer from caller when present (for dispatcher polling). */
  callerOfferSdp: z.string().nullable().optional(),
  /** SDP answer from dispatcher when present (for caller polling). */
  dispatcherAnswerSdp: z.string().nullable().optional(),
  /** Recent ICE candidates from dispatcher (JSON strings). */
  iceDispatcher: z.array(z.string()).optional(),
  /** Recent ICE candidates from caller. */
  iceCaller: z.array(z.string()).optional(),
});

export type VideoAssistPublicSession = z.infer<typeof videoAssistPublicSessionSchema>;

/** Full dispatcher-facing session row (subset for API responses). */
export const videoAssistDispatcherSessionSchema = videoAssistPublicSessionSchema.extend({
  agencyId: z.string(),
  callerPhoneE164: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  smsSentAt: z.string().nullable().optional(),
  consentAt: z.string().nullable().optional(),
  openedAt: z.string().nullable().optional(),
  streamStartedAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  canceledAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  events: z.array(videoAssistSessionEventSchema).optional(),
});

export type VideoAssistDispatcherSession = z.infer<typeof videoAssistDispatcherSessionSchema>;
