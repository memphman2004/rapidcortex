import { z } from "zod";
import { activeStepSchema } from "./reconciliation-types.js";
import { etaNotificationRecordSchema } from "./eta-types.js";
import {
  blurEstimatedArrivalMinutes,
  callerRouteProgress,
  classifyPreArrivalSessionMode,
  preArrivalSessionModeSchema,
  responseIQModePolicySchema,
} from "./mode-policy.js";
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
  /** Derived from the nature code. Not accepted from a dispatcher request body. */
  sessionMode: preArrivalSessionModeSchema.optional(),
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

/** Public caller view — never includes unit IDs, coordinates, or a precise ETA. */
export const preArrivalPublicViewSchema = z.object({
  sessionToken: z.string(),
  status: preArrivalSessionStatusSchema,
  sessionMode: z.enum(["STATUS_ONLY", "FULL"]),
  cadNatureCode: z.string(),
  responderStatus: preArrivalResponderStatusSchema,
  stayOnLine: z.boolean(),
  showInstructions: z.boolean(),
  instructions: z.array(responseIQInstructionSchema),
  etaRangeLow: z.number().int().optional(),
  etaRangeHigh: z.number().int().optional(),
  /** 0–1 progress along the response. Too coarse to recover a coordinate or exact minute. */
  routeProgress: z.number().min(0).max(1).optional(),
  onSceneAt: z.string().optional(),
  helpDispatchedAt: z.string().optional(),
  /** Caller may send text, photo, video, or location, and read dispatcher replies. */
  channelOpen: z.boolean(),
});
export type PreArrivalPublicView = z.infer<typeof preArrivalPublicViewSchema>;

export function toPreArrivalPublicView(session: PreArrivalSession): PreArrivalPublicView {
  const mode = session.sessionMode ?? classifyPreArrivalSessionMode(session.cadNatureCode);
  const disclosure = mode === "STATUS_ONLY" ? "STATUS_ONLY" : "FULL";
  const policy = session.modePolicy;
  const range =
    disclosure === "FULL" && session.responderStatus !== "arrived"
      ? blurEstimatedArrivalMinutes(session.lastKnownEtaMinutes ?? Number.NaN)
      : null;
  const visibleInstructions =
    disclosure === "FULL"
      ? session.instructions.filter((step) => step.status !== "SUSPENDED")
      : [];
  return {
    sessionToken: session.sessionToken,
    status: session.status,
    sessionMode: disclosure,
    cadNatureCode: disclosure === "FULL" ? session.cadNatureCode : "STATUS",
    responderStatus: session.responderStatus,
    stayOnLine: disclosure === "FULL" ? (policy?.stayOnLine ?? false) : false,
    showInstructions: disclosure === "FULL" && (policy?.showInstructions ?? true),
    instructions: visibleInstructions,
    etaRangeLow: range?.low,
    etaRangeHigh: range?.high,
    routeProgress:
      disclosure === "FULL"
        ? callerRouteProgress({
            responderStatus: session.responderStatus,
            etaMinutes: session.lastKnownEtaMinutes,
          })
        : undefined,
    onSceneAt: session.onSceneAt,
    helpDispatchedAt: session.createdAt,
    channelOpen: disclosure === "FULL" && session.status !== "ended" && session.status !== "terminated",
  };
}
