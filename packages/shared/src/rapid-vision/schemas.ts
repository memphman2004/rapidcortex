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

export const visionTranscriptQuerySchema = z.object({
  sessionId: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const visionTranscriptSessionBodySchema = z.object({
  incidentId: z.string().min(1).max(128),
});

export const visionTranscriptSegmentSchema = z.object({
  resultId: z.string().min(1),
  incidentId: z.string().min(1),
  agencyId: z.string().min(1),
  sessionId: z.string().min(1),
  cameraId: z.string().min(1),
  speakerLabel: z.string().min(1),
  transcript: z.string(),
  isPartial: z.boolean(),
  startTime: z.number(),
  endTime: z.number(),
  confidence: z.number().min(0).max(1),
  language: z.string().min(2),
  timestamp: z.string().min(1),
});

export type VisionCameraSearchRequest = z.infer<typeof visionCameraSearchRequestSchema>;
export type VisionRequestAccessBody = z.infer<typeof visionRequestAccessBodySchema>;
export type VisionSettingsPatch = z.infer<typeof visionSettingsPatchSchema>;
export type VisionTranscriptQuery = z.infer<typeof visionTranscriptQuerySchema>;
export type VisionTranscriptSessionBody = z.infer<typeof visionTranscriptSessionBodySchema>;
