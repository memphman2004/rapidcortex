import { z } from "zod";

export const confidenceLevelSchema = z.enum([
  "HIGH",
  "MEDIUM",
  "LOW",
  "CONFLICT",
  "MISSING",
]);

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const confidenceTrendSchema = z.enum(["IMPROVING", "STABLE", "DEGRADING"]);

export type ConfidenceTrend = z.infer<typeof confidenceTrendSchema>;

export const fieldWeightSchema = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

export type FieldWeight = z.infer<typeof fieldWeightSchema>;

export const fieldConfidenceSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  value: z.string().nullable(),
  score: z.number().min(0).max(100),
  level: confidenceLevelSchema,
  trend: confidenceTrendSchema,
  trendDelta: z.number(),
  reason: z.string().max(200),
  suggestedQuestion: z.string().max(300).nullable(),
  weight: fieldWeightSchema,
  lastUpdatedAtSegment: z.number().int().nonnegative(),
  conflictingValues: z.array(z.string().min(1)).max(8).optional(),
  /** Verbatim transcript phrase supporting `value` (when grounded). */
  sourceQuote: z.string().max(500).nullable().optional(),
  /** True when post-extraction grounding removed or capped an AI value. */
  groundingDowngraded: z.boolean().optional(),
});

export type FieldConfidence = z.infer<typeof fieldConfidenceSchema>;

export const aggregateConfidenceSchema = z.object({
  overallScore: z.number().min(0).max(100),
  pictureStatus: z.enum(["COMPLETE", "PARTIAL", "INCOMPLETE", "CONFLICTED"]),
  attentionRequired: z.array(z.string().min(1)),
  criticalGaps: z.number().int().nonnegative(),
  hasConflicts: z.boolean(),
  audioQualityFactor: z.number().min(0).max(1),
  topSuggestedQuestion: z.string().max(300).nullable(),
  computedAt: z.string().min(1),
  segmentCount: z.number().int().nonnegative(),
});

export type AggregateConfidence = z.infer<typeof aggregateConfidenceSchema>;

export const confidenceAnalysisSchema = z.object({
  incidentId: z.string().min(1),
  agencyId: z.string().min(1),
  fields: z.array(fieldConfidenceSchema),
  aggregate: aggregateConfidenceSchema,
  version: z.number().int().positive(),
  previousVersion: z.number().int().positive().optional(),
});

export type ConfidenceAnalysis = z.infer<typeof confidenceAnalysisSchema>;

export const FIELD_REGISTRY: Record<
  string,
  { label: string; weight: FieldWeight; questionTemplate: string }
> = {
  location: {
    label: "Location",
    weight: "CRITICAL",
    questionTemplate: "Can you confirm the exact address or nearest cross street?",
  },
  locationType: {
    label: "Location Type",
    weight: "HIGH",
    questionTemplate: "Is this inside a building, outside, or in a vehicle?",
  },
  incidentType: {
    label: "Incident Type",
    weight: "CRITICAL",
    questionTemplate: "Can you describe exactly what is happening right now?",
  },
  weapons: {
    label: "Weapons",
    weight: "CRITICAL",
    questionTemplate: "Can you describe what the weapon looks like?",
  },
  injuries: {
    label: "Injuries / Medical",
    weight: "CRITICAL",
    questionTemplate: "Is anyone injured? Are they conscious and breathing?",
  },
  suspectDescription: {
    label: "Suspect Description",
    weight: "HIGH",
    questionTemplate: "Can you describe the suspect — clothing, height, direction of travel?",
  },
  vehicleDescription: {
    label: "Vehicle",
    weight: "HIGH",
    questionTemplate: "Can you describe the vehicle — color, make, license plate?",
  },
  callerLocation: {
    label: "Caller Location",
    weight: "HIGH",
    questionTemplate: "Where are you right now — are you safe?",
  },
  numberOfPersons: {
    label: "Number of Persons",
    weight: "MEDIUM",
    questionTemplate: "Approximately how many people are involved?",
  },
  timeOfOccurrence: {
    label: "Time of Occurrence",
    weight: "MEDIUM",
    questionTemplate: "When did this happen — just now or some time ago?",
  },
  hazards: {
    label: "Hazards",
    weight: "HIGH",
    questionTemplate: "Are there any hazards — fire, gas, chemicals, or downed wires?",
  },
};
