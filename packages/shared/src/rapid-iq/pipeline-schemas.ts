import { z } from "zod";

/** Pipeline source IDs (procurement signal intelligence — distinct from opportunity-linked RapidIqSignal). */
export const RAPID_IQ_PIPELINE_SOURCE_IDS = [
  "usa-spending",
  "sam-gov",
  "news-rss",
  "legistar-bulk", // replaces granicus
  "socrata",
  "state-911-board",
  "state-arpa",
  "openlegislative",
] as const;
export type RapidIqPipelineSourceId = (typeof RAPID_IQ_PIPELINE_SOURCE_IDS)[number];

export const RAPID_IQ_PIPELINE_SIGNAL_STATUSES = [
  "new",
  "reviewed",
  "pushed",
  "dismissed",
] as const;
export type RapidIqPipelineSignalStatus = (typeof RAPID_IQ_PIPELINE_SIGNAL_STATUSES)[number];

export const RAPID_IQ_PIPELINE_FIT_LABELS = ["high", "medium", "low"] as const;
export type RapidIqPipelineFitLabel = (typeof RAPID_IQ_PIPELINE_FIT_LABELS)[number];

export const RAPID_IQ_PIPELINE_PROCUREMENT_TYPES = [
  "new-cad",
  "upgrade",
  "ai-overlay",
  "hardware",
  "unknown",
] as const;
export type RapidIqPipelineProcurementType =
  (typeof RAPID_IQ_PIPELINE_PROCUREMENT_TYPES)[number];

export const rapidIqPipelineContactHintSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  source: z.enum(["mentioned", "extracted"]),
});
export type RapidIqPipelineContactHint = z.infer<typeof rapidIqPipelineContactHintSchema>;

export const rapidIqPipelineSignalSchema = z.object({
  signalId: z.string().min(1),
  sourceId: z.enum(RAPID_IQ_PIPELINE_SOURCE_IDS),
  sourceUrl: z.string().min(1),
  rawTitle: z.string(),
  rawSnippet: z.string(),
  contentHash: z.string().min(1),
  signalDate: z.string().min(1),
  ingestedAt: z.string().min(1),
  processedAt: z.string().optional(),

  agencyName: z.string().optional(),
  jurisdiction: z.string().optional(),
  state: z.string().optional(),
  agencyType: z.string().optional(),
  vendorNamed: z.string().optional(),
  fundingSource: z.string().optional(),
  procurementType: z.enum(RAPID_IQ_PIPELINE_PROCUREMENT_TYPES).optional(),
  dollarAmount: z.number().optional(),
  summary: z.string().optional(),
  contactHints: z.array(rapidIqPipelineContactHintSchema).optional(),

  fitScore: z.number().min(0).max(100),
  fitLabel: z.enum(RAPID_IQ_PIPELINE_FIT_LABELS),

  status: z.enum(RAPID_IQ_PIPELINE_SIGNAL_STATUSES),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  crmLeadId: z.string().optional(),
  pushedAt: z.string().optional(),
});
export type RapidIqPipelineSignal = z.infer<typeof rapidIqPipelineSignalSchema>;

export const rapidIqPipelineRawSignalSchema = z.object({
  sourceId: z.enum(RAPID_IQ_PIPELINE_SOURCE_IDS),
  sourceUrl: z.string().min(1),
  rawTitle: z.string().min(1),
  rawSnippet: z.string(),
  signalDate: z.string().min(1),
});
export type RapidIqPipelineRawSignal = z.infer<typeof rapidIqPipelineRawSignalSchema>;

export const rapidIqPipelineExtractionSchema = z.object({
  agencyName: z.string().optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  agencyType: z.string().optional().nullable(),
  vendorNamed: z.string().optional().nullable(),
  fundingSource: z.string().optional().nullable(),
  procurementType: z.enum(RAPID_IQ_PIPELINE_PROCUREMENT_TYPES).optional().nullable(),
  dollarAmount: z.number().optional().nullable(),
  summary: z.string().optional().nullable(),
  contactHints: z.array(rapidIqPipelineContactHintSchema).optional().nullable(),
});
export type RapidIqPipelineExtraction = {
  agencyName?: string;
  jurisdiction?: string;
  state?: string;
  agencyType?: string;
  vendorNamed?: string;
  fundingSource?: string;
  procurementType?: RapidIqPipelineProcurementType;
  dollarAmount?: number;
  summary?: string;
  contactHints?: RapidIqPipelineContactHint[];
};

export const patchRapidIqPipelineSignalBodySchema = z.object({
  status: z.enum(RAPID_IQ_PIPELINE_SIGNAL_STATUSES),
});
export type PatchRapidIqPipelineSignalBody = z.infer<typeof patchRapidIqPipelineSignalBodySchema>;

export const pushRapidIqPipelineToCrmBodySchema = z.object({
  overrideAgencyName: z.string().max(300).optional(),
  overrideContact: z
    .object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email().optional(),
      title: z.string().max(200).optional(),
    })
    .optional(),
  notes: z.string().max(4000).optional(),
});
export type PushRapidIqPipelineToCrmBody = z.infer<typeof pushRapidIqPipelineToCrmBodySchema>;

export const rapidIqPipelineCreditToolStatusSchema = z.object({
  used: z.number().int().min(0),
  limit: z.number().int().positive(),
  remaining: z.number().int().min(0),
  cycleStart: z.string().min(1),
  cycleEnd: z.string().min(1),
  updatedAt: z.string().optional(),
});
export type RapidIqPipelineCreditToolStatus = z.infer<
  typeof rapidIqPipelineCreditToolStatusSchema
>;

export const rapidIqPipelineCreditsResponseSchema = z.object({
  credits: z.object({
    apollo: rapidIqPipelineCreditToolStatusSchema,
    hunter: rapidIqPipelineCreditToolStatusSchema,
  }),
});
export type RapidIqPipelineCreditsResponse = z.infer<
  typeof rapidIqPipelineCreditsResponseSchema
>;

export const RAPID_IQ_PIPELINE_SOURCE_LABELS: Record<RapidIqPipelineSourceId, string> = {
  "usa-spending": "USASpending.gov",
  "sam-gov": "SAM.gov",
  "news-rss": "Gov News",
  "legistar-bulk": "County Minutes",
  socrata: "State Contracts",
  "state-911-board": "911 Board",
  "state-arpa": "ARPA Dashboard",
  openlegislative: "State Legislature",
};

export const RAPID_IQ_PIPELINE_FIT_SCORE_THRESHOLDS = {
  high: 80,
  medium: 60,
  low: 0,
} as const;

export function pipelineFitLabelFromScore(score: number): RapidIqPipelineFitLabel {
  if (score >= RAPID_IQ_PIPELINE_FIT_SCORE_THRESHOLDS.high) return "high";
  if (score >= RAPID_IQ_PIPELINE_FIT_SCORE_THRESHOLDS.medium) return "medium";
  return "low";
}
