import { z } from "zod";

/** How the API chooses an SMS channel (env `SMS_PROVIDER`). Legacy `twilio` / `auto` map to `aws` at runtime. */
export const smsProviderModeSchema = z.enum(["aws", "mock"]);
export type SmsProviderMode = z.infer<typeof smsProviderModeSchema>;

/**
 * Name of the effective routing or concrete provider.
 * (Alias for `SmsProviderMode`.)
 */
export type SmsProviderName = SmsProviderMode;

/** High-level SMS purpose for logging and policy (not shown to carriers). */
export const smsMessageTypeSchema = z.enum([
  "media_upload",
  "live_video",
  "pinpoint_location",
  "silent_text",
  "sms_location",
  "call_assist_self_service",
  "translate_session_link",
]);
export type SmsMessageType = z.infer<typeof smsMessageTypeSchema>;

/** Concrete provider used for a single send attempt. `twilio` is retained only for historical Dynamo rows. */
export const smsSendResultProviderSchema = z.enum(["aws", "twilio", "mock", "log-only"]);
export type SmsSendResultProvider = z.infer<typeof smsSendResultProviderSchema>;

export const smsSendStatusSchema = z.enum(["queued", "sent", "failed"]);
export type SmsSendStatus = z.infer<typeof smsSendStatusSchema>;

/** Normalized classification for send errors. */
export const retryableSmsErrorSchema = z.object({
  retryable: z.boolean(),
  errorCode: z.string().max(64).optional(),
  errorMessage: z.string().max(500).optional(),
  provider: smsSendResultProviderSchema.optional(),
});

export type RetryableSmsError = z.infer<typeof retryableSmsErrorSchema>;

export const smsSendResultSchema = z.object({
  provider: smsSendResultProviderSchema,
  messageId: z.string().max(128).optional(),
  status: smsSendStatusSchema,
  errorCode: z.string().max(64).optional(),
  errorMessage: z.string().max(500).optional(),
  /** Last four digits or similar; never full E.164 in logs/API payloads. */
  recipientRedacted: z.string().min(1).max(32),
  sentAt: z.string().min(1),
  retryable: z.boolean().optional(),
  /** Legacy field from dual-provider routing; new sends leave this unset. */
  smsFailoverUsed: z.boolean().optional(),
  firstAttemptProvider: smsSendResultProviderSchema.optional(),
  firstAttemptErrorCode: z.string().max(64).optional(),
});

export type SmsSendResult = z.infer<typeof smsSendResultSchema>;

export function redactE164Phone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `***${digits.slice(-4)}`;
}
