import { z } from "zod";

export const stakeholderVisibilitySchema = z.enum(["public", "link_only", "password"]);
export type StakeholderVisibility = z.infer<typeof stakeholderVisibilitySchema>;

export const stakeholderSectionKindSchema = z.enum([
  "summary",
  "timeline",
  "units",
  "media",
  "custom_text",
]);

export type StakeholderSectionKind = z.infer<typeof stakeholderSectionKindSchema>;

export const stakeholderSectionSchema = z.object({
  sectionId: z.string().min(1),
  kind: stakeholderSectionKindSchema,
  title: z.string().min(1).max(200),
  content: z.string().max(20_000).optional(),
  visible: z.boolean(),
});

export type StakeholderSection = z.infer<typeof stakeholderSectionSchema>;

export const stakeholderPageSchema = z.object({
  pageId: z.string().min(1),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  visibility: stakeholderVisibilitySchema,
  passwordHash: z.string().optional(),
  sections: z.array(stakeholderSectionSchema),
  lastUpdatedBy: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});

export type StakeholderPage = z.infer<typeof stakeholderPageSchema>;

export const stakeholderPageInternalSchema = stakeholderPageSchema.omit({ passwordHash: true }).extend({
  hasPassword: z.boolean().optional(),
});

export type StakeholderPageInternal = z.infer<typeof stakeholderPageInternalSchema>;

export const createStakeholderPageBodySchema = z.object({
  incidentId: z.string().min(1),
  title: z.string().min(1).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  visibility: stakeholderVisibilitySchema,
  password: z.string().min(8).max(128).optional(),
  sections: z.array(stakeholderSectionSchema).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type CreateStakeholderPageBody = z.infer<typeof createStakeholderPageBodySchema>;

export const patchStakeholderPageBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  visibility: stakeholderVisibilitySchema.optional(),
  password: z.string().min(8).max(128).optional(),
  clearPassword: z.boolean().optional(),
  sections: z.array(stakeholderSectionSchema).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type PatchStakeholderPageBody = z.infer<typeof patchStakeholderPageBodySchema>;

export const listStakeholderPagesQuerySchema = z.object({
  incidentId: z.string().min(1).optional(),
});

export const publicStakeholderTimelineItemSchema = z.object({
  timestamp: z.string(),
  label: z.string(),
  description: z.string().optional(),
});

export const publicStakeholderCustomSectionSchema = z.object({
  title: z.string(),
  content: z.string(),
});

export const publicStakeholderStatusViewSchema = z.object({
  title: z.string(),
  slug: z.string(),
  lastUpdatedAt: z.string(),
  summary: z.string().optional(),
  timeline: z.array(publicStakeholderTimelineItemSchema).optional(),
  unitCount: z.number().int().nonnegative().optional(),
  mediaCount: z.number().int().nonnegative().optional(),
  customSections: z.array(publicStakeholderCustomSectionSchema).optional(),
});

export type PublicStakeholderStatusView = z.infer<typeof publicStakeholderStatusViewSchema>;

export const publicStakeholderPasswordRequiredSchema = z.object({
  requiresPassword: z.literal(true),
});

export function defaultStakeholderSections(): StakeholderSection[] {
  return [
    { sectionId: "summary", kind: "summary", title: "Situation summary", visible: true },
    { sectionId: "timeline", kind: "timeline", title: "Public timeline", visible: true },
    { sectionId: "units", kind: "units", title: "Responding units", visible: true },
    { sectionId: "media", kind: "media", title: "Media", visible: false },
  ];
}
