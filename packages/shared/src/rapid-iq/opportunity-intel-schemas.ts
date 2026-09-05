import { z } from "zod";

/** Markets RapidIQ Opportunity Intelligence can score. */
export const RAPID_IQ_INTEL_MARKETS = ["TRANSIT", "PSAP", "CAMPUS", "VENUE", "PARTNER"] as const;
export type RapidIqIntelMarket = (typeof RAPID_IQ_INTEL_MARKETS)[number];

export const RAPID_IQ_INTEL_OPPORTUNITY_TYPES = [
  "RFP",
  "RFI",
  "RFQ",
  "RFB",
  "PROCUREMENT_NOTICE",
  "BOARD_AGENDA",
  "BUDGET_SIGNAL",
  "CAPITAL_PLAN",
  "PRESS_RELEASE",
  "PRE_RFP_SIGNAL",
  "AWARD",
  "OTHER",
] as const;
export type RapidIqIntelOpportunityType = (typeof RAPID_IQ_INTEL_OPPORTUNITY_TYPES)[number];

export const RAPID_IQ_INTEL_PRODUCTS = ["CORE", "TRANSIT", "CAMPUS", "VENUE", "CONNECT"] as const;
export type RapidIqIntelProduct = (typeof RAPID_IQ_INTEL_PRODUCTS)[number];

export const RAPID_IQ_INTEL_RECOMMENDATIONS = ["PURSUE", "PARTNER", "WATCH", "IGNORE"] as const;
export type RapidIqIntelRecommendation = (typeof RAPID_IQ_INTEL_RECOMMENDATIONS)[number];

export const RAPID_IQ_INTEL_STATUSES = [
  "NEW",
  "WATCHING",
  "QUALIFIED",
  "PURSUING",
  "PASSED",
  "WON",
  "LOST",
] as const;
export type RapidIqIntelStatus = (typeof RAPID_IQ_INTEL_STATUSES)[number];

export const RAPID_IQ_INTEL_SOURCE_TYPES = [
  "openai_web_search",
  "web_page",
  "rss",
  "procurement_api",
  "crawler",
  "manual_url",
] as const;
export type RapidIqIntelSourceType = (typeof RAPID_IQ_INTEL_SOURCE_TYPES)[number];

export const RAPID_IQ_INTEL_OUTREACH_AUDIENCES = [
  "CIO",
  "Transit Police Chief",
  "Emergency Management",
  "Procurement",
  "Operations",
  "Prime Contractor",
  "Systems Integrator",
] as const;
export type RapidIqIntelOutreachAudience = (typeof RAPID_IQ_INTEL_OUTREACH_AUDIENCES)[number];

export const RAPID_IQ_INTEL_PROCUREMENT_STAGE_LABELS: Record<number, string> = {
  0: "No Signal",
  1: "Problem Identified",
  2: "Strategic Initiative",
  3: "Budget Discussion",
  4: "Funding Approved",
  5: "Consultant / Assessment",
  6: "RFI / Market Research",
  7: "Draft Solicitation",
  8: "RFP / RFQ / Active Solicitation",
  9: "Evaluation",
  10: "Award",
};

export const RAPID_IQ_INTEL_SEARCH_TOPICS = [
  "public safety",
  "transit police",
  "security",
  "communications",
  "CAD",
  "dispatch",
  "emergency dispatch",
  "911",
  "NG911",
  "emergency management",
  "operations centers",
  "command centers",
  "incident management",
  "rider reporting",
  "passenger reporting",
  "GIS",
  "mapping",
  "location",
  "video",
  "camera integrations",
  "media intake",
  "analytics",
  "QA",
  "translation",
  "transcription",
  "interoperability",
  "API modernization",
  "real-time intelligence",
  "situational awareness",
  "security operations",
  "SOC",
  "EOC",
  "technology modernization",
] as const;

const score10 = z.number().min(0).max(10);
const confidence01 = z.number().min(0).max(1);
const stage0to10 = z.number().int().min(0).max(10);

export const rapidIqIntelContactSchema = z.object({
  name: z.string().optional(),
  title: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
});
export type RapidIqIntelContact = z.infer<typeof rapidIqIntelContactSchema>;

export const rapidIqIntelSupportingSourceSchema = z.object({
  url: z.string().min(1),
  title: z.string().optional(),
  sourceType: z.enum(RAPID_IQ_INTEL_SOURCE_TYPES).optional(),
  /** Attribution id. Discovered-URL rows use "openai-web-search". */
  sourceId: z.string().optional(),
  retrievedAt: z.string().optional(),
});
export type RapidIqIntelSupportingSource = z.infer<typeof rapidIqIntelSupportingSourceSchema>;

export const rapidIqIntelOpportunitySchema = z.object({
  id: z.string().min(1),
  agencyId: z.string().optional(),
  agency: z.string().min(1),
  market: z.enum(RAPID_IQ_INTEL_MARKETS),
  title: z.string().min(1),
  solicitationNumber: z.string().optional(),
  opportunityType: z.enum(RAPID_IQ_INTEL_OPPORTUNITY_TYPES),
  issuingDepartment: z.string().optional(),
  postedDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedValue: z.number().optional(),
  estimatedValueText: z.string().optional(),
  currency: z.string().optional(),
  contact: rapidIqIntelContactSchema.optional(),
  sourceUrl: z.string().min(1),
  sourceName: z.string().optional(),
  categories: z.array(z.string()),
  rapidCortexProducts: z.array(z.enum(RAPID_IQ_INTEL_PRODUCTS)),
  fitScore: score10,
  winSignal: score10,
  confidence: confidence01,
  recommendation: z.enum(RAPID_IQ_INTEL_RECOMMENDATIONS),
  procurementStage: stage0to10,
  preRfpSignal: z.boolean(),
  reason: z.string(),
  recommendedAction: z.string(),
  competitiveNotes: z.string().optional(),
  partnerStrategy: z.string().optional(),
  incumbentTechnology: z.array(z.string()).optional(),
  discoveredAt: z.string(),
  lastUpdatedAt: z.string(),
  status: z.enum(RAPID_IQ_INTEL_STATUSES),
  fingerprint: z.string().optional(),
  retrievedAt: z.string().optional(),
  analyzedAt: z.string().optional(),
  modelUsed: z.string().optional(),
  sources: z.array(rapidIqIntelSupportingSourceSchema).optional(),
  aiRecommendation: z.enum(RAPID_IQ_INTEL_RECOMMENDATIONS).optional(),
  userRecommendation: z.enum(RAPID_IQ_INTEL_RECOMMENDATIONS).optional(),
  userFitScore: score10.optional(),
  userWinSignal: score10.optional(),
  userProcurementStage: stage0to10.optional(),
  pursuitBrief: z.string().optional(),
  watchId: z.string().optional(),
  notes: z.string().optional(),
});
export type RapidIqIntelOpportunity = z.infer<typeof rapidIqIntelOpportunitySchema>;

export const rapidIqIntelAiExtractionSchema = z.object({
  agency: z.string().min(1),
  title: z.string().min(1),
  solicitationNumber: z.string().nullable().optional(),
  opportunityType: z.enum(RAPID_IQ_INTEL_OPPORTUNITY_TYPES),
  issuingDepartment: z.string().nullable().optional(),
  postedDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedValue: z.number().nullable().optional(),
  estimatedValueText: z.string().nullable().optional(),
  currency: z.string().nullable().optional(),
  contact: rapidIqIntelContactSchema.nullable().optional(),
  categories: z.array(z.string()),
  rapidCortexProducts: z.array(z.enum(RAPID_IQ_INTEL_PRODUCTS)),
  fitScore: score10,
  winSignal: score10,
  confidence: confidence01,
  recommendation: z.enum(RAPID_IQ_INTEL_RECOMMENDATIONS),
  procurementStage: stage0to10,
  preRfpSignal: z.boolean(),
  reason: z.string(),
  recommendedAction: z.string(),
  competitiveNotes: z.string().nullable().optional(),
  partnerStrategy: z.string().nullable().optional(),
  incumbentTechnology: z.array(z.string()).nullable().optional(),
});
export type RapidIqIntelAiExtraction = z.infer<typeof rapidIqIntelAiExtractionSchema>;

export const rapidIqIntelClassificationSchema = z.object({
  relevant: z.boolean(),
  market: z.enum(RAPID_IQ_INTEL_MARKETS),
  opportunityType: z.enum(RAPID_IQ_INTEL_OPPORTUNITY_TYPES),
  preRfpSignal: z.boolean(),
  estimatedFit: score10,
  reason: z.string(),
});
export type RapidIqIntelClassification = z.infer<typeof rapidIqIntelClassificationSchema>;

export const rapidIqIntelSourceDocumentSchema = z.object({
  sourceId: z.string().min(1),
  agencyId: z.string().optional(),
  url: z.string().min(1),
  title: z.string(),
  text: z.string(),
  publishedAt: z.string().optional(),
  retrievedAt: z.string(),
  sourceType: z.enum(RAPID_IQ_INTEL_SOURCE_TYPES),
  sourceName: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type RapidIqIntelSourceDocument = z.infer<typeof rapidIqIntelSourceDocumentSchema>;

export const rapidIqIntelWatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  agency: z.string().min(1),
  market: z.enum(RAPID_IQ_INTEL_MARKETS),
  enabled: z.boolean(),
  keywords: z.array(z.string()),
  sourceDomains: z.array(z.string()),
  sourceUrls: z.array(z.string()),
  minimumFitScore: z.number().min(0).max(10),
  /** Min fit for pre-solicitation / sources-sought (defaults to 5 when omitted). */
  preRfpFloor: z.number().min(0).max(10).optional(),
  /** Per-watch OpenAI web-search discovery. Global flag must also be on. */
  webSearchEnabled: z.boolean().optional(),
  region: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RapidIqIntelWatch = z.infer<typeof rapidIqIntelWatchSchema>;

export const createRapidIqIntelWatchBodySchema = z.object({
  name: z.string().min(1),
  agency: z.string().min(1),
  market: z.enum(RAPID_IQ_INTEL_MARKETS).default("TRANSIT"),
  enabled: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  sourceDomains: z.array(z.string()).optional(),
  sourceUrls: z.array(z.string()).optional(),
  minimumFitScore: z.number().min(0).max(10).optional(),
  preRfpFloor: z.number().min(0).max(10).optional(),
  webSearchEnabled: z.boolean().optional(),
  region: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateRapidIqIntelWatchBody = z.infer<typeof createRapidIqIntelWatchBodySchema>;

export const patchRapidIqIntelWatchBodySchema = createRapidIqIntelWatchBodySchema.partial();
export type PatchRapidIqIntelWatchBody = z.infer<typeof patchRapidIqIntelWatchBodySchema>;

export const patchRapidIqIntelOpportunityBodySchema = z.object({
  status: z.enum(RAPID_IQ_INTEL_STATUSES).optional(),
  userFitScore: score10.optional(),
  userWinSignal: score10.optional(),
  userRecommendation: z.enum(RAPID_IQ_INTEL_RECOMMENDATIONS).optional(),
  userProcurementStage: stage0to10.optional(),
  notes: z.string().optional(),
});
export type PatchRapidIqIntelOpportunityBody = z.infer<typeof patchRapidIqIntelOpportunityBodySchema>;

export const rapidIqIntelOutreachBodySchema = z.object({
  audience: z.enum(RAPID_IQ_INTEL_OUTREACH_AUDIENCES),
});
export type RapidIqIntelOutreachBody = z.infer<typeof rapidIqIntelOutreachBodySchema>;

export const rapidIqIntelWatchJobSchema = z.object({
  kind: z.literal("intel-watch"),
  watchId: z.string().min(1),
});
export type RapidIqIntelWatchJob = z.infer<typeof rapidIqIntelWatchJobSchema>;

export const rapidIqIntelManualIngestBodySchema = z.object({
  url: z.string().url(),
  agency: z.string().min(1).optional(),
  watchId: z.string().optional(),
  market: z.enum(RAPID_IQ_INTEL_MARKETS).optional(),
});
export type RapidIqIntelManualIngestBody = z.infer<typeof rapidIqIntelManualIngestBodySchema>;

export const rapidIqIntelPursuitBriefSchema = z.object({
  executiveSummary: z.string(),
  agency: z.string(),
  opportunity: z.string(),
  procurementStage: z.string(),
  rapidCortexFit: z.string(),
  winSignal: z.string(),
  whyThisMatters: z.string(),
  likelyCustomerNeed: z.string(),
  rapidCortexCapabilities: z.string(),
  potentialGaps: z.string(),
  competitiveEnvironment: z.string(),
  partnerStrategy: z.string(),
  decisionMakers: z.string(),
  recommendedNextActions: z.string(),
  bidNoBidRecommendation: z.string(),
});
export type RapidIqIntelPursuitBrief = z.infer<typeof rapidIqIntelPursuitBriefSchema>;

export const rapidIqIntelBidNoBidSchema = z.object({
  recommendation: z.enum(["BID", "NO_BID", "CONDITIONAL"]),
  rationale: z.string(),
  conditions: z.array(z.string()),
});
export type RapidIqIntelBidNoBid = z.infer<typeof rapidIqIntelBidNoBidSchema>;

export function normalizeIntelTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeIntelUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${host}${path}${parsed.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function intelFingerprintKey(input: {
  agency: string;
  solicitationNumber?: string | null;
  title: string;
  dueDate?: string | null;
}): string {
  return [
    input.agency.trim().toLowerCase(),
    (input.solicitationNumber ?? "").trim().toLowerCase(),
    normalizeIntelTitle(input.title),
    (input.dueDate ?? "").trim(),
  ].join("|");
}

export function effectiveIntelFit(row: RapidIqIntelOpportunity): number {
  return row.userFitScore ?? row.fitScore;
}

export function effectiveIntelWin(row: RapidIqIntelOpportunity): number {
  return row.userWinSignal ?? row.winSignal;
}

export function effectiveIntelRecommendation(row: RapidIqIntelOpportunity): RapidIqIntelRecommendation {
  return row.userRecommendation ?? row.aiRecommendation ?? row.recommendation;
}

export function effectiveIntelStage(row: RapidIqIntelOpportunity): number {
  return row.userProcurementStage ?? row.procurementStage;
}

export function intelStrategicPriority(row: RapidIqIntelOpportunity): number {
  const dueBoost = row.dueDate
    ? Math.max(0, 10 - Math.min(10, daysUntil(row.dueDate) / 3))
    : 0;
  return (
    effectiveIntelFit(row) * 3 +
    effectiveIntelWin(row) * 2 +
    effectiveIntelStage(row) +
    (row.preRfpSignal ? 4 : 0) +
    dueBoost
  );
}

function daysUntil(isoDate: string): number {
  const t = Date.parse(isoDate);
  if (!Number.isFinite(t)) return 365;
  return (t - Date.now()) / 86_400_000;
}

export function mapIntelMarketToFeedTab(
  market: RapidIqIntelMarket,
): "911" | "campus" | "venue" | "transit" | "competitor" {
  if (market === "PSAP") return "911";
  if (market === "CAMPUS") return "campus";
  if (market === "VENUE") return "venue";
  if (market === "PARTNER") return "competitor";
  return "transit";
}
