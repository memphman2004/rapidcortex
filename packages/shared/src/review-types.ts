import { z } from "zod";

export const postIncidentReviewStatusSchema = z.enum(["draft", "final", "archived"]);
export type PostIncidentReviewStatus = z.infer<typeof postIncidentReviewStatusSchema>;

export const reviewSectionTypeSchema = z.enum([
  "incident_summary",
  "response_assessment",
  "protocol_compliance",
  "lessons_learned",
  "corrective_actions",
  "custom",
]);

export type ReviewSectionType = z.infer<typeof reviewSectionTypeSchema>;

export const reviewSectionSchema = z.object({
  sectionId: z.string().min(1),
  title: z.string().min(1).max(200),
  content: z.string().max(50_000),
  sectionType: reviewSectionTypeSchema,
});

export type ReviewSection = z.infer<typeof reviewSectionSchema>;

export const postIncidentReviewSchema = z.object({
  reviewId: z.string().min(1),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  reviewedBy: z.string().min(1),
  status: postIncidentReviewStatusSchema,
  sections: z.array(reviewSectionSchema),
  linkedScorecardIds: z.array(z.string()),
  linkedTimelineEventIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  finalizedAt: z.string().datetime().optional(),
});

export type PostIncidentReview = z.infer<typeof postIncidentReviewSchema>;

export const createPostIncidentReviewBodySchema = z.object({
  incidentId: z.string().min(1),
  linkedScorecardIds: z.array(z.string()).optional(),
  linkedTimelineEventIds: z.array(z.string()).optional(),
});

export type CreatePostIncidentReviewBody = z.infer<typeof createPostIncidentReviewBodySchema>;

export const patchPostIncidentReviewBodySchema = z.object({
  sections: z.array(reviewSectionSchema).optional(),
  linkedScorecardIds: z.array(z.string()).optional(),
  linkedTimelineEventIds: z.array(z.string()).optional(),
  status: postIncidentReviewStatusSchema.optional(),
});

export type PatchPostIncidentReviewBody = z.infer<typeof patchPostIncidentReviewBodySchema>;

export const listPostIncidentReviewsQuerySchema = z.object({
  incidentId: z.string().min(1).optional(),
  status: postIncidentReviewStatusSchema.optional(),
});

export const postIncidentReviewExportSchema = postIncidentReviewSchema.extend({
  exportedAt: z.string().datetime(),
});

export type PostIncidentReviewExport = z.infer<typeof postIncidentReviewExportSchema>;

const SECTION_DEFS: { sectionType: ReviewSectionType; title: string }[] = [
  { sectionType: "incident_summary", title: "Incident summary" },
  { sectionType: "response_assessment", title: "Response assessment" },
  { sectionType: "protocol_compliance", title: "Protocol compliance" },
  { sectionType: "lessons_learned", title: "Lessons learned" },
  { sectionType: "corrective_actions", title: "Corrective actions" },
  { sectionType: "custom", title: "Additional notes" },
];

export function defaultReviewSections(): ReviewSection[] {
  return SECTION_DEFS.map((d) => ({
    sectionId: d.sectionType,
    title: d.title,
    content: "",
    sectionType: d.sectionType,
  }));
}
