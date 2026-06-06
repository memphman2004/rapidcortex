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
