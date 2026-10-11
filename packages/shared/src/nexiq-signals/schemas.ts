import { z } from "zod";

/** Civic-IQ → Claude ingest verticals (distinct from Rapid IQ opportunity verticals). */
export const NEXIQ_SIGNAL_VERTICALS = ["core_psap", "campus", "venue", "transit"] as const;
export type NexiqSignalVertical = (typeof NEXIQ_SIGNAL_VERTICALS)[number];

export const NEXIQ_SIGNAL_STATUSES = ["new", "tracking", "dismissed", "pushed_to_crm"] as const;
export type NexiqSignalStatus = (typeof NEXIQ_SIGNAL_STATUSES)[number];

export const NEXIQ_SIGNAL_TIERS = ["high", "medium", "low"] as const;
export type NexiqSignalTier = (typeof NEXIQ_SIGNAL_TIERS)[number];

export const NEXIQ_SIGNAL_MIN_CONFIDENCE = 40;

export const nexiqSignalGeographySchema = z.object({
  state: z.string().trim().min(1).max(64),
  county: z.string().trim().max(128).optional(),
  city: z.string().trim().max(128).optional(),
});

export const nexiqSignalCreateBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  summary: z.string().trim().max(4000).optional().default(""),
  sourceUrl: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .default("")
    .refine((v) => !v || /^https?:\/\//i.test(v), "sourceUrl must be http(s)"),
  vertical: z.enum(NEXIQ_SIGNAL_VERTICALS),
  agencyName: z.string().trim().min(1).max(300),
  agencyType: z.string().trim().max(200).optional().default(""),
  geography: nexiqSignalGeographySchema,
  estimatedValue: z.number().finite().nonnegative().nullable().optional().default(null),
  dueDate: z.string().trim().max(64).nullable().optional().default(null),
  keywords: z.array(z.string().trim().min(1).max(80)).max(40).optional().default([]),
  confidenceScore: z.number().min(0).max(100),
  confidenceTier: z.enum(NEXIQ_SIGNAL_TIERS),
  dedupeHash: z.string().trim().min(16).max(128),
});

export type NexiqSignalCreateBody = z.infer<typeof nexiqSignalCreateBodySchema>;

export const nexiqSignalPatchBodySchema = z.object({
  action: z.enum(["track", "dismiss", "push_to_crm"]),
});

export type NexiqSignalPatchBody = z.infer<typeof nexiqSignalPatchBodySchema>;

export const nexiqSignalListQuerySchema = z.object({
  status: z.enum(NEXIQ_SIGNAL_STATUSES).optional().default("new"),
  vertical: z.enum(NEXIQ_SIGNAL_VERTICALS).optional(),
  tier: z.enum(NEXIQ_SIGNAL_TIERS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  nextToken: z.string().trim().min(1).max(4000).optional(),
  includeDismissed: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export type NexiqSignalListQuery = z.infer<typeof nexiqSignalListQuerySchema>;

export type NexiqSignalRecord = {
  pk: string;
  sk: string;
  signalId: string;
  title: string;
  summary: string;
  sourceUrl: string;
  vertical: NexiqSignalVertical;
  agencyName: string;
  agencyType: string;
  geography: { state: string; county?: string; city?: string };
  estimatedValue: number | null;
  dueDate: string | null;
  keywords: string[];
  confidenceScore: number;
  confidenceTier: NexiqSignalTier;
  status: NexiqSignalStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  apolloAccountId: string | null;
  createdAt: string;
  dedupeHash: string;
};

export type NexiqSignalListResponse = {
  items: NexiqSignalRecord[];
  nextToken?: string;
};

export type NexiqSignalSummary = {
  new: number;
  tracking: number;
  high_tier: number;
  pushed_to_crm: number;
  by_vertical: Record<
    NexiqSignalVertical,
    { new: number; tracking: number }
  >;
};

export function emptyNexiqSignalSummary(): NexiqSignalSummary {
  const emptyVert = { new: 0, tracking: 0 };
  return {
    new: 0,
    tracking: 0,
    high_tier: 0,
    pushed_to_crm: 0,
    by_vertical: {
      core_psap: { ...emptyVert },
      campus: { ...emptyVert },
      venue: { ...emptyVert },
      transit: { ...emptyVert },
    },
  };
}

/**
 * Spec roles `admin` / `bd_manager` map to Cognito:
 * admin → rcsuperadmin | rcadmin; bd_manager → salescontractor.
 */
export function canAccessNexiqSignals(role: string | undefined | null): boolean {
  const r = String(role ?? "")
    .trim()
    .toLowerCase();
  return r === "rcsuperadmin" || r === "rcadmin" || r === "salescontractor";
}
