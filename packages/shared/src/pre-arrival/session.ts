import { z } from "zod";
import { activeStepSchema } from "./reconciliation-types.js";
import { etaNotificationRecordSchema } from "./eta-types.js";
import { responseIQModePolicySchema } from "./mode-policy.js";
import { responseIQInstructionSchema } from "./instructions.js";

export const preArrivalSessionStatusSchema = z.enum([
  "pending_send",
  "sms_sent",
  "opened",
  "active",
  "terminated",
  "ended",
  "failed",
]);
export type PreArrivalSessionStatus = z.infer<typeof preArrivalSessionStatusSchema>;

export const preArrivalResponderStatusSchema = z.enum([
  "dispatched",
  "responding",
  "arrived",
]);
export type PreArrivalResponderStatus = z.infer<typeof preArrivalResponderStatusSchema>;

/**
 * Dynamo item shape (logical). Physical keys:
 *   pk: AGENCY#{agencyId}
 *   sk: SESSION#{sessionToken}
 *   gsi1pk: INCIDENT#{incidentId}  (ByIncident)
 *   gsi1sk: SESSION#{sessionToken}
 */
export const preArrivalSessionSchema = z.object({
  sessionToken: z.string().min(8),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  callerPhoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),
  status: preArrivalSessionStatusSchema,
  cadNatureCode: z.string().min(1).default("UNKNOWN"),
  protocolId: z.string().optional(),
  instructionSource: z.enum(["agency_sop", "protocol_library", "generic"]).optional(),
  /** Active instruction steps (also mirrored as ActiveStep for reconciliation). */
  instructions: z.array(responseIQInstructionSchema).default([]),
  activeSteps: z.array(activeStepSchema).default([]),
  modePolicy: responseIQModePolicySchema.optional(),
  responderStatus: preArrivalResponderStatusSchema.default("dispatched"),
  publicUrl: z.string().url().optional(),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
  openedAt: z.string().min(20).optional(),
  endedAt: z.string().min(20).optional(),
  terminatedReason: z.string().max(256).optional(),
  createdByUserId: z.string().optional(),
  // ETA extension (same item)
  lastKnownEtaMinutes: z.number().optional(),
  lastEtaNotifiedAt: z.string().min(20).optional(),
  etaNotifications: z.array(etaNotificationRecordSchema).default([]),
  onSceneAt: z.string().min(20).optional(),
  ttl: z.number().int().optional(),
});
export type PreArrivalSession = z.infer<typeof preArrivalSessionSchema>;

export const createPreArrivalSessionBodySchema = z.object({
  incidentId: z.string().min(1),
  callerPhoneE164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  cadNatureCode: z.string().min(1).max(128).optional(),
  ttlMinutes: z.number().int().min(10).max(480).optional(),
  publicAppBaseUrl: z.string().url().optional(),
  modePolicy: responseIQModePolicySchema.optional(),
  sendSms: z.boolean().optional().default(true),
});
export type CreatePreArrivalSessionBody = z.infer<typeof createPreArrivalSessionBodySchema>;

export const completePreArrivalStepBodySchema = z.object({
  stepId: z.string().min(1),
});
export type CompletePreArrivalStepBody = z.infer<typeof completePreArrivalStepBodySchema>;

/** Public caller view — never includes unit IDs or dispatcher PII. */
export const preArrivalPublicViewSchema = z.object({
  sessionToken: z.string(),
  status: preArrivalSessionStatusSchema,
  cadNatureCode: z.string(),
  responderStatus: preArrivalResponderStatusSchema,
  stayOnLine: z.boolean(),
  showInstructions: z.boolean(),
  instructions: z.array(responseIQInstructionSchema),
  lastKnownEtaMinutes: z.number().nullable().optional(),
  onSceneAt: z.string().optional(),
  helpDispatchedAt: z.string().optional(),
});
export type PreArrivalPublicView = z.infer<typeof preArrivalPublicViewSchema>;

export function toPreArrivalPublicView(session: PreArrivalSession): PreArrivalPublicView {
  const policy = session.modePolicy;
  return {
    sessionToken: session.sessionToken,
    status: session.status,
    cadNatureCode: session.cadNatureCode,
    responderStatus: session.responderStatus,
    stayOnLine: policy?.stayOnLine ?? false,
    showInstructions: policy?.showInstructions ?? true,
    instructions: session.instructions,
    lastKnownEtaMinutes: session.lastKnownEtaMinutes ?? null,
    onSceneAt: session.onSceneAt,
    helpDispatchedAt: session.createdAt,
  };
}
