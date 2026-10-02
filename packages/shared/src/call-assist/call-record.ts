import { z } from "zod";

export const CALL_ASSIST_CALL_STATUSES = [
  "OPEN",
  "ROUTED",
  "ACKNOWLEDGED",
  "CLOSED",
  "ESCALATED",
  "DUPLICATE",
] as const;
export type CallAssistCallStatus = (typeof CALL_ASSIST_CALL_STATUSES)[number];

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
