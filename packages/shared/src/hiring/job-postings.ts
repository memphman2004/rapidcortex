import { z } from "zod";

export const POSTING_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type PostingStatus = (typeof POSTING_STATUSES)[number];
export const PostingStatusSchema = z.enum(POSTING_STATUSES);

export const ENGAGEMENT_TYPES = ["CONTRACTOR_1099", "PART_TIME", "FULL_TIME"] as const;
export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];
export const EngagementTypeSchema = z.enum(ENGAGEMENT_TYPES);

export const WORK_LOCATIONS = ["REMOTE_US", "HYBRID", "ONSITE"] as const;
export type WorkLocation = (typeof WORK_LOCATIONS)[number];
export const WorkLocationSchema = z.enum(WORK_LOCATIONS);

export const COMPENSATION_UNITS = ["HOUR", "YEAR"] as const;
export type CompensationUnit = (typeof COMPENSATION_UNITS)[number];
export const CompensationUnitSchema = z.enum(COMPENSATION_UNITS);

export const JobPostingSchema = z.object({
  postingId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  positionKey: z.string().min(1).max(120),
  department: z.string().max(120).optional(),
  engagementType: EngagementTypeSchema,
  workLocation: WorkLocationSchema,
  compensationMin: z.number().nonnegative().optional(),
  compensationMax: z.number().nonnegative().optional(),
  compensationUnit: CompensationUnitSchema.default("HOUR"),
  summary: z.string().min(1).max(1000),
  description: z.string().max(50_000).default(""),
  requirements: z.array(z.string().max(500)).default([]),
  preferredQualifications: z.array(z.string().max(500)).default([]),
  whatYouGain: z.array(z.string().max(500)).optional(),
  technologyList: z.array(z.string().max(120)).optional(),
  status: PostingStatusSchema,
  publishedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  applicationCount: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
  agencyId: z.literal("platform").optional(),
});
export type JobPosting = z.infer<typeof JobPostingSchema>;

export const createJobPostingBodySchema = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).optional(),
  positionKey: z.string().min(1).max(120),
  department: z.string().max(120).optional(),
  engagementType: EngagementTypeSchema.default("CONTRACTOR_1099"),
  workLocation: WorkLocationSchema.default("REMOTE_US"),
  compensationMin: z.coerce.number().nonnegative().optional(),
  compensationMax: z.coerce.number().nonnegative().optional(),
  compensationUnit: CompensationUnitSchema.default("HOUR"),
  summary: z.string().max(1000).default(""),
  description: z.string().max(50_000).default(""),
  requirements: z.array(z.string().max(500)).default([]),
  preferredQualifications: z.array(z.string().max(500)).default([]),
  whatYouGain: z.array(z.string().max(500)).optional(),
  technologyList: z.array(z.string().max(120)).optional(),
  status: PostingStatusSchema.default("DRAFT"),
});
export type CreateJobPostingBody = z.infer<typeof createJobPostingBodySchema>;

export const updateJobPostingBodySchema = createJobPostingBodySchema.partial();
export type UpdateJobPostingBody = z.infer<typeof updateJobPostingBodySchema>;

export const ENGAGEMENT_LABEL: Record<EngagementType, string> = {
  CONTRACTOR_1099: "1099 Contractor",
  PART_TIME: "Part-Time",
  FULL_TIME: "Full-Time",
};

export const LOCATION_LABEL: Record<WorkLocation, string> = {
  REMOTE_US: "Remote (U.S.)",
  HYBRID: "Hybrid",
  ONSITE: "On-Site",
};

export const STATUS_BADGE: Record<PostingStatus, { label: string; cls: string }> = {
  DRAFT: { label: "Draft", cls: "bg-slate-500/15 text-slate-400" },
  PUBLISHED: { label: "Published", cls: "bg-emerald-500/15 text-emerald-400" },
  ARCHIVED: { label: "Archived", cls: "bg-red-500/15 text-red-400" },
};

export function formatCompensation(posting: {
  compensationMin?: number;
  compensationMax?: number;
  compensationUnit?: CompensationUnit | string;
}): string {
  const unit = posting.compensationUnit === "YEAR" ? "/yr" : "/hr";
  if (posting.compensationMin != null && posting.compensationMax != null) {
    return `$${posting.compensationMin}–$${posting.compensationMax}${unit}`;
  }
  if (posting.compensationMax != null) return `Up to $${posting.compensationMax}${unit}`;
  if (posting.compensationMin != null) return `From $${posting.compensationMin}${unit}`;
  return "Compensation TBD";
}

export function slugifyJobTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
