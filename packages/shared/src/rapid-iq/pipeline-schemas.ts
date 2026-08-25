import { z } from "zod";
import {
  classifyProcurementStage,
  RAPID_IQ_PROCUREMENT_STAGES,
  type RapidIqProcurementStage,
  type ScoreEvidence,
} from "./signal-keywords.js";

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
  "county-procurement",
  "rapid-iq", // queued from Rapid IQ opportunity cards
  "grants-gov",
  "911-gov",
  "trade-publication",
  "competitor-intel",
  "boarddocs",
  "civiclerk",
  "sourcewell-omnia",
  "university-procurement",
  "fcc-reports",
  "manual",
] as const;
export type RapidIqPipelineSourceId = (typeof RAPID_IQ_PIPELINE_SOURCE_IDS)[number];

/** Rapid IQ inbox + pipeline slice (matches the dashboard tabs). */
export const RAPID_IQ_PIPELINE_FEED_TABS = ["911", "campus", "venue", "competitor"] as const;
export type RapidIqPipelineFeedTab = (typeof RAPID_IQ_PIPELINE_FEED_TABS)[number];

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

export const RAPID_IQ_CONTACT_CONFIDENCE = {
  OFFICIAL_DIRECTORY: 5,
  HUNTER_VERIFIED: 4,
  APOLLO_VERIFIED: 3,
  APOLLO_INFERRED: 2,
  EXTRACTED_DOC: 1,
  UNKNOWN: 0,
} as const;
export type RapidIqContactConfidence =
  (typeof RAPID_IQ_CONTACT_CONFIDENCE)[keyof typeof RAPID_IQ_CONTACT_CONFIDENCE];

export const RAPID_IQ_CONTACT_CONFIDENCE_LABELS: Record<
  RapidIqContactConfidence,
  { label: string; color: string }
> = {
  5: { label: "Official Directory", color: "#10b981" },
  4: { label: "Hunter Verified", color: "#0080C0" },
  3: { label: "Apollo Verified", color: "#0080C0" },
  2: { label: "Apollo Inferred", color: "#f59e0b" },
  1: { label: "Extracted", color: "#f59e0b" },
  0: { label: "Unknown", color: "#94a3b8" },
};

export const rapidIqScoreEvidenceSchema = z.object({
  factor: z.string().min(1),
  contribution: z.number(),
  sourceExcerpt: z.string(),
  sourceUrl: z.string(),
});
export type RapidIqScoreEvidence = ScoreEvidence;

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
  /** Buying intent 0–100. Optional so existing Dynamo items still parse. */
  buyingIntentScore: z.number().min(0).max(100).optional(),
  productFitScore: z.number().min(0).max(100).optional(),
  combinedScore: z.number().min(0).max(100).optional(),
  intentEvidence: z.array(rapidIqScoreEvidenceSchema).optional(),
  fitEvidence: z.array(rapidIqScoreEvidenceSchema).optional(),
  excerpt: z.string().max(500).optional(),
  sourceTitle: z.string().max(400).optional(),
  sourceDomain: z.string().max(200).optional(),
  retrievalDate: z.string().optional(),
  documentDate: z.string().optional(),
  pageLocation: z.string().max(200).optional(),
  taxonomyTags: z.array(z.string().min(1).max(80)).max(40).optional(),
  recommendedAction: z.string().max(400).optional(),
  /** Linked Rapid IQ agency profile (pipeline table pk AGENCY#…). */
  agencyProfileId: z.string().min(1).max(128).optional(),
  manualEntry: z.boolean().optional(),
  enteredBy: z.string().max(200).optional(),
  deadline: z.string().max(32).optional(),
  procurementStage: z.enum(RAPID_IQ_PROCUREMENT_STAGES).optional(),
  competitorName: z.string().max(200).optional(),
  competitorProduct: z.string().max(200).optional(),
  estimatedContractEnd: z.string().max(32).optional(),

  status: z.enum(RAPID_IQ_PIPELINE_SIGNAL_STATUSES),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  crmLeadId: z.string().optional(),
  pushedAt: z.string().optional(),
  /** Set when an opportunity is queued from the Rapid IQ feed. */
  opportunityId: z.string().min(1).optional(),
  /** Inbox / pipeline category. Inferred client-side when omitted. */
  vertical: z.enum(RAPID_IQ_PIPELINE_FEED_TABS).optional(),
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

export const patchRapidIqPipelineSignalBodySchema = z
  .object({
    status: z.enum(RAPID_IQ_PIPELINE_SIGNAL_STATUSES).optional(),
    procurementStage: z.enum(RAPID_IQ_PROCUREMENT_STAGES).optional(),
  })
  .refine((body) => body.status != null || body.procurementStage != null, {
    message: "status or procurementStage is required",
  });
export type PatchRapidIqPipelineSignalBody = z.infer<typeof patchRapidIqPipelineSignalBodySchema>;

export const createManualRapidIqPipelineSignalBodySchema = z.object({
  manualEntry: z.literal(true),
  agencyName: z.string().min(1).max(300),
  state: z.string().min(2).max(2),
  title: z.string().min(1).max(500),
  sourceUrl: z.string().url().max(2000),
  sourceName: z.string().max(200).optional(),
  documentDate: z.string().max(32).optional(),
  deadline: z.string().max(32).optional(),
  estimatedValue: z.string().max(80).optional(),
  procurementStage: z.enum(RAPID_IQ_PROCUREMENT_STAGES),
  excerpt: z.string().max(500).optional(),
  agencyType: z.string().max(100).optional(),
});
export type CreateManualRapidIqPipelineSignalBody = z.infer<
  typeof createManualRapidIqPipelineSignalBodySchema
>;

export const RAPID_IQ_AGENCY_TYPES = [
  "psap",
  "sheriff",
  "police",
  "fire",
  "ems",
  "campus",
  "venue",
  "ema",
  "unknown",
] as const;
export type RapidIqAgencyType = (typeof RAPID_IQ_AGENCY_TYPES)[number];

export const rapidIqKnownContractSchema = z.object({
  vendor: z.string().min(1).max(200),
  product: z.string().max(200).optional(),
  estimatedExpiry: z.string().max(32).optional(),
  source: z.string().max(400),
  confidence: z.enum(["confirmed", "inferred"]),
});
export type RapidIqKnownContract = z.infer<typeof rapidIqKnownContractSchema>;

export const rapidIqAgencyProfileSchema = z.object({
  agencyId: z.string().min(1),
  name: z.string().min(1),
  agencyType: z.string().min(1),
  state: z.string().max(2).optional(),
  county: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  population: z.number().optional(),
  websiteUrl: z.string().optional(),
  contactEmail: z.string().optional(),
  buyingIntentScore: z.number().min(0).max(100),
  productFitScore: z.number().min(0).max(100),
  combinedScore: z.number().min(0).max(100),
  procurementStage: z.enum(RAPID_IQ_PROCUREMENT_STAGES),
  signalCount: z.number().int().min(0),
  lastSignalDate: z.string(),
  firstSignalDate: z.string(),
  incumbentVendors: z.array(z.string()).optional(),
  knownContracts: z.array(rapidIqKnownContractSchema).optional(),
  estimatedValue: z.string().max(80).optional(),
  recommendedAction: z.string().max(400),
  nextAction: z.string().max(400).optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type RapidIqAgencyProfile = z.infer<typeof rapidIqAgencyProfileSchema>;

export const rapidIqAgencyContactSchema = z.object({
  contactId: z.string().min(1),
  agencyId: z.string().min(1),
  name: z.string().min(1),
  title: z.string().optional(),
  role: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  sourceUrl: z.string(),
  sourceName: z.string(),
  confidence: z.number().int().min(0).max(5),
  hunterConfidence: z.number().optional(),
  lastVerified: z.string(),
});
export type RapidIqAgencyContact = z.infer<typeof rapidIqAgencyContactSchema>;

export const rapidIqResearchRequestSchema = z.object({
  query: z.string().min(3).max(2000),
  filters: z
    .object({
      states: z.array(z.string().max(2)).max(50).optional(),
      agencyTypes: z.array(z.string().max(40)).max(20).optional(),
      dateRange: z
        .object({
          from: z.string().min(1),
          to: z.string().min(1),
        })
        .optional(),
      minIntentScore: z.number().min(0).max(100).optional(),
    })
    .optional(),
});
export type RapidIqResearchRequest = z.infer<typeof rapidIqResearchRequestSchema>;

export const rapidIqResearchResponseSchema = z.object({
  answer: z.string(),
  supportingAgencies: z.array(rapidIqAgencyProfileSchema).optional(),
  supportingSignals: z.array(rapidIqPipelineSignalSchema),
  citations: z
    .array(
      z.object({
        agencyName: z.string().optional(),
        title: z.string(),
        sourceUrl: z.string(),
        excerpt: z.string().optional(),
      }),
    )
    .optional(),
  confidence: z.enum(["high", "medium", "low"]),
  disclaimer: z.string(),
  mocked: z.boolean().optional(),
});
export type RapidIqResearchResponse = z.infer<typeof rapidIqResearchResponseSchema>;

export function displayPipelineScores(signal: {
  fitScore: number;
  buyingIntentScore?: number;
  productFitScore?: number;
  combinedScore?: number;
}): { intent: number; fit: number; combined: number } {
  const intent = signal.buyingIntentScore ?? signal.fitScore;
  const fit = signal.productFitScore ?? signal.fitScore;
  const combined = signal.combinedScore ?? signal.fitScore;
  return { intent, fit, combined };
}

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
  "county-procurement": "County Procurement",
  "rapid-iq": "Rapid IQ",
  "grants-gov": "Grants.gov",
  "911-gov": "911.gov",
  "trade-publication": "APCO / NENA",
  "competitor-intel": "Competitor Intel",
  boarddocs: "BoardDocs",
  civiclerk: "CivicClerk",
  "sourcewell-omnia": "Co-op Purchasing",
  "university-procurement": "University Procurement",
  "fcc-reports": "FCC 911",
  manual: "Manual Entry",
};

export const enqueueRapidIqPipelineFromOpportunityBodySchema = z.object({
  opportunityId: z.string().min(1).max(128),
  agencyName: z.string().min(1).max(300),
  headline: z.string().max(500).optional(),
  summary: z.string().max(4000).optional(),
  state: z.string().max(2).optional(),
  city: z.string().max(200).optional(),
  agencyType: z.string().max(100).optional(),
  vendorNamed: z.string().max(200).optional(),
  fitScore: z.number().min(0).max(100).optional(),
  estimatedDollarValue: z.number().optional(),
  vertical: z.enum(RAPID_IQ_PIPELINE_FEED_TABS).optional(),
});
export type EnqueueRapidIqPipelineFromOpportunityBody = z.infer<
  typeof enqueueRapidIqPipelineFromOpportunityBodySchema
>;

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

const CAMPUS_RE =
  /\b(university|college|campus|school district|k-12|higher education|student safety|dormitory)\b/i;
const VENUE_RE =
  /\b(stadium|arena|amphitheatre|amphitheater|venue|concert|festival|racetrack|ballpark|convention center)\b/i;

/**
 * Map a pipeline / collector signal onto the Rapid IQ category tabs.
 * Explicit `vertical` wins; otherwise keywords + source; default is 911.
 */
export function classifyPipelineFeedTab(input: {
  sourceId?: string;
  agencyType?: string;
  vendorNamed?: string;
  rawTitle?: string;
  summary?: string;
  rawSnippet?: string;
  vertical?: string;
}): RapidIqPipelineFeedTab {
  if (
    input.vertical === "911" ||
    input.vertical === "campus" ||
    input.vertical === "venue" ||
    input.vertical === "competitor"
  ) {
    return input.vertical;
  }
  if (input.agencyType === "competitor_watch") return "competitor";
  if (input.sourceId === "competitor-intel") return "competitor";
  if (input.sourceId === "university-procurement") return "campus";
  if (
    input.sourceId === "state-911-board" ||
    input.sourceId === "911-gov" ||
    input.sourceId === "grants-gov" ||
    input.sourceId === "fcc-reports"
  ) {
    return "911";
  }

  const hay = [input.agencyType, input.vendorNamed, input.rawTitle, input.summary, input.rawSnippet]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(" ");

  if (/\bcompetitor\b|displacement/i.test(hay)) return "competitor";
  if (CAMPUS_RE.test(hay)) return "campus";
  if (VENUE_RE.test(hay)) return "venue";
  return "911";
}

/** Incoming inbox: collector ingest not yet accepted into Pipeline. */
export function isPipelineInboxSignal(signal: {
  status: RapidIqPipelineSignalStatus;
  sourceId: string;
}): boolean {
  return signal.status === "new" && signal.sourceId !== "rapid-iq";
}

/** Queued for CRM: explicitly sent from a category, or already reviewed. */
export function isPipelineQueueSignal(signal: {
  status: RapidIqPipelineSignalStatus;
  sourceId: string;
}): boolean {
  if (signal.status === "reviewed") return true;
  return signal.status === "new" && signal.sourceId === "rapid-iq";
}

export function resolveProcurementStage(signal: {
  procurementStage?: string;
  sourceId?: string;
  rawTitle?: string;
  rawSnippet?: string;
  summary?: string;
}): RapidIqProcurementStage {
  if (
    signal.procurementStage &&
    (RAPID_IQ_PROCUREMENT_STAGES as readonly string[]).includes(signal.procurementStage)
  ) {
    return signal.procurementStage as RapidIqProcurementStage;
  }
  if (signal.sourceId === "competitor-intel") return "competitor-win";
  if (signal.sourceId === "grants-gov") return "funding-available";
  const hay = [signal.rawTitle, signal.summary, signal.rawSnippet]
    .filter((v): v is string => Boolean(v && v.trim()))
    .join(" ");
  return classifyProcurementStage(hay);
}
