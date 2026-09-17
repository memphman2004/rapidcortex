import { z } from "zod";

export const sopIntelligenceResolutionStatusSchema = z.enum(["open", "in_progress", "resolved"]);
export const sopIntelligencePendingStatusSchema = z.enum([
  "pending",
  "approved",
  "deferred",
  "dismissed",
]);
export const sopIntelligenceCoachingPrioritySchema = z.enum(["watch", "due", "priority"]);

export const sopLibraryStepSchema = z.object({
  stepId: z.string().min(1).max(40),
  stepNumber: z.string().min(1).max(20),
  text: z.string().min(1).max(8000),
  updatedAt: z.string().min(1).max(40).optional(),
});

export const sopLibraryDocumentSchema = z.object({
  sopId: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  version: z.number().int().min(1),
  lastUpdated: z.string().min(1).max(40),
  lastUpdatedBy: z.string().max(120).optional(),
  status: z.enum(["active", "retired"]).default("active"),
  steps: z.array(sopLibraryStepSchema).min(1).max(40),
  deviationRate: z.number().min(0).max(100).optional(),
  pendingUpdateId: z.string().max(80).optional(),
});

export const sopIntelligencePhase2Schema = z
  .object({
    callId: z.string().min(1).max(80),
    dispatcherName: z.string().min(1).max(120).optional(),
    telecom: z.string().min(1).max(80).optional(),
    whatHappened: z.string().min(1).max(4000),
    actionTaken: z.string().max(4000).optional(),
    sopGapIdentified: z.boolean(),
    sopId: z.string().min(1).max(40).optional(),
    stepId: z.string().min(1).max(40).optional(),
    gapDescription: z.string().max(2000).optional(),
    rootCause: z.string().max(200).optional(),
    gisCorrection: z.string().max(500).optional(),
    vendorTicket: z.string().max(80).optional(),
    resolutionStatus: sopIntelligenceResolutionStatusSchema.optional(),
    investigationNotes: z.string().max(4000).optional(),
    level: z.enum(["HIGH", "MED", "LOW"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.sopGapIdentified && (!value.sopId || !value.stepId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sopId and stepId are required when SOP gap is identified",
        path: ["sopId"],
      });
    }
  });

export const sopLibraryDocumentPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  steps: z.array(sopLibraryStepSchema.pick({ stepId: true, text: true, stepNumber: true })).min(1).max(40).optional(),
});

export const sopLibraryStepPatchSchema = z.object({
  text: z.string().min(1).max(8000),
});

export const sopPendingActionSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const sopPatternThresholdDetailSchema = z.object({
  agencyId: z.string().min(1).max(80),
  sopId: z.string().min(1).max(40),
  stepId: z.string().min(1).max(40),
  gapCount: z.number().int().min(1),
  reportIds: z.array(z.string().min(1)).max(50),
});

export const sopClaudeSuggestionSchema = z.object({
  suggestedLanguage: z.string().min(1).max(8000),
  rationale: z.string().min(1).max(4000),
  confidence: z.number().min(0).max(1),
  rootCauseType: z.string().min(1).max(120),
  evidence: z.array(z.string().min(1).max(500)).max(12),
});

export type SopLibraryStep = z.infer<typeof sopLibraryStepSchema>;
export type SopLibraryDocument = z.infer<typeof sopLibraryDocumentSchema>;
export type SopIntelligencePhase2Input = z.infer<typeof sopIntelligencePhase2Schema>;
export type SopLibraryDocumentPatch = z.infer<typeof sopLibraryDocumentPatchSchema>;
export type SopLibraryStepPatch = z.infer<typeof sopLibraryStepPatchSchema>;
export type SopPatternThresholdDetail = z.infer<typeof sopPatternThresholdDetailSchema>;
export type SopClaudeSuggestion = z.infer<typeof sopClaudeSuggestionSchema>;
export type SopIntelligencePendingStatus = z.infer<typeof sopIntelligencePendingStatusSchema>;
export type SopIntelligenceCoachingPriority = z.infer<typeof sopIntelligenceCoachingPrioritySchema>;
