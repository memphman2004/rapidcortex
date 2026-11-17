import { z } from "zod";

export const CALL_ASSIST_CALL_STATUSES = [
  // --- original statuses (never remove) ---
  "OPEN",
  "ROUTED",
  "ACKNOWLEDGED",
  "CLOSED",
  "ESCALATED",
  "DUPLICATE",
  // --- Phase 1 lifecycle additions ---
  "IN_PROGRESS",
  "CANCELLED",
  "AWAITING_INFORMATION",
  "PENDING_REOPEN",
] as const;
export type CallAssistCallStatus = (typeof CALL_ASSIST_CALL_STATUSES)[number];

/** Terminal statuses — a record in one of these states cannot be reopened. */
export const CALL_ASSIST_TERMINAL_STATUSES: ReadonlySet<CallAssistCallStatus> = new Set([
  "CLOSED",
  "CANCELLED",
  "DUPLICATE",
]);

/**
 * Who/what triggered a status change. Never log PII here — use updatedBy category strings only.
 */
export const CASE_LIFECYCLE_UPDATED_BY = {
  NEXIQ_VOICE: "NEXIQ_VOICE",
  RESIDENT_VOICE: "RESIDENT_VOICE",
  NEXIQ_TRANSFER: "NEXIQ_TRANSFER",
  NEXIQ_NOTIFY: "NEXIQ_NOTIFY",
  SYSTEM: "SYSTEM",
  /** Prefix for staff updates — concatenate userId at call site: `STAFF_${userId}` */
  STAFF_PREFIX: "STAFF_",
} as const;

export const statusHistoryEntrySchema = z.object({
  at: z.string().min(1),
  status: z.string().min(1).max(64),
  note: z.string().max(500).optional(),
  updatedBy: z.string().min(1).max(128),
});
export type StatusHistoryEntry = z.infer<typeof statusHistoryEntrySchema>;

export const callAssistRoutingEventSchema = z.object({
  at: z.string().min(1),
  action: z.string().min(1).max(64),
  departmentId: z.string().max(64).optional(),
  ruleId: z.string().max(64).optional(),
  detail: z.string().max(500).optional(),
});
export type CallAssistRoutingEvent = z.infer<typeof callAssistRoutingEventSchema>;

export const callAssistCallRecordSchema = z.object({
  confirmationNumber: z.string().min(5).max(64),
  agencyId: z.string().min(1).max(128),
  callId: z.string().max(128).optional(),
  sessionId: z.string().min(1).max(128),
  callerNumber: z.string().max(32).optional(),
  callbackNumber: z.string().max(32).optional(),
  incidentType: z.string().max(128).optional(),
  incidentLocation: z.string().max(500).optional(),
  district: z.string().max(128).optional(),
  department: z.string().max(128).optional(),
  status: z.enum(CALL_ASSIST_CALL_STATUSES),
  aiTranscript: z.string().max(100_000).optional(),
  emergencyFlag: z.boolean().default(false),
  routingLog: z.array(callAssistRoutingEventSchema).default([]),
  matchedRuleId: z.string().max(64).optional(),
  slaMinutes: z.number().int().min(1).max(24 * 60).optional(),
  dangerScore: z.number().min(0).max(1).optional(),
  deliveryMethods: z.array(z.string().max(32)).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  expiresAt: z.number().optional(),
  // --- Phase 1 lifecycle additions (all optional — backward-compatible) ---
  /** Immutable ordered log of status transitions. Append-only via lifecycle ops. */
  statusHistory: z.array(statusHistoryEntrySchema).optional(),
  /** Lowercase normalized address for near-duplicate detection. */
  addressLower: z.string().max(500).optional(),
  /** Whether the citizen opted in to proactive status SMS. */
  notifyOptIn: z.boolean().optional(),
  /** E.164 destination for lifecycle SMS (may differ from ANI). */
  notifyPhone: z.string().max(32).optional(),
  /** Notification channel. Currently only 'sms'. */
  notifyChannel: z.enum(["sms"]).optional(),
  /** Work order ID from an external system (Cityworks, GovQA, etc.). Never spoken. */
  externalWorkOrderId: z.string().max(256).optional(),
  /** Number of times this record has been escalated. Enforces 1-per-24h cap. */
  escalationCount: z.number().int().min(0).optional(),
  /** ISO timestamp of most recent escalation for 24-hour cap enforcement. */
  lastEscalatedAt: z.string().optional(),
  /** Set true by voice/SMS when caller explicitly requested human follow-up. */
  humanFollowUpRequested: z.boolean().optional(),
});
export type CallAssistCallRecord = z.infer<typeof callAssistCallRecordSchema>;

export function callAssistConfirmSk(confirmationNumber: string): string {
  return `CONFIRM#${confirmationNumber.trim().toUpperCase()}`;
}

export function callAssistAgencyDateGsi(agencyId: string, createdAtIso: string, confirmationNumber: string) {
  const day = createdAtIso.slice(0, 10);
  return {
    gsi1pk: `AGENCY#${agencyId}`,
    gsi1sk: `DATE#${day}#CONFIRM#${confirmationNumber.trim().toUpperCase()}`,
  };
}

export function callAssistCallerGsi(callerNumber: string | undefined, createdAtIso: string) {
  const num = callerNumber?.trim();
  if (!num) return {};
  return {
    gsi2pk: `CALLER#${num}`,
    gsi2sk: `CREATED#${createdAtIso}`,
  };
}

/** Seven-year TTL epoch seconds for government retention. */
export function callAssistSevenYearTtl(from = new Date()): number {
  return Math.floor(from.getTime() / 1000) + 7 * 365 * 24 * 60 * 60;
}
