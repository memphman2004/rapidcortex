/**
 * Public-sector buying intelligence taxonomy + classifiers.
 * Extends NexiQ beyond formal RFPs into pre-procurement discovery.
 * Pure shared helpers — no Dynamo / AWS.
 */

import { z } from "zod";
import {
  KEYWORDS,
  countKeywordHits,
  keywordMatches,
  type RapidIqProcurementStage,
} from "./signal-keywords.js";

/** Human-readable buying funnel (distinct from legacy procurementStage). */
export const RAPID_IQ_BUYING_STAGES = [
  "awareness",
  "planning",
  "funded",
  "evaluating",
  "procurement_live",
  "award_pending",
  "implementation",
  "renewal",
  "closed",
] as const;
export type RapidIqBuyingStage = (typeof RAPID_IQ_BUYING_STAGES)[number];

export const RAPID_IQ_SIGNAL_STRENGTHS = ["weak", "moderate", "strong", "confirmed"] as const;
export type RapidIqSignalStrength = (typeof RAPID_IQ_SIGNAL_STRENGTHS)[number];

export const RAPID_IQ_PRIORITY_BANDS = ["urgent", "high", "medium", "monitor"] as const;
export type RapidIqPriorityBand = (typeof RAPID_IQ_PRIORITY_BANDS)[number];

export const RAPID_IQ_BUYING_SIGNAL_TYPES = [
  "procurement",
  "evaluation",
  "planning",
  "funded",
  "pain_signal",
  "competitor_activity",
  "renewal",
  "implementation",
  "award",
  "early_signal",
] as const;
export type RapidIqBuyingSignalType = (typeof RAPID_IQ_BUYING_SIGNAL_TYPES)[number];

export const RAPID_IQ_SIGNAL_CATEGORIES = [
  "formal_rfp",
  "formal_rfi",
  "formal_rfq",
  "vendor_demo",
  "vendor_quote",
  "technology_evaluation",
  "budget_approved",
  "budget_proposed",
  "grant_awarded",
  "grant_requested",
  "contract_expiring",
  "contract_renewal",
  "incumbent_extension",
  "competitor_presentation",
  "competitor_selected",
  "new_cad",
  "new_ng911",
  "new_call_handling",
  "new_rtcc",
  "camera_expansion",
  "alpr_expansion",
  "data_integration",
  "staffing_problem",
  "call_volume_problem",
  "interoperability_problem",
  "consultant_engaged",
  "technology_study",
  "new_facility",
  "new_leadership",
  "implementation_hiring",
  "intelligence_center",
  "other",
] as const;
export type RapidIqSignalCategory = (typeof RAPID_IQ_SIGNAL_CATEGORIES)[number];

export const RAPID_IQ_CAPABILITY_TAGS = [
  "ai_call_assist",
  "non_emergency_call_handling",
  "transcription",
  "translation",
  "multimedia_intake",
  "citizen_video",
  "cad_integration",
  "cad_to_cad",
  "incident_intelligence",
  "supervisor_visibility",
  "qa_analytics",
  "mapping",
  "gis",
  "live_location",
  "camera_integration",
  "video_intelligence",
  "alpr_integration",
  "rtcc",
  "investigative_intelligence",
  "campus_reporting",
  "venue_reporting",
  "transit_reporting",
] as const;
export type RapidIqCapabilityTag = (typeof RAPID_IQ_CAPABILITY_TAGS)[number];

export const RAPID_IQ_PAIN_CATEGORIES = [
  "staffing",
  "call_volume",
  "abandoned_calls",
  "interoperability",
  "data_silos",
  "camera_silos",
  "manual_process",
  "language_access",
  "response_time",
  "legacy_system",
  "system_reliability",
  "location_accuracy",
  "training",
  "qa",
  "reporting",
  "cybersecurity",
] as const;
export type RapidIqPainCategory = (typeof RAPID_IQ_PAIN_CATEGORIES)[number];

export const RAPID_IQ_INTELLIGENCE_VERTICALS = [
  "911_psap",
  "campus",
  "venue",
  "transit",
  "law_enforcement_intelligence",
  "competitor_intelligence",
] as const;
export type RapidIqIntelligenceVertical = (typeof RAPID_IQ_INTELLIGENCE_VERTICALS)[number];

const CAPABILITY_RULES: Array<{ tag: RapidIqCapabilityTag; patterns: string[] }> = [
  { tag: "ai_call_assist", patterns: ["ai call", "artificial intelligence", "ai dispatch", "assistive"] },
  { tag: "non_emergency_call_handling", patterns: ["non-emergency", "non emergency", "311", "call assist"] },
  { tag: "transcription", patterns: ["transcription", "transcribe", "speech to text"] },
  { tag: "translation", patterns: ["translation", "language access", "interpreter", "multilingual"] },
  { tag: "multimedia_intake", patterns: ["multimedia", "text-to-911", "text to 911", "video to 911"] },
  { tag: "citizen_video", patterns: ["citizen video", "video share", "live video"] },
  { tag: "cad_integration", patterns: ["cad", "computer aided dispatch", "computer-aided dispatch"] },
  { tag: "cad_to_cad", patterns: ["cad-to-cad", "cad to cad", "inter-agency cad"] },
  { tag: "incident_intelligence", patterns: ["incident intelligence", "situational awareness", "common operating"] },
  { tag: "supervisor_visibility", patterns: ["supervisor", "floor supervisor", "qa supervisor"] },
  { tag: "qa_analytics", patterns: ["quality assurance", "call review", "qa score"] },
  { tag: "mapping", patterns: ["mapping", "map display"] },
  { tag: "gis", patterns: ["gis", "geographic information"] },
  { tag: "live_location", patterns: ["location accuracy", "dispatchable location", "aml", "live location"] },
  { tag: "camera_integration", patterns: ["camera", "cctv", "video wall"] },
  { tag: "video_intelligence", patterns: ["video analytics", "video intelligence", "lpr", "alpr"] },
  { tag: "alpr_integration", patterns: ["alpr", "license plate", "lpr"] },
  { tag: "rtcc", patterns: ["real time crime", "real-time crime", "rtcc", "fusion center", "intelligence center"] },
  { tag: "investigative_intelligence", patterns: ["investigative", "detective", "case intelligence"] },
  { tag: "campus_reporting", patterns: ["campus", "university", "school district", "clery"] },
  { tag: "venue_reporting", patterns: ["stadium", "arena", "venue", "concert"] },
  { tag: "transit_reporting", patterns: ["transit", "metro", "rail", "bus rapid"] },
];

const PAIN_RULES: Array<{ type: RapidIqPainCategory; patterns: string[] }> = [
  { type: "staffing", patterns: ["staffing shortage", "dispatcher shortage", "vacancy", "turnover", "cannot keep enough"] },
  { type: "call_volume", patterns: ["high call volume", "call volume", "surge"] },
  { type: "abandoned_calls", patterns: ["abandoned call", "abandonment rate"] },
  { type: "interoperability", patterns: ["interoperability", "mutual aid", "cannot connect"] },
  { type: "data_silos", patterns: ["data silo", "fragmented system", "duplicate data"] },
  { type: "camera_silos", patterns: ["camera silo", "separate camera", "multiple camera systems"] },
  { type: "manual_process", patterns: ["manual workflow", "manual process", "paper process"] },
  { type: "language_access", patterns: ["language access", "translation problem", "interpreter delay"] },
  { type: "response_time", patterns: ["response time", "slow response", "wait times"] },
  { type: "legacy_system", patterns: ["end of life", "end-of-life", "legacy system", "outdated", "twenty years old", "20 years old"] },
  { type: "system_reliability", patterns: ["system outage", "unsupported software", "reliability"] },
  { type: "location_accuracy", patterns: ["location accuracy", "wrong location", "gis problem"] },
  { type: "training", patterns: ["training workload", "training burden"] },
  { type: "qa", patterns: ["qa workload", "quality assurance backlog"] },
  { type: "reporting", patterns: ["reporting problem", "cannot report"] },
  { type: "cybersecurity", patterns: ["cybersecurity", "ransomware", "security incident"] },
];

const VENDOR_DEMO_PATTERNS = [
  "vendor demonstration",
  "vendor presentation",
  "product demonstration",
  "vendor demo",
  "product demo",
  "proof of concept",
  "pilot program",
  "bringing another vendor",
  "had motorola in",
  "axon presentation",
];

const RENEWAL_PATTERNS = [
  "contract expires",
  "contract expiration",
  "contract renewal",
  "maintenance renewal",
  "subscription renewal",
  "master agreement renewal",
  "approaching end",
  "renewal option",
];

const EVAL_PATTERNS = [
  "evaluating",
  "evaluation",
  "vendor evaluation",
  "evaluate vendors",
  "market research",
  "bringing another vendor",
];

export const rapidIqPainPointSchema = z.object({
  type: z.enum(RAPID_IQ_PAIN_CATEGORIES),
  description: z.string().max(500),
  source: z.string().url().max(2000).optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});
export type RapidIqPainPoint = z.infer<typeof rapidIqPainPointSchema>;

export const rapidIqBuyingIntelligenceSchema = z.object({
  buyingStage: z.enum(RAPID_IQ_BUYING_STAGES),
  signalStrength: z.enum(RAPID_IQ_SIGNAL_STRENGTHS),
  buyingSignalType: z.enum(RAPID_IQ_BUYING_SIGNAL_TYPES),
  signalCategory: z.enum(RAPID_IQ_SIGNAL_CATEGORIES),
  primaryVertical: z.enum(RAPID_IQ_INTELLIGENCE_VERTICALS),
  verticals: z.array(z.enum(RAPID_IQ_INTELLIGENCE_VERTICALS)).max(6),
  matchedCapabilities: z.array(z.enum(RAPID_IQ_CAPABILITY_TAGS)).max(20),
  painPoints: z.array(rapidIqPainPointSchema).max(20),
  facts: z.array(z.string().max(500)).max(20),
  inferences: z.array(z.string().max(500)).max(20),
  competitors: z.array(z.string().max(120)).max(20),
  priorityBand: z.enum(RAPID_IQ_PRIORITY_BANDS),
  priorityReasons: z.array(z.string().max(200)).max(12),
  correlationKey: z.string().max(200).optional(),
  techCategory: z.string().max(80).optional(),
});
export type RapidIqBuyingIntelligence = z.infer<typeof rapidIqBuyingIntelligenceSchema>;

export function mapProcurementStageToBuyingStage(
  stage: RapidIqProcurementStage | undefined,
): RapidIqBuyingStage {
  switch (stage) {
    case "rfp":
      return "procurement_live";
    case "rfi-planning":
      return "planning";
    case "budget-funded":
    case "funding-available":
      return "funded";
    case "early-awareness":
      return "awareness";
    case "competitor-win":
    case "future-opportunity":
      return "implementation";
    case "monitoring":
    default:
      return "awareness";
  }
}

export function matchCapabilities(text: string): RapidIqCapabilityTag[] {
  const out: RapidIqCapabilityTag[] = [];
  for (const rule of CAPABILITY_RULES) {
    if (rule.patterns.some((p) => keywordMatches(text, p))) out.push(rule.tag);
  }
  // Soft product-family matches for ECC / E911 / NG911 language
  if (countKeywordHits(text, KEYWORDS.product911) > 0) {
    for (const tag of ["incident_intelligence", "supervisor_visibility", "cad_integration"] as const) {
      if (!out.includes(tag)) out.push(tag);
    }
  }
  if (/\bng911\b|next generation 911|esinet/i.test(text) && !out.includes("live_location")) {
    out.push("live_location");
  }
  return out.slice(0, 20);
}

export function extractPainPoints(text: string, sourceUrl?: string): RapidIqPainPoint[] {
  const out: RapidIqPainPoint[] = [];
  for (const rule of PAIN_RULES) {
    const hit = rule.patterns.find((p) => keywordMatches(text, p));
    if (!hit) continue;
    out.push({
      type: rule.type,
      description: `Source mentions ${hit}.`,
      source: sourceUrl,
      confidence: "medium",
    });
  }
  return out.slice(0, 20);
}

export function detectNamedCompetitors(text: string): string[] {
  const found: string[] = [];
  for (const name of KEYWORDS.competitors) {
    if (keywordMatches(text, name)) found.push(name);
  }
  // Also catch short "Axon" / "Genetec" / "Flock" common in LE intel
  for (const extra of ["Axon", "Genetec", "Flock Safety", "Flock", "Vigilant", "INdigital", "Solacom", "NICE"]) {
    if (keywordMatches(text, extra) && !found.some((f) => f.toLowerCase().includes(extra.toLowerCase()))) {
      found.push(extra);
    }
  }
  return found.slice(0, 20);
}

export function classifyTechCategory(text: string): string {
  if (countKeywordHits(text, ["NG911", "Next Generation 911", "ESInet", "i3"]) > 0) return "ng911";
  if (countKeywordHits(text, ["CAD", "computer aided dispatch", "computer-aided dispatch"]) > 0) {
    return "cad";
  }
  if (countKeywordHits(text, ["real time crime", "rtcc", "intelligence center", "fusion"]) > 0) {
    return "rtcc_intel";
  }
  if (countKeywordHits(text, ["ALPR", "license plate", "camera", "video"]) > 0) return "video_alpr";
  if (countKeywordHits(text, KEYWORDS.product911) > 0) return "e911";
  if (countKeywordHits(text, KEYWORDS.campus) > 0) return "campus_safety";
  if (countKeywordHits(text, KEYWORDS.venue) > 0) return "venue_ops";
  if (countKeywordHits(text, KEYWORDS.transit) > 0) return "transit_ops";
  return "public_safety_tech";
}

export function classifyIntelligenceVerticals(text: string): {
  primary: RapidIqIntelligenceVertical;
  verticals: RapidIqIntelligenceVertical[];
} {
  const verticals: RapidIqIntelligenceVertical[] = [];
  if (countKeywordHits(text, KEYWORDS.product911) > 0) verticals.push("911_psap");
  if (countKeywordHits(text, KEYWORDS.campus) > 0) verticals.push("campus");
  if (countKeywordHits(text, KEYWORDS.venue) > 0) verticals.push("venue");
  if (countKeywordHits(text, KEYWORDS.transit) > 0) verticals.push("transit");
  if (
    countKeywordHits(text, ["real time crime", "rtcc", "intelligence center", "fusion center", "police"]) >
      0 &&
    countKeywordHits(text, KEYWORDS.product911) === 0
  ) {
    verticals.push("law_enforcement_intelligence");
  }
  if (countKeywordHits(text, KEYWORDS.competitors) > 0 || detectNamedCompetitors(text).length > 0) {
    verticals.push("competitor_intelligence");
  }
  if (verticals.length === 0) verticals.push("911_psap");
  const unique = [...new Set(verticals)];
  return { primary: unique[0]!, verticals: unique };
}

function hasFormalProcurementLanguage(text: string): boolean {
  // Ignore explicit negations like "No formal RFP issued."
  const scrubbed = text.replace(/\bno\s+formal\s+(rfp|rfi|rfq|solicitation)\b/gi, " ");
  return (
    /\b(rfp|rfi|rfq|itb|ifb)\b/i.test(scrubbed) ||
    /request for (proposal|information|qualifications)/i.test(scrubbed) ||
    /invitation to bid|sources sought|notice of intent/i.test(scrubbed)
  );
}

export function classifyBuyingStageFromText(
  text: string,
  legacyStage?: RapidIqProcurementStage,
): RapidIqBuyingStage {
  const t = text.toLowerCase();
  if (hasFormalProcurementLanguage(text) || legacyStage === "rfp") return "procurement_live";
  if (/contract awarded|vendor selected|award recommendation/i.test(t)) return "award_pending";
  if (/\b(implementing|implementation underway|go-live|cutover|migration project)\b/i.test(t)) {
    return "implementation";
  }
  if (VENDOR_DEMO_PATTERNS.some((p) => keywordMatches(text, p)) || EVAL_PATTERNS.some((p) => keywordMatches(text, p))) {
    return "evaluating";
  }
  if (
    detectNamedCompetitors(text).length > 0 &&
    /\b(quote|demonstration|presentation|pilot|evaluation|evaluating|vendor options)\b/i.test(t)
  ) {
    return "evaluating";
  }
  if (RENEWAL_PATTERNS.some((p) => keywordMatches(text, p))) return "renewal";
  if (countKeywordHits(text, KEYWORDS.funding) > 0) return "funded";
  if (countKeywordHits(text, KEYWORDS.planning) > 0) return "planning";
  return mapProcurementStageToBuyingStage(legacyStage);
}

export function classifyBuyingSignalType(text: string): RapidIqBuyingSignalType {
  if (hasFormalProcurementLanguage(text)) return "procurement";
  if (VENDOR_DEMO_PATTERNS.some((p) => keywordMatches(text, p))) return "evaluation";
  if (
    detectNamedCompetitors(text).length > 0 &&
    /\b(quote|demonstration|presentation|pilot|evaluation|evaluating|vendor options)\b/i.test(text)
  ) {
    return "evaluation";
  }
  if (EVAL_PATTERNS.some((p) => keywordMatches(text, p))) return "evaluation";
  if (RENEWAL_PATTERNS.some((p) => keywordMatches(text, p))) return "renewal";
  if (countKeywordHits(text, KEYWORDS.funding) > 0) return "funded";
  if (countKeywordHits(text, KEYWORDS.planning) > 0) return "planning";
  if (extractPainPoints(text).length > 0) return "pain_signal";
  if (detectNamedCompetitors(text).length > 0) return "competitor_activity";
  return "early_signal";
}

export function classifySignalCategory(
  text: string,
  buyingSignalType: RapidIqBuyingSignalType,
): RapidIqSignalCategory {
  const scrubbed = text.replace(/\bno\s+formal\s+(rfp|rfi|rfq|solicitation)\b/gi, " ");
  const t = scrubbed.toLowerCase();
  if (/\brfp\b|request for proposal/i.test(t)) return "formal_rfp";
  if (/\brfi\b|request for information/i.test(t)) return "formal_rfi";
  if (/\brfq\b|request for qualifications/i.test(t)) return "formal_rfq";
  if (VENDOR_DEMO_PATTERNS.some((p) => keywordMatches(text, p))) {
    return detectNamedCompetitors(text).length > 0 ? "competitor_presentation" : "vendor_demo";
  }
  if (/intelligence center|rtcc|real[- ]time crime/i.test(t)) return "intelligence_center";
  if (/ng911|next generation 911/i.test(t)) return "new_ng911";
  if (/\bcad\b|computer[- ]aided dispatch/i.test(t) && /replac|modern|new /i.test(t)) return "new_cad";
  if (/grant award|awarded.*grant/i.test(t)) return "grant_awarded";
  if (/budget approved|appropriat/i.test(t)) return "budget_approved";
  if (RENEWAL_PATTERNS.some((p) => keywordMatches(text, p))) return "contract_renewal";
  if (/staffing shortage|dispatcher shortage/i.test(t)) return "staffing_problem";
  if (/data silo|camera silo|integration/i.test(t)) return "data_integration";
  if (buyingSignalType === "evaluation") return "technology_evaluation";
  if (buyingSignalType === "funded") return "budget_proposed";
  if (buyingSignalType === "pain_signal") return "staffing_problem";
  return "other";
}

export function classifySignalStrength(input: {
  text: string;
  buyingStage: RapidIqBuyingStage;
  competitors: string[];
  hasFunding: boolean;
  hasPain: boolean;
}): RapidIqSignalStrength {
  const scrubbed = input.text.replace(/\bno\s+formal\s+(rfp|rfi|rfq|solicitation)\b/gi, " ");
  if (input.buyingStage === "procurement_live" || hasFormalProcurementLanguage(scrubbed)) {
    return "confirmed";
  }
  const demo = VENDOR_DEMO_PATTERNS.some((p) => keywordMatches(scrubbed, p));
  if (demo && (input.hasFunding || input.competitors.length > 0)) return "strong";
  if (demo || (input.hasFunding && input.competitors.length > 0)) return "strong";
  if (
    input.buyingStage === "evaluating" &&
    (input.competitors.length > 0 || input.hasFunding)
  ) {
    return "strong";
  }
  if (input.hasFunding || input.competitors.length > 0 || input.hasPain) return "moderate";
  return "weak";
}

export function buildPriorityReasons(intel: {
  buyingStage: RapidIqBuyingStage;
  signalStrength: RapidIqSignalStrength;
  matchedCapabilities: RapidIqCapabilityTag[];
  competitors: string[];
  hasFunding: boolean;
  hasPain: boolean;
  painPoints: RapidIqPainPoint[];
}): { band: RapidIqPriorityBand; reasons: string[] } {
  const reasons: string[] = [];
  if (intel.buyingStage === "procurement_live") reasons.push("Formal procurement activity");
  if (intel.buyingStage === "evaluating") reasons.push("Vendor evaluation / demos underway");
  if (intel.hasFunding) reasons.push("Funding evidence identified");
  if (intel.competitors.length) reasons.push(`Vendor activity: ${intel.competitors.slice(0, 3).join(", ")}`);
  if (intel.matchedCapabilities.includes("cad_integration")) reasons.push("CAD integration fit");
  if (intel.matchedCapabilities.includes("transcription") || intel.matchedCapabilities.includes("translation")) {
    reasons.push("Transcription / translation fit");
  }
  if (intel.matchedCapabilities.includes("rtcc") || intel.matchedCapabilities.includes("investigative_intelligence")) {
    reasons.push("RTCC / investigative intelligence fit");
  }
  if (intel.hasPain) {
    reasons.push(`Operational pain: ${intel.painPoints.map((p) => p.type).slice(0, 2).join(", ")}`);
  }
  if (intel.signalStrength === "confirmed" || intel.signalStrength === "strong") {
    reasons.push(`Signal strength: ${intel.signalStrength}`);
  }

  let band: RapidIqPriorityBand = "monitor";
  if (intel.buyingStage === "procurement_live" && intel.matchedCapabilities.length > 0) band = "urgent";
  else if (
    intel.buyingStage === "evaluating" ||
    (intel.signalStrength === "strong" && intel.matchedCapabilities.length >= 2)
  ) {
    band = "high";
  } else if (intel.signalStrength === "moderate" || intel.hasFunding || intel.hasPain) band = "medium";

  return { band, reasons: reasons.slice(0, 12) };
}

/** Stable correlation key: STATE|AgencySlug|TechCategory (for multi-document merge). */
export function computeCorrelationKey(input: {
  agencyName?: string;
  state?: string;
  techCategory: string;
}): string {
  const state = (input.state ?? "XX").toUpperCase().slice(0, 2);
  const agency = (input.agencyName ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 48);
  return `${state}|${agency}|${input.techCategory}`.toUpperCase().slice(0, 200);
}

/**
 * Classify buying intelligence from free text (deterministic, no LLM).
 * Separates FACT-style summary lines from INFERENCE-style next-step language.
 */
export function classifyBuyingIntelligence(input: {
  title: string;
  text: string;
  sourceUrl?: string;
  agencyName?: string;
  state?: string;
  procurementStage?: RapidIqProcurementStage;
}): RapidIqBuyingIntelligence {
  const hay = `${input.title}\n${input.text}`;
  const buyingSignalType = classifyBuyingSignalType(hay);
  const signalCategory = classifySignalCategory(hay, buyingSignalType);
  const buyingStage = classifyBuyingStageFromText(hay, input.procurementStage);
  const competitors = detectNamedCompetitors(hay);
  const painPoints = extractPainPoints(hay, input.sourceUrl);
  const matchedCapabilities = matchCapabilities(hay);
  const hasFunding = countKeywordHits(hay, KEYWORDS.funding) > 0;
  const hasPain = painPoints.length > 0;
  const signalStrength = classifySignalStrength({
    text: hay,
    buyingStage,
    competitors,
    hasFunding,
    hasPain,
  });
  const { primary, verticals } = classifyIntelligenceVerticals(hay);
  const techCategory = classifyTechCategory(hay);
  const { band, reasons } = buildPriorityReasons({
    buyingStage,
    signalStrength,
    matchedCapabilities,
    competitors,
    hasFunding,
    hasPain,
    painPoints,
  });

  const facts: string[] = [];
  if (buyingSignalType === "procurement") facts.push("Formal procurement language detected in source.");
  if (competitors.length) facts.push(`Named vendor(s) referenced: ${competitors.slice(0, 4).join(", ")}.`);
  if (hasFunding) facts.push("Funding / budget / grant language detected.");
  for (const p of painPoints.slice(0, 3)) facts.push(p.description);

  const inferences: string[] = [];
  if (buyingStage === "evaluating") {
    inferences.push("Agency may be in active technology evaluation.");
  }
  if (matchedCapabilities.length) {
    inferences.push(
      `Potential NexCort capability overlap: ${matchedCapabilities.slice(0, 4).join(", ")}.`,
    );
  }
  if (buyingStage !== "procurement_live" && buyingSignalType !== "procurement") {
    inferences.push("No formal solicitation claimed — treat as pre-RFP intelligence.");
  }

  return {
    buyingStage,
    signalStrength,
    buyingSignalType,
    signalCategory,
    primaryVertical: primary,
    verticals,
    matchedCapabilities,
    painPoints,
    facts: facts.slice(0, 20),
    inferences: inferences.slice(0, 20),
    competitors,
    priorityBand: band,
    priorityReasons: reasons,
    correlationKey: computeCorrelationKey({
      agencyName: input.agencyName,
      state: input.state,
      techCategory,
    }),
    techCategory,
  };
}
