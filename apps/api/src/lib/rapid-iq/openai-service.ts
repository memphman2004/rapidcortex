import {
  RAPID_IQ_INTEL_SEARCH_TOPICS,
  classifyProcurementStage,
  isRelevantSignalText,
  rapidIqIntelAiExtractionSchema,
  rapidIqIntelBidNoBidSchema,
  rapidIqIntelClassificationSchema,
  rapidIqIntelPursuitBriefSchema,
  scoreFit,
  type RapidIqIntelAiExtraction,
  type RapidIqIntelBidNoBid,
  type RapidIqIntelClassification,
  type RapidIqIntelMarket,
  type RapidIqIntelOpportunity,
  type RapidIqIntelOpportunityType,
  type RapidIqIntelOutreachAudience,
  type RapidIqIntelPursuitBrief,
  type RapidIqIntelSourceDocument,
} from "rapid-cortex-shared";
import { isCollectorsMockEnabled } from "./agenda-finder.js";
import { recommendPursuit } from "./intel-recommend.js";
import { createJsonResponse } from "./openai-client.js";
import {
  isRapidIqAiEnabled,
  rapidIqHighValueThreshold,
  rapidIqModelAnalysis,
  rapidIqModelClassification,
  rapidIqModelStrategy,
} from "./openai-config.js";
import {
  RAPID_CORTEX_INTEL_PRODUCT_CONTEXT,
  RAPID_IQ_FIT_SCORE_CONTEXT,
  RAPID_IQ_PROCUREMENT_STAGE_CONTEXT,
  RAPID_IQ_RECOMMENDATION_CONTEXT,
  RAPID_IQ_WIN_SIGNAL_CONTEXT,
} from "./openai-prompts.js";

function parseJsonLoose<T>(text: string): unknown {
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

const EXTRACTION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    agency: { type: "string" },
    title: { type: "string" },
    solicitationNumber: { type: ["string", "null"] },
    opportunityType: {
      type: "string",
      enum: [
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
      ],
    },
    issuingDepartment: { type: ["string", "null"] },
    postedDate: { type: ["string", "null"] },
    dueDate: { type: ["string", "null"] },
    estimatedValue: { type: ["number", "null"] },
    estimatedValueText: { type: ["string", "null"] },
    currency: { type: ["string", "null"] },
    contact: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        title: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
      },
    },
    categories: { type: "array", items: { type: "string" } },
    rapidCortexProducts: {
      type: "array",
      items: { type: "string", enum: ["CORE", "TRANSIT", "CAMPUS", "VENUE", "CONNECT"] },
    },
    fitScore: { type: "number" },
    winSignal: { type: "number" },
    confidence: { type: "number" },
    recommendation: { type: "string", enum: ["PURSUE", "PARTNER", "WATCH", "IGNORE"] },
    procurementStage: { type: "integer" },
    preRfpSignal: { type: "boolean" },
    reason: { type: "string" },
    recommendedAction: { type: "string" },
    competitiveNotes: { type: ["string", "null"] },
    partnerStrategy: { type: ["string", "null"] },
    incumbentTechnology: { type: ["array", "null"], items: { type: "string" } },
  },
  required: [
    "agency",
    "title",
    "opportunityType",
    "categories",
    "rapidCortexProducts",
    "fitScore",
    "winSignal",
    "confidence",
    "recommendation",
    "procurementStage",
    "preRfpSignal",
    "reason",
    "recommendedAction",
  ],
};

const CLASSIFICATION_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevant: { type: "boolean" },
    market: { type: "string", enum: ["TRANSIT", "PSAP", "CAMPUS", "VENUE", "PARTNER"] },
    opportunityType: {
      type: "string",
      enum: [
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
      ],
    },
    preRfpSignal: { type: "boolean" },
    estimatedFit: { type: "number" },
    reason: { type: "string" },
  },
  required: ["relevant", "market", "opportunityType", "preRfpSignal", "estimatedFit", "reason"],
};

function useLiveAi(): boolean {
  return isRapidIqAiEnabled() && !isCollectorsMockEnabled();
}

function stageFromKeywords(text: string): number {
  const stage = classifyProcurementStage(text);
  const map: Record<string, number> = {
    rfp: 8,
    "rfi-planning": 6,
    "budget-funded": 4,
    "funding-available": 4,
    "early-awareness": 2,
    "competitor-win": 10,
    "future-opportunity": 2,
    monitoring: 1,
  };
  return map[stage] ?? 0;
}

function typeFromText(text: string): RapidIqIntelOpportunityType {
  const t = text.toLowerCase();
  if (/\brfp\b|request for proposal/.test(t)) return "RFP";
  if (/\brfi\b|request for information/.test(t)) return "RFI";
  if (/\brfq\b|request for qualification/.test(t)) return "RFQ";
  if (/\brfb\b|invitation to bid|\bitb\b/.test(t)) return "RFB";
  if (/award|notice of award/.test(t)) return "AWARD";
  if (/agenda|minutes/.test(t)) return "BOARD_AGENDA";
  if (/capital (improvement|plan)|cip\b/.test(t)) return "CAPITAL_PLAN";
  if (/budget/.test(t)) return "BUDGET_SIGNAL";
  if (/press release/.test(t)) return "PRESS_RELEASE";
  if (/pre-?solicitation|industry day/.test(t)) return "PRE_RFP_SIGNAL";
  return "OTHER";
}

export function heuristicClassifyProcurementSignal(
  doc: RapidIqIntelSourceDocument,
  market: RapidIqIntelMarket,
): RapidIqIntelClassification {
  const hay = `${doc.title}\n${doc.text}`.slice(0, 20_000);
  const fit100 = scoreFit(hay, doc.sourceType);
  const estimatedFit = Math.round((fit100 / 10) * 10) / 10;
  const relevant = isRelevantSignalText(hay) || estimatedFit >= 5;
  const stage = stageFromKeywords(hay);
  return {
    relevant,
    market,
    opportunityType: typeFromText(hay),
    preRfpSignal: stage > 0 && stage < 8,
    estimatedFit: Math.min(10, estimatedFit),
    reason: relevant
      ? "Keyword overlap with Rapid Cortex public-safety / transit capabilities."
      : "Limited Rapid Cortex product overlap.",
  };
}

export function heuristicAnalyzeOpportunity(
  doc: RapidIqIntelSourceDocument,
  market: RapidIqIntelMarket,
): RapidIqIntelAiExtraction {
  const classified = heuristicClassifyProcurementSignal(doc, market);
  const hay = `${doc.title}\n${doc.text}`;
  const stage = stageFromKeywords(hay);
  const rec = recommendPursuit({
    fitScore: classified.estimatedFit,
    procurementStage: stage,
    preRfpSignal: classified.preRfpSignal,
  });
  return {
    agency:
      doc.agencyId ||
      (typeof doc.metadata?.agency === "string" ? doc.metadata.agency : "Unknown agency"),
    title: doc.title || "Untitled opportunity",
    opportunityType: classified.opportunityType,
    categories: [...RAPID_IQ_INTEL_SEARCH_TOPICS].filter((topic) =>
      hay.toLowerCase().includes(topic.toLowerCase()),
    ).slice(0, 8),
    rapidCortexProducts: market === "TRANSIT" ? ["TRANSIT", "CORE"] : ["CORE"],
    fitScore: classified.estimatedFit,
    winSignal: Math.min(10, Math.max(0, stage / 2 + classified.estimatedFit / 2)),
    confidence: classified.relevant ? 0.45 : 0.2,
    recommendation: rec,
    procurementStage: stage,
    preRfpSignal: classified.preRfpSignal,
    reason: classified.reason,
    recommendedAction:
      rec === "PURSUE"
        ? "Qualify requirements and identify the contracting vehicle."
        : rec === "WATCH"
          ? "Track the next board/budget cycle and capture contacts."
          : "Do not pursue.",
  };
}

function systemPrompt(): string {
  return [
    RAPID_CORTEX_INTEL_PRODUCT_CONTEXT,
    RAPID_IQ_PROCUREMENT_STAGE_CONTEXT,
    RAPID_IQ_FIT_SCORE_CONTEXT,
    RAPID_IQ_WIN_SIGNAL_CONTEXT,
    RAPID_IQ_RECOMMENDATION_CONTEXT,
    "Return JSON only. Source-derived facts in the document (dates, solicitation numbers, dollar amounts, URLs) take precedence over inference.",
  ].join("\n\n");
}

export async function classifyProcurementSignal(
  doc: RapidIqIntelSourceDocument,
  market: RapidIqIntelMarket,
): Promise<{ result: RapidIqIntelClassification; model: string; heuristic: boolean }> {
  const fallback = heuristicClassifyProcurementSignal(doc, market);
  if (!useLiveAi()) {
    return { result: fallback, model: "heuristic", heuristic: true };
  }
  const raw = await createJsonResponse({
    model: rapidIqModelClassification(),
    system: systemPrompt(),
    jsonSchemaName: "rapid_iq_classification",
    jsonSchema: CLASSIFICATION_SCHEMA,
    user: JSON.stringify({
      market,
      url: doc.url,
      title: doc.title,
      publishedAt: doc.publishedAt,
      text: doc.text.slice(0, 12_000),
    }),
  });
  if (!raw) return { result: fallback, model: "heuristic", heuristic: true };
  const parsed = rapidIqIntelClassificationSchema.safeParse(parseJsonLoose(raw.text));
  if (!parsed.success) return { result: fallback, model: raw.model, heuristic: true };
  return { result: parsed.data, model: raw.model, heuristic: false };
}

export function shouldUseAnalysisModel(input: {
  fitScore: number;
  preRfpSignal: boolean;
  estimatedValue?: number | null;
}): boolean {
  if (input.preRfpSignal) return true;
  if (input.fitScore >= 7) return true;
  const value = input.estimatedValue ?? 0;
  return value >= rapidIqHighValueThreshold();
}

export async function analyzeOpportunity(
  doc: RapidIqIntelSourceDocument,
  market: RapidIqIntelMarket,
  classified?: RapidIqIntelClassification,
): Promise<{ result: RapidIqIntelAiExtraction; model: string; heuristic: boolean }> {
  const fallback = heuristicAnalyzeOpportunity(doc, market);
  const gateFit = classified?.estimatedFit ?? fallback.fitScore;
  const gatePreRfp = classified?.preRfpSignal ?? fallback.preRfpSignal;
  if (!useLiveAi()) {
    return { result: fallback, model: "heuristic", heuristic: true };
  }
  const model = shouldUseAnalysisModel({
    fitScore: gateFit,
    preRfpSignal: gatePreRfp,
  })
    ? rapidIqModelAnalysis()
    : rapidIqModelClassification();
  const raw = await createJsonResponse({
    model,
    system: systemPrompt(),
    jsonSchemaName: "rapid_iq_opportunity",
    jsonSchema: EXTRACTION_SCHEMA,
    user: JSON.stringify({
      market,
      url: doc.url,
      title: doc.title,
      publishedAt: doc.publishedAt,
      sourceName: doc.sourceName,
      classification: classified ?? {
        estimatedFit: fallback.fitScore,
        preRfpSignal: fallback.preRfpSignal,
      },
      text: doc.text.slice(0, 24_000),
    }),
  });
  if (!raw) return { result: fallback, model: "heuristic", heuristic: true };
  const parsed = rapidIqIntelAiExtractionSchema.safeParse(parseJsonLoose(raw.text));
  if (!parsed.success) return { result: fallback, model: raw.model, heuristic: true };
  return { result: parsed.data, model: raw.model, heuristic: false };
}

export async function generatePursuitBrief(
  opportunity: RapidIqIntelOpportunity,
): Promise<{ result: RapidIqIntelPursuitBrief; model: string } | null> {
  if (!useLiveAi()) {
    return {
      model: "heuristic",
      result: {
        executiveSummary: opportunity.reason,
        agency: opportunity.agency,
        opportunity: opportunity.title,
        procurementStage: String(opportunity.procurementStage),
        rapidCortexFit: opportunity.reason,
        winSignal: String(opportunity.winSignal),
        whyThisMatters: opportunity.reason,
        likelyCustomerNeed: opportunity.recommendedAction,
        rapidCortexCapabilities: "Complementary incident intelligence and interoperability.",
        potentialGaps: "Confirm CAD/radio incumbents before proposing a prime bid.",
        competitiveEnvironment: opportunity.competitiveNotes ?? "Unknown",
        partnerStrategy: opportunity.partnerStrategy ?? "Evaluate SI/prime path.",
        decisionMakers: opportunity.contact?.title ?? "CIO / operations / procurement",
        recommendedNextActions: opportunity.recommendedAction,
        bidNoBidRecommendation: opportunity.recommendation,
      },
    };
  }
  const raw = await createJsonResponse({
    model: rapidIqModelStrategy(),
    system: systemPrompt(),
    jsonSchemaName: "rapid_iq_pursuit_brief",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        executiveSummary: { type: "string" },
        agency: { type: "string" },
        opportunity: { type: "string" },
        procurementStage: { type: "string" },
        rapidCortexFit: { type: "string" },
        winSignal: { type: "string" },
        whyThisMatters: { type: "string" },
        likelyCustomerNeed: { type: "string" },
        rapidCortexCapabilities: { type: "string" },
        potentialGaps: { type: "string" },
        competitiveEnvironment: { type: "string" },
        partnerStrategy: { type: "string" },
        decisionMakers: { type: "string" },
        recommendedNextActions: { type: "string" },
        bidNoBidRecommendation: { type: "string" },
      },
      required: [
        "executiveSummary",
        "agency",
        "opportunity",
        "procurementStage",
        "rapidCortexFit",
        "winSignal",
        "whyThisMatters",
        "likelyCustomerNeed",
        "rapidCortexCapabilities",
        "potentialGaps",
        "competitiveEnvironment",
        "partnerStrategy",
        "decisionMakers",
        "recommendedNextActions",
        "bidNoBidRecommendation",
      ],
    },
    user: JSON.stringify(opportunity),
  });
  if (!raw) return null;
  const parsed = rapidIqIntelPursuitBriefSchema.safeParse(parseJsonLoose(raw.text));
  return parsed.success ? { result: parsed.data, model: raw.model } : null;
}

export async function generateOutreach(
  opportunity: RapidIqIntelOpportunity,
  audience: RapidIqIntelOutreachAudience,
): Promise<{ text: string; model: string } | null> {
  if (!useLiveAi()) {
    return {
      model: "heuristic",
      text: `Regarding ${opportunity.title} at ${opportunity.agency}: Rapid Cortex can complement existing ${opportunity.incumbentTechnology?.join(", ") || "operations"} with incident intelligence and interoperability. Recommended next step: ${opportunity.recommendedAction}`,
    };
  }
  const raw = await createJsonResponse({
    model: rapidIqModelStrategy(),
    system: `${systemPrompt()}\nWrite concise, specific outreach for the named audience. No generic marketing.`,
    jsonSchemaName: "rapid_iq_outreach",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: { text: { type: "string" } },
      required: ["text"],
    },
    user: JSON.stringify({ audience, opportunity }),
  });
  if (!raw) return null;
  const parsed = parseJsonLoose(raw.text) as { text?: string } | null;
  if (!parsed?.text) return null;
  return { text: parsed.text, model: raw.model };
}

export async function generateBidNoBidAnalysis(
  opportunity: RapidIqIntelOpportunity,
): Promise<{ result: RapidIqIntelBidNoBid; model: string } | null> {
  if (!useLiveAi()) {
    const rec =
      opportunity.recommendation === "PURSUE"
        ? "BID"
        : opportunity.recommendation === "IGNORE"
          ? "NO_BID"
          : "CONDITIONAL";
    return {
      model: "heuristic",
      result: {
        recommendation: rec,
        rationale: opportunity.reason,
        conditions: opportunity.partnerStrategy ? [opportunity.partnerStrategy] : [],
      },
    };
  }
  const raw = await createJsonResponse({
    model: rapidIqModelStrategy(),
    system: systemPrompt(),
    jsonSchemaName: "rapid_iq_bid_no_bid",
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        recommendation: { type: "string", enum: ["BID", "NO_BID", "CONDITIONAL"] },
        rationale: { type: "string" },
        conditions: { type: "array", items: { type: "string" } },
      },
      required: ["recommendation", "rationale", "conditions"],
    },
    user: JSON.stringify(opportunity),
  });
  if (!raw) return null;
  const parsed = rapidIqIntelBidNoBidSchema.safeParse(parseJsonLoose(raw.text));
  return parsed.success ? { result: parsed.data, model: raw.model } : null;
}
