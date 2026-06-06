import { z } from "zod";

export const callTransferMethodSchema = z.enum(["notification", "deeplink", "api"]);
export type CallTransferMethod = z.infer<typeof callTransferMethodSchema>;

export const callTransferStatusSchema = z.enum([
  "pending",
  "accepted",
  "declined",
  "timeout",
  "completed",
  "failed",
]);
export type CallTransferStatus = z.infer<typeof callTransferStatusSchema>;

export const activeCallStatusSchema = z.enum([
  "ringing",
  "connected",
  "on-hold",
  "transferring",
  "ended",
]);
export type ActiveCallStatus = z.infer<typeof activeCallStatusSchema>;

export const pendingTransferSchema = z.object({
  transferId: z.string().min(1),
  targetUserId: z.string().min(1),
  targetUsername: z.string().min(1),
  fromUserId: z.string().min(1),
  fromUsername: z.string().min(1),
  initiatedBy: z.string().min(1),
  initiatedAt: z.string().min(1),
  method: callTransferMethodSchema,
  status: callTransferStatusSchema,
  reason: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type PendingTransfer = z.infer<typeof pendingTransferSchema>;

export const activeCallRecordSchema = z.object({
  callId: z.string().min(1),
  agencyId: z.string().min(1),
  incidentId: z.string().optional(),
  callerPhone: z.string().min(1),
  callerAddress: z.string().optional(),
  status: activeCallStatusSchema,
  currentHandlerUserId: z.string().min(1),
  currentHandlerUsername: z.string().min(1),
  startTime: z.string().min(1),
  updatedAt: z.string().min(1),
  durationSeconds: z.number().int().nonnegative().optional(),
  pendingTransfer: pendingTransferSchema.optional(),
});

export type ActiveCallRecord = z.infer<typeof activeCallRecordSchema>;

export const transferCallBodySchema = z.object({
  callId: z.string().min(1),
  targetUserId: z.string().min(1),
  targetUsername: z.string().min(1).optional(),
  reason: z.string().max(500).optional(),
  /** When the call row does not exist yet (pilot / manual registration). */
  callerPhone: z.string().min(3).optional(),
  incidentId: z.string().optional(),
  fromUserId: z.string().min(1).optional(),
  fromUsername: z.string().min(1).optional(),
});

export type TransferCallBody = z.infer<typeof transferCallBodySchema>;

export const takeoverCallBodySchema = z.object({
  callId: z.string().min(1),
  reason: z.string().max(500).optional(),
  callerPhone: z.string().min(3).optional(),
  incidentId: z.string().optional(),
});

export type TakeoverCallBody = z.infer<typeof takeoverCallBodySchema>;

export const callIdBodySchema = z.object({
  callId: z.string().min(1),
});

export type CallIdBody = z.infer<typeof callIdBodySchema>;

export const activeCallsListResponseSchema = z.object({
  items: z.array(activeCallRecordSchema),
});

export type ActiveCallsListResponse = z.infer<typeof activeCallsListResponseSchema>;

export const transferCallResponseSchema = z.object({
  success: z.boolean(),
  transferId: z.string(),
  method: callTransferMethodSchema,
  message: z.string(),
  requiresManualAction: z.boolean(),
});

export type TransferCallResponse = z.infer<typeof transferCallResponseSchema>;
