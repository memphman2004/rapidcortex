import { z } from "zod";

/**
 * Zod mirror of `ProtocolCategory` in `./types.ts` — keep literals in sync when categories change.
 */
export const protocolCategorySchema = z.enum([
  "cpr_cardiac_arrest",
  "aed_use",
  "choking",
  "severe_bleeding",
  "stroke",
  "unconscious_person",
  "fire_evacuation",
  "domestic_disturbance_silent_caller",
  "welfare_check",
  "unknown_high_stress",
]);

/**
 * Runtime validation for protocol coach payloads attached to persisted `AIAnalysis` records.
 */
export const protocolGuidanceSchema = z.object({
  protocolId: z.string().min(1),
  protocolName: z.string().min(1),
  category: protocolCategorySchema,
  locale: z.string().min(1),
  currentStepId: z.string().min(1),
  currentStepOrder: z.number().int(),
  currentStepTitle: z.string().min(1),
  recommendedPhrase: z.string().min(1),
  rationale: z.string().min(1),
  escalationCriteria: z.string().min(1),
  protocolEscalationSummary: z.string().min(1),
  coachDisclaimer: z.string().min(1),
});

export type ProtocolGuidanceParsed = z.infer<typeof protocolGuidanceSchema>;
