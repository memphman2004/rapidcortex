import { z } from "zod";

export const traumaFlagStatusSchema = z.enum(["open", "acknowledged"]);

export type TraumaFlagStatus = z.infer<typeof traumaFlagStatusSchema>;

export const traumaFlagRecordSchema = z.object({
  flagId: z.string().min(1),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  dispatcherUserId: z.string().min(1),
  status: traumaFlagStatusSchema,
  matchedKeywords: z.array(z.string().min(1)).max(32),
  excerpt: z.string().max(2000).optional(),
  createdAt: z.string().min(1),
  acknowledgedAt: z.string().min(1).optional(),
  acknowledgedByUserId: z.string().min(1).optional(),
  /** Sparse GSI key: `${agencyId}#${callerAddressNormalized}` when the incident had a normalizable address. */
  agencyCallerAddressKey: z.string().min(1).max(600).optional(),
});

export type TraumaFlagRecord = z.infer<typeof traumaFlagRecordSchema>;

export const wellnessAgencyConfigSchema = z.object({
  enabled: z.boolean(),
  /** Case-insensitive substring matches against normalized English transcript chunks. */
  keywords: z.array(z.string().min(1).max(120)).max(64),
});

export type WellnessAgencyConfig = z.infer<typeof wellnessAgencyConfigSchema>;

export const acknowledgeTraumaFlagBodySchema = z.object({
  note: z.string().max(500).optional(),
});

export type AcknowledgeTraumaFlagBody = z.infer<typeof acknowledgeTraumaFlagBodySchema>;
