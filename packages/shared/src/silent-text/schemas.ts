import { z } from "zod";

/** Dispatcher-visible lifecycle for Silent Text / safety SMS sessions. */
export const silentTextSessionStatusSchema = z.enum([
  "pending_send",
  "sms_sent",
  "delivered",
  "opened",
  "active",
  "inactive",
  "ended",
  "failed",
  "canceled",
]);

export type SilentTextSessionStatus = z.infer<typeof silentTextSessionStatusSchema>;

export const silentTextEventTypeSchema = z.enum([
  "session.created",
  "token.issued",
  "sms.requested",
  "sms.logged",
  "link.opened",
  "message.caller",
  "message.dispatcher",
  "presence.caller",
  "presence.dispatcher",
  "session.marked_high_risk",
  "session.inactive_timeout",
  "session.closed",
  "session.canceled",
  "session.ended_by_caller",
]);

export type SilentTextEventType = z.infer<typeof silentTextEventTypeSchema>;

export const silentTextSessionEventSchema = z.object({
  at: z.string().min(20),
  type: silentTextEventTypeSchema,
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type SilentTextSessionEvent = z.infer<typeof silentTextSessionEventSchema>;

export const silentTextMessageSchema = z.object({
  messageId: z.string(),
  at: z.string().min(20),
  from: z.enum(["caller", "dispatcher"]),
  body: z.string().min(1).max(4000),
  /** When dispatcher sent a saved template line. */
  promptTemplateId: z.string().max(64).optional(),
  /** English text for dispatchers when the caller wrote in another language. */
  translatedForDispatcher: z.string().max(4000).optional(),
  /** Localized text for the caller when the dispatcher line was translated from English. */
  translatedForCaller: z.string().max(4000).optional(),
  /**
   * Private S3 key under the assets (or TTS) bucket for synthesized audio (`multilingual-tts/...`).
   * No public URL; use short-lived access patterns when exposing audio.
   */
  ttsObjectKey: z.string().max(512).optional(),
});

export type SilentTextMessage = z.infer<typeof silentTextMessageSchema>;

export const createSilentTextSessionBodySchema = z.object({
  callerPhoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  ttlMinutes: z.number().int().min(10).max(480).optional(),
  callerLocale: z.string().max(16).optional(),
  publicAppBaseUrl: z.string().url().optional(),
  /** When true, caller UI may use a more discreet visual mode where policy allows. */
  stealthAppearance: z.boolean().optional(),
  /** Dispatcher marks elevated handling (supervisor visibility, etc.). */
  highRisk: z.boolean().optional(),
});

export type CreateSilentTextSessionBody = z.infer<typeof createSilentTextSessionBodySchema>;

export const postSilentTextMessageBodySchema = z.object({
  text: z.string().min(1).max(4000),
  promptTemplateId: z.string().max(64).optional(),
  client: z
    .object({
      userAgent: z.string().max(512).optional(),
      language: z.string().max(32).optional(),
    })
    .optional(),
});

export type PostSilentTextMessageBody = z.infer<typeof postSilentTextMessageBodySchema>;

export const silentTextPresenceBodySchema = z.object({
  surface: z.enum(["caller_web", "dispatcher_console"]).optional(),
});

export type SilentTextPresenceBody = z.infer<typeof silentTextPresenceBodySchema>;

/** Public session snapshot (no secrets). */
export const silentTextPublicSessionSchema = z.object({
  sessionId: z.string(),
  incidentId: z.string(),
  status: silentTextSessionStatusSchema,
  expiresAt: z.string(),
  callerLocale: z.string().optional(),
  stealthAppearance: z.boolean(),
  highRisk: z.boolean(),
  lastActivityAt: z.string(),
  lastCallerPresenceAt: z.string().nullable().optional(),
  lastDispatcherPresenceAt: z.string().nullable().optional(),
  messages: z.array(silentTextMessageSchema),
});

export type SilentTextPublicSession = z.infer<typeof silentTextPublicSessionSchema>;

export const silentTextDispatcherSessionSchema = silentTextPublicSessionSchema.extend({
  agencyId: z.string(),
  callerPhoneE164: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  smsSentAt: z.string().nullable().optional(),
  openedAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  canceledAt: z.string().nullable().optional(),
  closedBySub: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  events: z.array(silentTextSessionEventSchema).optional(),
});

export type SilentTextDispatcherSession = z.infer<typeof silentTextDispatcherSessionSchema>;
