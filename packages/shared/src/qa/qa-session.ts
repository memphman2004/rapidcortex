import { z } from "zod";

/** Single checklist line item for QA scoring / review. */
export const qaChecklistItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(500),
  /** Optional rubric weight (default 1). */
  weight: z.number().min(0).max(10).optional(),
  /** Filled after scoring or manual review. */
  score: z.number().min(0).max(5).optional(),
  passed: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  /** Verbatim or near-verbatim transcript excerpt cited by the scorer. */
  evidenceQuote: z.string().max(800).optional(),
});

export type QAChecklistItem = z.infer<typeof qaChecklistItemSchema>;

export const qaProtocolTemplateSchema = z.object({
  templateId: z.string().min(1).max(64),
  agencyId: z.string().min(2).max(64),
  name: z.string().min(2).max(200),
  version: z.number().int().min(1).max(9999).default(1),
  description: z.string().max(2000).optional(),
  checklistItems: z.array(qaChecklistItemSchema).min(1).max(200),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type QAProtocolTemplate = z.infer<typeof qaProtocolTemplateSchema>;

export const qaSessionStatusSchema = z.enum([
  "draft",
  "scoring",
  "scored",
  "reviewed",
  "failed",
]);

export type QASessionStatus = z.infer<typeof qaSessionStatusSchema>;

export const qaSessionSchema = z.object({
  sessionId: z.string().min(1).max(80),
  agencyId: z.string().min(2).max(64),
  incidentId: z.string().min(1).max(120),
  dispatcherUserId: z.string().min(1).max(120),
  templateId: z.string().min(1).max(64),
  status: qaSessionStatusSchema,
  checklistItems: z.array(qaChecklistItemSchema),
  /** 0–100 aggregate when scored. */
  aggregateScore: z.number().min(0).max(100).optional(),
  supervisorNotes: z.string().max(8000).optional(),
  scoringModelId: z.string().max(200).optional(),
  scoringRaw: z.string().max(500000).optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type QASession = z.infer<typeof qaSessionSchema>;

export const createQASessionBodySchema = z.object({
  incidentId: z.string().min(1).max(120),
  templateId: z.string().min(1).max(64),
});

export type CreateQASessionInput = z.infer<typeof createQASessionBodySchema>;

export const patchQASessionBodySchema = z
  .object({
    status: qaSessionStatusSchema.optional(),
    checklistItems: z.array(qaChecklistItemSchema).optional(),
    supervisorNotes: z.string().max(8000).optional(),
    aggregateScore: z.number().min(0).max(100).optional(),
  })
  .strict();

export type PatchQASessionInput = z.infer<typeof patchQASessionBodySchema>;

const qaTemplateChecklistItemDefSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(500),
  weight: z.number().min(0).max(10).optional(),
});

export const createQAProtocolTemplateBodySchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  checklistItems: z.array(qaTemplateChecklistItemDefSchema).min(1).max(200),
});

export type CreateQAProtocolTemplateInput = z.infer<typeof createQAProtocolTemplateBodySchema>;

export const patchQAProtocolTemplateBodySchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    description: z.string().max(2000).optional(),
    checklistItems: z.array(qaChecklistItemSchema).optional(),
    version: z.number().int().min(1).max(9999).optional(),
  })
  .strict();

export type PatchQAProtocolTemplateInput = z.infer<typeof patchQAProtocolTemplateBodySchema>;

/** Bedrock / scorer structured output (validated before persisting). */
export const qaStructuredScoreSchema = z.object({
  checklist: z.array(
    z.object({
      id: z.string(),
      score: z.number().min(0).max(5),
      passed: z.boolean().optional(),
      rationale: z.string().max(2000).optional(),
      /** Short verbatim quote from the transcript supporting the score. */
      evidenceQuote: z.string().max(800).optional(),
    }),
  ),
  aggregateScore: z.number().min(0).max(100).optional(),
});

export type QAStructuredScore = z.infer<typeof qaStructuredScoreSchema>;
