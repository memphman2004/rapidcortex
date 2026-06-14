import { z } from "zod";
import { triageClassificationSchema, triagePrioritySchema } from "./triage.js";

export const triageQueueStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "CLOSED",
  "ESCALATED",
]);

export type TriageQueueStatus = z.infer<typeof triageQueueStatusSchema>;

export const triageQueueItemSchema = z.object({
  agencyId: z.string().min(1),
  sk: z.string().min(1),
  incidentId: z.string().min(1),
  status: triageQueueStatusSchema,
  classification: triageClassificationSchema,
  confidence: z.number().min(0).max(100),
  reasoning: z.string().max(500),
  suggestedCategory: z.string().max(120),
  suggestedPriority: triagePrioritySchema,
  transcriptSummary: z.string().max(300),
  queuedAt: z.string().min(1),
  assignedTo: z.string().min(1).optional(),
  assignedAt: z.string().min(1).optional(),
  closedAt: z.string().min(1).optional(),
  closedBy: z.string().min(1).optional(),
  closureNotes: z.string().max(500).optional(),
  overrideBy: z.string().min(1).optional(),
  overrideAt: z.string().min(1).optional(),
  overrideReason: z.string().max(500).optional(),
  ttl: z.number().int().positive().optional(),
});

export type TriageQueueItem = z.infer<typeof triageQueueItemSchema>;

export const triageQueuePatchBodySchema = z.object({
  status: triageQueueStatusSchema.optional(),
  assignedTo: z.string().min(1).nullable().optional(),
  closureNotes: z.string().max(500).optional(),
});

export type TriageQueuePatchBody = z.infer<typeof triageQueuePatchBodySchema>;

/** Escalate a queued non-emergency call back to emergency handling. */
export const triageEscalationBodySchema = z.object({
  incidentId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type TriageEscalationBody = z.infer<typeof triageEscalationBodySchema>;

export const triageAnalyzeSegmentSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  startMs: z.number(),
});

export const triageAnalyzeEventSchema = z.object({
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  agencyName: z.string().min(1),
  segments: z.array(triageAnalyzeSegmentSchema),
  agencyTriageConfig: z.object({
    enabled: z.boolean(),
    nonEmergencyQueueEnabled: z.boolean(),
  }),
  retentionDays: z.number().int().positive().optional(),
});

export type TriageAnalyzeEvent = z.infer<typeof triageAnalyzeEventSchema>;

export type TriageAiClassification = {
  classification: z.infer<typeof triageClassificationSchema>;
  confidence: number;
  reasoning: string;
  suggestedCategory: string;
  suggestedPriority: z.infer<typeof triagePrioritySchema>;
  processedAt: string;
  segmentCount: number;
  mock?: boolean;
  /** Transcript phrase supporting classification (when grounded). */
  sourceQuote?: string | null;
};
