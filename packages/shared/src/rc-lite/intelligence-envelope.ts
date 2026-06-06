import { z } from "zod";
import { RC_LITE_HUMAN_REVIEW_STATUSES } from "./human-review-mode.js";

/**
 * Confidence + explainability surface for `/api/v1/intelligence/*` responses.
 */

export const RcLiteIntelligenceEnvelopeSchema = z.object({
  model: z.string(),
  incidentType: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string(),
  keywords: z.array(z.string()),
  riskFactors: z.array(z.string()),
  missingInformation: z.array(z.string()),
  recommendedQuestions: z.array(z.string()),
  suggestedDispatcherNotes: z.array(z.string()).optional(),
  /** When true / low-confidence, clients should avoid automated CAD writes. */
  doNotAutomate: z.boolean().optional(),
  review: z
    .object({
      status: z.enum(RC_LITE_HUMAN_REVIEW_STATUSES),
      reason: z.string(),
      confidence: z.number().min(0).max(1).optional(),
      recommendedReviewerRole: z.enum(["dispatcher", "supervisor", "qa_analyst", "compliance"]).optional(),
    })
    .optional(),
});

export type RcLiteIntelligenceEnvelope = z.infer<typeof RcLiteIntelligenceEnvelopeSchema>;
