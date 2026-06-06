import { z } from "zod";

export const slaPrioritySchema = z.enum(["P1", "P2", "P3", "P4"]);
export type SlaPriority = z.infer<typeof slaPrioritySchema>;

export const slaLevelStatusSchema = z.enum(["ok", "warning", "breached"]);
export type SlaLevelStatus = z.infer<typeof slaLevelStatusSchema>;

export const dispatchSlaStatusSchema = z.enum(["ok", "warning", "breached", "pending"]);
export type DispatchSlaStatus = z.infer<typeof dispatchSlaStatusSchema>;

export const slaThresholdSchema = z.object({
  priority: slaPrioritySchema,
  targetAnswerSeconds: z.number().int().positive(),
  targetDispatchSeconds: z.number().int().positive(),
  warningPct: z.number().min(0).max(1),
});

export type SlaThreshold = z.infer<typeof slaThresholdSchema>;

export const slaStatusSchema = z.object({
  incidentId: z.string().min(1),
  priority: slaPrioritySchema,
  callReceivedAt: z.string().datetime(),
  answeredAt: z.string().datetime().optional(),
  unitDispatchedAt: z.string().datetime().optional(),
  answerElapsedSeconds: z.number().nonnegative(),
  dispatchElapsedSeconds: z.number().nonnegative().optional(),
  answerSlaStatus: slaLevelStatusSchema,
  dispatchSlaStatus: dispatchSlaStatusSchema,
});

export type SlaStatus = z.infer<typeof slaStatusSchema>;

export const backlogSnapshotSchema = z.object({
  agencyId: z.string().min(1),
  snapshotAt: z.string().datetime(),
  queueDepth: z.number().int().nonnegative(),
  p1Count: z.number().int().nonnegative(),
  p2Count: z.number().int().nonnegative(),
  p3Count: z.number().int().nonnegative(),
  avgWaitSeconds: z.number().nonnegative(),
  slaBreachCount: z.number().int().nonnegative(),
  slaWarningCount: z.number().int().nonnegative(),
});

export type BacklogSnapshot = z.infer<typeof backlogSnapshotSchema>;

export const slaStatusListResponseSchema = z.object({
  items: z.array(slaStatusSchema),
});

export const slaThresholdsResponseSchema = z.object({
  thresholds: z.array(slaThresholdSchema),
});

export const putSlaThresholdsBodySchema = z.object({
  thresholds: z.array(slaThresholdSchema).min(1).max(4),
});

export type PutSlaThresholdsBody = z.infer<typeof putSlaThresholdsBodySchema>;

export const slaHistoryQuerySchema = z.object({
  period: z.enum(["24h", "7d"]).default("24h"),
});

export const slaHistoryResponseSchema = z.object({
  items: z.array(backlogSnapshotSchema),
});

export const DEFAULT_SLA_THRESHOLDS: SlaThreshold[] = [
  { priority: "P1", targetAnswerSeconds: 15, targetDispatchSeconds: 180, warningPct: 0.8 },
  { priority: "P2", targetAnswerSeconds: 30, targetDispatchSeconds: 300, warningPct: 0.8 },
  { priority: "P3", targetAnswerSeconds: 60, targetDispatchSeconds: 600, warningPct: 0.8 },
  { priority: "P4", targetAnswerSeconds: 120, targetDispatchSeconds: 900, warningPct: 0.8 },
];
