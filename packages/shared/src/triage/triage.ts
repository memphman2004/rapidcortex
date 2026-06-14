import { z } from "zod";

/** Non-emergency disposition buckets for dispatch triage assist. */
export const triageBucketSchema = z.enum([
  "routine_service",
  "scheduled_callback",
  "information_only",
  "self_resolved",
  "escalate_voice",
]);

export type TriageBucket = z.infer<typeof triageBucketSchema>;

/** F3 — Bedrock emergency vs non-emergency classification (advisory). */
export const triageClassificationSchema = z.enum([
  "EMERGENCY",
  "NON_EMERGENCY",
  "UNCERTAIN",
]);

export type TriageClassification = z.infer<typeof triageClassificationSchema>;

export const triagePrioritySchema = z.enum(["P1", "P2", "P3"]);

export type TriagePriority = z.infer<typeof triagePrioritySchema>;

/** Stable list for UI selects (kept in sync with `triageBucketSchema`). */
export const TRIAGE_BUCKETS: readonly TriageBucket[] = [
  "routine_service",
  "scheduled_callback",
  "information_only",
  "self_resolved",
  "escalate_voice",
];

export const triageResultSchema = z.object({
  bucket: triageBucketSchema,
  /** Normalized 0–1 confidence in the bucket assignment. */
  confidence: z.number().min(0).max(1),
  /** Short operator-facing headline. */
  headline: z.string().min(1).max(400),
  /** Longer reasoning for tooltips / audit. */
  reasoning: z.string().min(1).max(4000),
  /** Optional structured hints for CAD or downstream systems. */
  tags: z.array(z.string().min(1).max(64)).max(16).optional(),
  overriddenBucket: triageBucketSchema.optional(),
  overriddenAt: z.string().min(1).optional(),
  overriddenByUserId: z.string().min(1).optional(),
  /** F3 AI classification when Bedrock/mock path ran. */
  classification: triageClassificationSchema.optional(),
  suggestedCategory: z.string().max(120).optional(),
  suggestedPriority: triagePrioritySchema.optional(),
});

export type TriageResult = z.infer<typeof triageResultSchema>;

export const triageOverrideBodySchema = z.object({
  bucket: triageBucketSchema,
  reason: z.string().min(1).max(500).optional(),
});

export type TriageOverrideBody = z.infer<typeof triageOverrideBodySchema>;

export const triageAgencyConfigSchema = z.object({
  enabled: z.boolean(),
  nonEmergencyQueueEnabled: z.boolean().optional(),
});
