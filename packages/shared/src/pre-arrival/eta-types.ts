import { z } from "zod";

export const etaNotificationTriggerSchema = z.enum([
  "unit_dispatched",
  "eta_updated",
  "arriving_now",
  "on_scene",
  "dispatcher_manual",
]);
export type EtaNotificationTrigger = z.infer<typeof etaNotificationTriggerSchema>;

export const etaNotificationRecordSchema = z.object({
  notificationId: z.string().min(1),
  trigger: etaNotificationTriggerSchema,
  etaMinutes: z.number().nullable(),
  unitId: z.string().max(64).optional(),
  sentAt: z.string().min(20),
  messageBody: z.string().min(1).max(1600),
  acknowledged: z.boolean(),
});
export type EtaNotificationRecord = z.infer<typeof etaNotificationRecordSchema>;

/** ETA fields stored on the same PreArrivalSession Dynamo item. */
export const etaSessionExtensionSchema = z.object({
  lastKnownEtaMinutes: z.number().optional(),
  lastEtaNotifiedAt: z.string().min(20).optional(),
  etaNotifications: z.array(etaNotificationRecordSchema).default([]),
  onSceneAt: z.string().min(20).optional(),
});
export type EtaSessionExtension = z.infer<typeof etaSessionExtensionSchema>;

export const unitEtaEventSchema = z.object({
  incidentId: z.string().min(1),
  agencyId: z.string().min(1),
  unitId: z.string().min(1),
  etaMinutes: z.number(),
  trigger: etaNotificationTriggerSchema,
  timestamp: z.string().min(20),
});
export type UnitEtaEvent = z.infer<typeof unitEtaEventSchema>;

export const dispatcherEtaUpdateSchema = z.object({
  etaMinutes: z.number().min(0).max(240),
  note: z.string().max(500).optional(),
  dispatcherId: z.string().min(1),
});
export type DispatcherEtaUpdate = z.infer<typeof dispatcherEtaUpdateSchema>;
