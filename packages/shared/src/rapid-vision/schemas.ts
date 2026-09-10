import { z } from "zod";

export const visionCameraSearchRequestSchema = z.object({
  radiusMeters: z.number().int().min(76).max(1609).optional(),
  includeOffline: z.boolean().optional(),
});

export const visionRequestAccessBodySchema = z.object({
  durationMinutes: z.number().int().min(5).max(60).optional(),
});

export const visionSettingsPatchSchema = z.object({
  enabled: z.boolean().optional(),
  cameraSearchRadiusMeters: z.number().int().min(76).max(1609).optional(),
  defaultAccessDurationMinutes: z.number().int().min(5).max(60).optional(),
  aiAnalysisLevel: z.enum(["NORMAL", "ELEVATED", "CRITICAL"]).optional(),
  aiWriterIntervalSeconds: z.union([z.literal(10), z.literal(30), z.literal(60)]).optional(),
  enableCallerVideoAnalysis: z.boolean().optional(),
  retentionDays: z.number().int().min(1).max(365).optional(),
});

export type VisionCameraSearchRequest = z.infer<typeof visionCameraSearchRequestSchema>;
export type VisionRequestAccessBody = z.infer<typeof visionRequestAccessBodySchema>;
export type VisionSettingsPatch = z.infer<typeof visionSettingsPatchSchema>;
