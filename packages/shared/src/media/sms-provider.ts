import { z } from "zod";

/** How the API chooses an SMS channel for incident media links (e.g. env `SMS_PROVIDER`). */
export const smsProviderModeSchema = z.enum(["aws", "twilio", "auto", "mock"]);
export type SmsProviderMode = z.infer<typeof smsProviderModeSchema>;

/**
 * Name of the effective routing or concrete provider.
 * (Alias for `SmsProviderMode` — `auto` is a routing mode, not a concrete send channel.)
 */
export type SmsProviderName = SmsProviderMode;

/** High-level SMS purpose for logging and policy (not shown to carriers). */
export const smsMessageTypeSchema = z.enum([
  "media_upload",
  "live_video",
  "pinpoint_location",
  "silent_text",
]);
export type SmsMessageType = z.infer<typeof smsMessageTypeSchema>;

/** In `auto` mode, which concrete provider to try first; secondary is the other (env `SMS_PRIMARY_PROVIDER`). */
export const smsPrimaryProviderSchema = z.enum(["twilio", "aws"]);
export type SmsPrimaryProvider = z.infer<typeof smsPrimaryProviderSchema>;

/** Concrete provider used for a single send attempt (excludes routing mode `auto`). */
export const smsSendResultProviderSchema = z.enum(["aws", "twilio", "mock", "log-only"]);
export type SmsSendResultProvider = z.infer<typeof smsSendResultProviderSchema>;

export const smsSendStatusSchema = z.enum(["queued", "sent", "failed"]);
export type SmsSendStatus = z.infer<typeof smsSendStatusSchema>;

/** Normalized classification for failover decisions. */
export const retryableSmsErrorSchema = z.object({
  /** Whether `auto` mode may try the other concrete provider. */
  retryable: z.boolean(),
  errorCode: z.string().max(64).optional(),
  errorMessage: z.string().max(500).optional(),
  /** Which side produced this (first or second attempt in auto). */
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
  /** True when `auto` mode succeeded on the second concrete provider. */
  smsFailoverUsed: z.boolean().optional(),
  /** Set when a first attempt was made in `auto` and failed. */
  firstAttemptProvider: smsSendResultProviderSchema.optional(),
  /** Error code from the first attempt in `auto` (not sent on success of first). */
  firstAttemptErrorCode: z.string().max(64).optional(),
});

export type SmsSendResult = z.infer<typeof smsSendResultSchema>;

export function redactE164Phone(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length <= 4) return "****";
  return `***${digits.slice(-4)}`;
}
