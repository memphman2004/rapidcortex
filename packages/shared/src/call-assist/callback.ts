import { z } from "zod";

export const CALL_ASSIST_CALLBACK_STATUSES = [
  "OFFERED",
  "QUEUED",
  "DIALING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "TAKEN_OVER",
  "DECLINED",
] as const;
export type CallAssistCallbackStatus = (typeof CALL_ASSIST_CALLBACK_STATUSES)[number];

export const CALL_ASSIST_CALLBACK_FAILURE_REASONS = [
  "no_answer",
  "busy",
  "invalid_number",
  "max_attempts",
  "caller_declined",
  "connect_unconfigured",
  "outbound_failed",
] as const;
export type CallAssistCallbackFailureReason = (typeof CALL_ASSIST_CALLBACK_FAILURE_REASONS)[number];

export const callAssistCallbackSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  retryMinutes: z.number().int().min(1).max(240).default(15),
  offerAfterHours: z.boolean().default(true),
  offerOnOverflow: z.boolean().default(true),
});
export type CallAssistCallbackSettings = z.infer<typeof callAssistCallbackSettingsSchema>;

export const DEFAULT_CALL_ASSIST_CALLBACK_SETTINGS: CallAssistCallbackSettings = {
  enabled: true,
  maxAttempts: 3,
  retryMinutes: 15,
  offerAfterHours: true,
  offerOnOverflow: true,
};

export function normalizeCallbackSettings(
  input?: Partial<CallAssistCallbackSettings> | null,
): CallAssistCallbackSettings {
  const parsed = callAssistCallbackSettingsSchema.safeParse(input ?? {});
  return parsed.success ? parsed.data : DEFAULT_CALL_ASSIST_CALLBACK_SETTINGS;
}

export const callAssistCallbackAttemptSchema = z.object({
  attempt: z.number().int().min(1),
  at: z.string().min(1),
  result: z.enum(["queued", "dialing", "no_answer", "busy", "connected", "failed", "taken_over"]),
  reason: z.string().max(200).optional(),
  contactId: z.string().max(128).optional(),
});
export type CallAssistCallbackAttempt = z.infer<typeof callAssistCallbackAttemptSchema>;

export const callAssistCallbackCampaignSchema = z.object({
  callbackId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  status: z.enum(CALL_ASSIST_CALLBACK_STATUSES),
  phoneE164: z.string().min(7).max(32),
  attempts: z.array(callAssistCallbackAttemptSchema).max(20).default([]),
  maxAttempts: z.number().int().min(1).max(10),
  retryMinutes: z.number().int().min(1).max(240),
  dueAt: z.string().min(1),
  offeredAt: z.string().min(1),
  queuedAt: z.string().optional(),
  completedAt: z.string().optional(),
  failureReason: z.enum(CALL_ASSIST_CALLBACK_FAILURE_REASONS).optional(),
  takenOverBy: z.string().max(128).optional(),
  takenOverAt: z.string().optional(),
  lastError: z.string().max(300).optional(),
});
export type CallAssistCallbackCampaign = z.infer<typeof callAssistCallbackCampaignSchema>;

const CALLBACK_REQUEST_RE =
  /\b(call me back|call back|callback|ring me back|can you call (me )?later|have someone call)\b/i;
const ACCEPT_RE = /\b(yes|yeah|yep|please|ok|okay|sure|go ahead|do it|call me)\b/i;
const DECLINE_RE = /\b(no|nope|don't|do not|not now|never mind|cancel)\b/i;

export function callerRequestedCallback(utterance: string): boolean {
  return CALLBACK_REQUEST_RE.test(utterance ?? "");
}

export function callerAcceptedOffer(utterance: string): boolean {
  const text = utterance ?? "";
  if (DECLINE_RE.test(text) && !ACCEPT_RE.test(text)) return false;
  return ACCEPT_RE.test(text);
}

export function callerDeclinedOffer(utterance: string): boolean {
  const text = utterance ?? "";
  if (ACCEPT_RE.test(text) && !DECLINE_RE.test(text)) return false;
  return DECLINE_RE.test(text);
}

export function shouldOfferCallback(opts: {
  settings: CallAssistCallbackSettings;
  hoursOpen: boolean;
  mode: string;
  utterance: string;
  alreadyOffered: boolean;
  emergencyDetected: boolean;
}): boolean {
  if (!opts.settings.enabled || opts.alreadyOffered || opts.emergencyDetected) return false;
  if (callerRequestedCallback(opts.utterance)) return true;
  if (opts.settings.offerAfterHours && !opts.hoursOpen) return true;
  if (opts.settings.offerOnOverflow && opts.mode === "OVERFLOW") return true;
  return false;
}

export function nextCallbackDueAt(retryMinutes: number, fromMs = Date.now()): string {
  return new Date(fromMs + Math.max(1, retryMinutes) * 60_000).toISOString();
}

export function callbackAttemptsRemaining(campaign: Pick<CallAssistCallbackCampaign, "attempts" | "maxAttempts">): number {
  return Math.max(0, campaign.maxAttempts - campaign.attempts.length);
}

export function callbackIsDue(campaign: Pick<CallAssistCallbackCampaign, "status" | "dueAt">, nowMs = Date.now()): boolean {
  if (campaign.status !== "QUEUED") return false;
  const due = Date.parse(campaign.dueAt);
  return Number.isFinite(due) && due <= nowMs;
}

export function applyCallbackAttempt(
  campaign: CallAssistCallbackCampaign,
  attempt: CallAssistCallbackAttempt,
  nowIso: string,
): CallAssistCallbackCampaign {
  const attempts = [...campaign.attempts, attempt];
  if (attempt.result === "connected") {
    return { ...campaign, attempts, status: "IN_PROGRESS", lastError: undefined };
  }
  if (attempt.result === "taken_over") {
    return {
      ...campaign,
      attempts,
      status: "TAKEN_OVER",
      takenOverAt: nowIso,
      completedAt: nowIso,
    };
  }
  if (attempts.length >= campaign.maxAttempts) {
    return {
      ...campaign,
      attempts,
      status: "FAILED",
      failureReason: "max_attempts",
      completedAt: nowIso,
      lastError: attempt.reason,
    };
  }
  return {
    ...campaign,
    attempts,
    status: "QUEUED",
    dueAt: nextCallbackDueAt(campaign.retryMinutes, Date.parse(nowIso) || Date.now()),
    lastError: attempt.reason,
  };
}

export const callAssistCallbackOfferBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  phoneE164: z.string().min(7).max(32).optional(),
});

export const callAssistCallbackDecisionBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
  accept: z.boolean(),
});

export const callAssistCallbackTakeoverBodySchema = z.object({
  sessionId: z.string().min(1).max(128),
});
