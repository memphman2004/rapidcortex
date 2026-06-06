import { z } from "zod";

export type QaScorecardCategory =
  | "protocol_adherence"
  | "communication_clarity"
  | "information_gathering"
  | "cad_accuracy"
  | "call_control"
  | "professionalism";

export const QA_SCORECARD_CATEGORIES: readonly QaScorecardCategory[] = [
  "protocol_adherence",
  "communication_clarity",
  "information_gathering",
  "cad_accuracy",
  "call_control",
  "professionalism",
] as const;

export interface QaScorecardItem {
  category: QaScorecardCategory;
  label: string;
  score: 1 | 2 | 3 | 4 | 5;
  weight: number;
  notes?: string;
}

export interface QaScorecard {
  scorecardId: string;
  incidentId: string;
  agencyId: string;
  reviewerId: string;
  dispatcherId: string;
  items: QaScorecardItem[];
  overallScore: number;
  coachingNotes?: string;
  followUpRequired: boolean;
  status: "draft" | "submitted" | "acknowledged";
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
}

export interface CoachingNote {
  noteId: string;
  agencyId: string;
  dispatcherId: string;
  supervisorId: string;
  incidentId?: string;
  scorecardId?: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CallQualityTrend {
  agencyId: string;
  dispatcherId?: string;
  period: "day" | "week" | "month";
  periodStart: string;
  avgScore: number;
  totalReviews: number;
  categoryBreakdown: Record<QaScorecardCategory, number>;
}

export const QA_SCORECARD_CATEGORY_DEFS: ReadonlyArray<{
  category: QaScorecardCategory;
  label: string;
  weight: number;
}> = [
  { category: "protocol_adherence", label: "Protocol adherence", weight: 0.2 },
  { category: "communication_clarity", label: "Communication clarity", weight: 0.18 },
  { category: "information_gathering", label: "Information gathering", weight: 0.18 },
  { category: "cad_accuracy", label: "CAD accuracy", weight: 0.16 },
  { category: "call_control", label: "Call control", weight: 0.14 },
  { category: "professionalism", label: "Professionalism", weight: 0.14 },
];

export function defaultQaScorecardItems(): QaScorecardItem[] {
  return QA_SCORECARD_CATEGORY_DEFS.map((d) => ({
    category: d.category,
    label: d.label,
    weight: d.weight,
    score: 3 as const,
  }));
}

export function computeQaOverallScore(items: QaScorecardItem[]): number {
  if (items.length === 0) return 0;
  const weighted = items.reduce((sum, item) => sum + item.score * item.weight, 0);
  return Math.round((weighted / 5) * 1000) / 10;
}

const qaScorecardItemSchema = z.object({
  category: z.enum(QA_SCORECARD_CATEGORIES as unknown as [QaScorecardCategory, ...QaScorecardCategory[]]),
  label: z.string().min(1).max(120),
  score: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  weight: z.number().min(0).max(1),
  notes: z.string().max(2000).optional(),
});

export const createQaScorecardBodySchema = z.object({
  incidentId: z.string().min(1).max(128),
  dispatcherId: z.string().min(1).max(128),
  items: z.array(qaScorecardItemSchema).min(1).max(12).optional(),
  coachingNotes: z.string().max(8000).optional(),
  followUpRequired: z.boolean().optional(),
  status: z.enum(["draft", "submitted"]).optional(),
});
export type CreateQaScorecardBody = z.infer<typeof createQaScorecardBodySchema>;

export const patchQaScorecardBodySchema = z
  .object({
    items: z.array(qaScorecardItemSchema).min(1).max(12).optional(),
    coachingNotes: z.string().max(8000).optional(),
    followUpRequired: z.boolean().optional(),
    status: z.enum(["draft", "submitted"]).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "At least one field required" });
export type PatchQaScorecardBody = z.infer<typeof patchQaScorecardBodySchema>;

export const createCoachingNoteBodySchema = z.object({
  dispatcherId: z.string().min(1).max(128),
  content: z.string().min(1).max(8000),
  incidentId: z.string().min(1).max(128).optional(),
  scorecardId: z.string().min(1).max(128).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
});
export type CreateCoachingNoteBody = z.infer<typeof createCoachingNoteBodySchema>;

export const patchCoachingNoteBodySchema = z
  .object({
    content: z.string().min(1).max(8000).optional(),
    tags: z.array(z.string().min(1).max(40)).max(12).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "At least one field required" });
export type PatchCoachingNoteBody = z.infer<typeof patchCoachingNoteBodySchema>;

export const listQaScorecardsQuerySchema = z.object({
  incidentId: z.string().min(1).max(128).optional(),
  dispatcherId: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListQaScorecardsQuery = z.infer<typeof listQaScorecardsQuerySchema>;

export const listCoachingNotesQuerySchema = z.object({
  dispatcherId: z.string().min(1).max(128),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type ListCoachingNotesQuery = z.infer<typeof listCoachingNotesQuerySchema>;

export const getQaTrendsQuerySchema = z.object({
  period: z.enum(["day", "week", "month"]).default("week"),
  dispatcherId: z.string().min(1).max(128).optional(),
  weeks: z.coerce.number().int().min(1).max(52).optional(),
});
export type GetQaTrendsQuery = z.infer<typeof getQaTrendsQuerySchema>;

export type QaScorecardsListResponse = { items: QaScorecard[] };
export type CoachingNotesListResponse = { items: CoachingNote[] };
export type QaTrendsResponse = { trends: CallQualityTrend[]; agencyTrends: CallQualityTrend[] };
