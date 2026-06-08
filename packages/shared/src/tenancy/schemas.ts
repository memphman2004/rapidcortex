import { z } from "zod";
import { AGENCY_ROLE_SCHEMA } from "../types.js";
import type { AgencyRole } from "../types.js";
import { AGENCY_TYPE_VALUES } from "./agency.js";
import { triageAgencyConfigSchema } from "../triage/triage.js";
import { wellnessAgencyConfigSchema } from "../wellness/trauma-flag.js";
import {
  PLATFORM_ONBOARDING_STEP_IDS,
  type PlatformOnboardingStepId,
} from "./agency-config.js";

const PLATFORM_ONBOARDING_STEP_STATUS_SCHEMA = z.enum([
  "pending",
  "in_progress",
  "complete",
  "blocked",
]);

const onboardingStepsPatchShape = Object.fromEntries(
  PLATFORM_ONBOARDING_STEP_IDS.map((id) => [id, PLATFORM_ONBOARDING_STEP_STATUS_SCHEMA.optional()]),
) as Record<PlatformOnboardingStepId, z.ZodOptional<typeof PLATFORM_ONBOARDING_STEP_STATUS_SCHEMA>>;

const onboardingNotesPatchShape = Object.fromEntries(
  PLATFORM_ONBOARDING_STEP_IDS.map((id) => [id, z.string().max(4000).optional()]),
) as Record<PlatformOnboardingStepId, z.ZodOptional<z.ZodString>>;

const retentionOverrideDaysSchema = z
  .object({
    incident: z.number().int().min(1).max(100 * 365).optional(),
    transcript: z.number().int().min(1).max(100 * 365).optional(),
    media: z.number().int().min(1).max(100 * 365).optional(),
    analysis: z.number().int().min(1).max(100 * 365).optional(),
  })
  .strict();

export const platformOnboardingPatchSchema = z
  .object({
    steps: z.object(onboardingStepsPatchShape).strict().optional(),
    notesByStep: z.object(onboardingNotesPatchShape).strict().optional(),
    agencyNote: z.string().max(8000).optional(),
  })
  .strict();

/**
 * Canonical agency ID slug: `{state}-{city}-{centername}` (max 60 chars).
 * Example: ga-columbus-muscogee911
 */
export const AGENCY_SLUG_REGEX = /^[a-z]{2}-[a-z0-9]+-[a-z0-9]+$/;

/** @deprecated Legacy locality-state suffix format (e.g. atlanta-ga). */
export const AGENCY_ID_LOCALITY_STATE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z]{2}$/;

export const createAgencyBodySchema = z.object({
  city: z.string().min(1).max(120),
  centerName: z.string().min(1).max(200),
  /** US state full name or 2-letter abbreviation — resolved server-side for slug + storage. */
  state: z.string().min(2).max(50),
  name: z.string().min(2).max(200),
  type: z.enum(AGENCY_TYPE_VALUES),
  region: z.string().min(1).max(120),
  primaryContactName: z.string().min(1).max(200),
  primaryContactEmail: z.string().email(),
  deploymentMode: z.enum(["side_by_side", "partially_integrated", "integrated"]),
  protocolPackId: z.string().min(1).max(120),
  retentionPolicyId: z.string().min(1).max(120),
  integrationMode: z.enum([
    "none",
    "demo_only",
    "mock_adapters",
    "live_transcript",
    "cad_read_only",
    "bidirectional",
  ]),
  vertical: z.enum(["core", "campus", "venue", "hospital"]).default("core"),
  planTier: z.enum(["starter", "professional", "command", "enterprise"]).default("starter"),
  pilotMode: z.boolean().default(false),
  addons: z.array(z.string().min(1).max(120)).max(200).default([]),
});

const sopAgencyConfigPatchSchema = z.object({
  autoDetectEnabled: z.boolean(),
  sopDocumentS3Key: z.string().min(1).max(512).optional(),
});

export const patchAgencyBodySchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    status: z.enum(["draft", "pilot", "active", "suspended", "archived"]).optional(),
    primaryContactName: z.string().min(1).max(200).optional(),
    primaryContactEmail: z.string().email().optional(),
    deploymentMode: z.enum(["side_by_side", "partially_integrated", "integrated"]).optional(),
    protocolPackId: z.string().min(1).max(120).optional(),
    retentionPolicyId: z.string().min(1).max(120).optional(),
    integrationMode: z
      .enum([
        "none",
        "demo_only",
        "mock_adapters",
        "live_transcript",
        "cad_read_only",
        "bidirectional",
      ])
      .optional(),
    sop: sopAgencyConfigPatchSchema.optional(),
    triage: triageAgencyConfigSchema.optional(),
    wellness: wellnessAgencyConfigSchema.optional(),
    platformOnboarding: platformOnboardingPatchSchema.optional(),
    retentionOverrideDays: retentionOverrideDaysSchema.optional(),
    vertical: z.enum(["core", "campus", "venue", "hospital"]).optional(),
    planTier: z.enum(["starter", "professional", "command", "enterprise"]).optional(),
    pilotMode: z.boolean().optional(),
    addons: z.array(z.string().min(1).max(120)).max(200).optional(),
  })
  .strict();

export const createInviteBodySchema = z.object({
  email: z.string().email(),
  role: AGENCY_ROLE_SCHEMA,
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export type CreateAgencyInput = z.infer<typeof createAgencyBodySchema>;
export type PatchAgencyInput = z.infer<typeof patchAgencyBodySchema>;
export type CreateInviteInput = z.infer<typeof createInviteBodySchema>;
