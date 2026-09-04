/**
 * Shared Rapid IQ keyword library, procurement-stage classification, and fit scoring.
 * Used by pipeline ingest Lambdas and the Rapid IQ UI (stage badges / filters).
 */

export const KEYWORDS = {
  // ── CRITICAL — direct procurement signals ───────────────
  rfp: [
    "request for proposal",
    "RFP",
    "request for information",
    "RFI",
    "request for qualifications",
    "RFQ",
    "invitation to bid",
    "ITB",
    "solicitation",
    "bid opening",
    "vendor selection",
  ],

  // ── STAGE 3 — budget/funding identified ─────────────────
  funding: [
    "capital improvement plan",
    "CIP",
    "capital budget",
    "technology budget",
    "budget appropriation",
    "grant award",
    "SICG",
    "COPS grant",
    "NG911 grant",
    "Byrne JAG",
    "ARPA",
    "SLFRF",
    "FEMA grant",
    "homeland security grant",
    "funding approved",
    "budget approved",
    "appropriated",
    "911 fee",
    "E911 surcharge",
    "technology levy",
  ],

  // ── STAGE 2 — planning/evaluation ───────────────────────
  planning: [
    "needs assessment",
    "technology assessment",
    "feasibility study",
    "staff recommends",
    "evaluate vendors",
    "evaluate options",
    "modernization plan",
    "strategic plan",
    "technology refresh",
    "system evaluation",
    "vendor evaluation",
    "market research",
    "request for information",
    "industry day",
    "pre-solicitation",
  ],

  // ── STAGE 1 — problem identification ────────────────────
  problem: [
    "end of life",
    "end-of-life",
    "legacy system",
    "aging system",
    "outdated system",
    "system replacement",
    "approaching end",
    "contract expiration",
    "contract expires",
    "aging infrastructure",
    "system limitations",
    "staffing shortage",
    "dispatcher shortage",
    "vacancy rate",
    "turnover",
    "outdated technology",
  ],

  // ── 911 CORE product keywords ────────────────────────────
  product911: [
    "911",
    "9-1-1",
    "NG911",
    "Next Generation 911",
    "next-generation 911",
    "PSAP",
    "public safety answering point",
    "emergency communications center",
    "ECC",
    "dispatch center",
    "call center",
    "call handling",
    "CAD",
    "computer aided dispatch",
    "computer-aided dispatch",
    "911 transcription",
    "911 translation",
    "call transcription",
    "AI dispatch",
    "assistive dispatch",
    "intelligent dispatch",
    "call taking",
    "AI call taking",
    "assistive call taking",
    "ESInet",
    "i3",
    "NG911 standard",
    "Text-to-911",
    "text to 911",
    "multimedia 911",
    "location accuracy",
    "dispatchable location",
    "GIS",
    "geographic information system",
    "radio interoperability",
    "P25",
  ],

  // ── Campus vertical keywords ─────────────────────────────
  campus: [
    "campus safety",
    "campus security",
    "campus police",
    "university police",
    "campus dispatch",
    "campus emergency",
    "Clery Act",
    "annual security report",
    "mass notification",
    "emergency notification system",
    "blue light",
    "campus surveillance",
    "security operations center",
    "SOC",
  ],

  // ── Venue vertical keywords ──────────────────────────────
  venue: [
    "stadium security",
    "arena security",
    "venue security",
    "event security",
    "crowd management",
    "incident command",
    "venue operations center",
    "security operations",
    "arena dispatch",
    "venue communications",
  ],

  // ── Transit vertical keywords ────────────────────────────
  transit: [
    "transit police",
    "transit security",
    "bus operations",
    "rail operations",
    "light rail",
    "commuter rail",
    "subway",
    "ferry operations",
    "rider reporting",
    "passenger reporting",
    "control center",
    "operations control center",
    "OCC",
    "transit CAD",
    "bus CAD",
    "rail CAD",
    "paratransit",
    "fare evasion",
    "station security",
  ],

  // ── Competitor monitoring ────────────────────────────────
  competitors: [
    "Motorola Solutions",
    "VESTA",
    "CommandCentral",
    "PremierOne",
    "CentralSquare",
    "Tyler Technologies",
    "Tyler Public Safety",
    "Hexagon",
    "HxGN OnCall",
    "RapidDeploy",
    "Intrado",
    "West Technology",
    "Prepared",
    "Carbyne",
    "Versaterm",
    "Mark43",
    "Axon 911",
    "Axon Records",
    "Evidence.com",
    "RapidSOS",
    "Rave Mobile",
  ],

  // ── High-value geographic filters ───────────────────────
  geography: [
    "county",
    "parish",
    "borough",
    "sheriff",
    "sheriff's office",
    "police department",
    "fire department",
    "fire rescue",
    "emergency management",
    "homeland security",
    "municipality",
    "township",
    "city of",
    "town of",
  ],
} as const;

/** Extra ingest relevance (legacy collectors used these; keep signal volume from dropping). */
export const EXTRA_RELEVANCE_KEYWORDS = [
  "dispatch",
  "public safety software",
  "public safety communications",
  "Axon",
] as const;

/**
 * Civic IQ Signals — official public records across agencies, not only 911/CAD language.
 * Used by meeting / budget / procurement collectors. News and federal SAM stay on
 * `isRelevantSignalText` so national RSS does not ingest every council recap.
 */
export const CIVIC_IQ_MEETING_KEYWORDS = [
  "city council minutes",
  "city council agenda",
  "city council meeting",
  "school board agenda",
  "school board minutes",
  "school board meeting",
  "county commission",
  "board of county commissioners",
  "utility board",
  "water board",
  "public utility commission",
  "regular meeting agenda",
  "regular meeting minutes",
  "work session agenda",
  "budget workshop",
] as const;

export const CIVIC_IQ_BUDGET_KEYWORDS = [
  "adopted budget",
  "proposed budget",
  "annual budget",
  "operating budget",
  "capital improvement plan",
  "capital improvement program",
  "IT strategic plan",
  "information technology strategic plan",
  "technology strategic plan",
  "department budget request",
  "budget request",
  "budget presentation",
] as const;

export const CIVIC_IQ_PROCUREMENT_KEYWORDS = [
  "contract award",
  "contract awarded",
  "notice of award",
  "expiration record",
  "contract expiration",
  "contract expires",
  "cooperative purchasing",
  "cooperative contract",
  "cooperative procurement",
  "sole source",
  "sole-source",
  "sole source justification",
  "piggyback contract",
] as const;

export type KeywordCategory = keyof typeof KEYWORDS;

/** Grants.gov search2 keyword queries (911 / PSAP / CAD vertical). */
export const GRANTS_GOV_SEARCH_KEYWORDS = [
  "911 emergency communications",
  "next generation 911",
  "NG911",
  "public safety answering point",
  "PSAP",
  "emergency communications center",
  "CAD computer aided dispatch",
  "law enforcement technology",
  "campus safety",
  "first responder",
] as const;

/** OpenStates / LegiScan bill search queries — all 50 states via unscoped `q`. */
export const OPENSTATES_BILL_QUERIES = [
  "911",
  "NG911",
  "next generation 911",
  "PSAP",
  "public safety answering point",
  "emergency communications",
  "computer aided dispatch",
  "CAD",
  "911 transcription",
  "911 translation",
  "first responder technology",
  "law enforcement technology",
  "campus safety",
  "campus security",
  "emergency notification",
  "Text to 911",
  "ESInet",
  "location accuracy",
  "dispatchable location",
] as const;

export const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export const RAPID_IQ_PROCUREMENT_STAGES = [
  "rfp",
  "rfi-planning",
  "budget-funded",
  "funding-available",
  "early-awareness",
  "competitor-win",
  "future-opportunity",
  "monitoring",
] as const;
export type RapidIqProcurementStage = (typeof RAPID_IQ_PROCUREMENT_STAGES)[number];

export const PROCUREMENT_STAGE_LABELS: Record<
  RapidIqProcurementStage,
  { label: string; color: string }
> = {
  rfp: { label: "RFP", color: "#ff4444" },
  "rfi-planning": { label: "PLANNING", color: "#f07030" },
  "budget-funded": { label: "FUNDED", color: "#c8c020" },
  "funding-available": { label: "FUNDED", color: "#c8c020" },
  "early-awareness": { label: "EARLY SIGNAL", color: "#3dc43d" },
  "competitor-win": { label: "COMPETITOR WIN", color: "#8758e8" },
  "future-opportunity": { label: "COMPETITOR WIN", color: "#8758e8" },
  monitoring: { label: "MONITORING", color: "#5a7090" },
};

export const RAPID_IQ_PROCUREMENT_STAGE_FILTERS = [
  { id: "all", label: "All" },
  { id: "rfp", label: "RFP" },
  { id: "planning", label: "Planning" },
  { id: "funded", label: "Funded" },
  { id: "early", label: "Early Signal" },
  { id: "competitor", label: "Competitor Intel" },
] as const;
export type RapidIqProcurementStageFilterId =
  (typeof RAPID_IQ_PROCUREMENT_STAGE_FILTERS)[number]["id"];

const FILTER_STAGES: Record<RapidIqProcurementStageFilterId, readonly RapidIqProcurementStage[] | null> =
  {
    all: null,
    rfp: ["rfp"],
    planning: ["rfi-planning"],
    funded: ["budget-funded", "funding-available"],
    early: ["early-awareness"],
    competitor: ["competitor-win", "future-opportunity"],
  };

const regexCache = new Map<string, RegExp>();

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Short tokens / acronyms use word boundaries so "CAD" does not match "cascade". */
export function keywordMatches(text: string, keyword: string): boolean {
  const cached = regexCache.get(keyword);
  if (cached) return cached.test(text);
  const escaped = escapeRegExp(keyword);
  const isAcronym = /^[A-Z0-9][A-Z0-9+./-]{0,12}$/.test(keyword);
  const pattern =
    keyword.length <= 5 || isAcronym
      ? new RegExp(`\\b${escaped}\\b`, "i")
      : new RegExp(escaped.replace(/\s+/g, "\\s+"), "i");
  regexCache.set(keyword, pattern);
  return pattern.test(text);
}

export function countKeywordHits(text: string, keywords: readonly string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (keywordMatches(text, keyword)) hits += 1;
  }
  return hits;
}

/** Product / vertical relevance — RFP language alone is not enough (avoids debris bids). */
export function isRelevantSignalText(text: string): boolean {
  return (
    countKeywordHits(text, KEYWORDS.product911) > 0 ||
    countKeywordHits(text, KEYWORDS.campus) > 0 ||
    countKeywordHits(text, KEYWORDS.venue) > 0 ||
    countKeywordHits(text, KEYWORDS.transit) > 0 ||
    countKeywordHits(text, KEYWORDS.competitors) > 0 ||
    countKeywordHits(text, EXTRA_RELEVANCE_KEYWORDS) > 0
  );
}

/** Official civic document types Civic IQ is supposed to surface. */
export function isCivicIqSignalText(text: string): boolean {
  return (
    countKeywordHits(text, CIVIC_IQ_MEETING_KEYWORDS) > 0 ||
    countKeywordHits(text, CIVIC_IQ_BUDGET_KEYWORDS) > 0 ||
    countKeywordHits(text, CIVIC_IQ_PROCUREMENT_KEYWORDS) > 0 ||
    countKeywordHits(text, KEYWORDS.rfp) > 0 ||
    countKeywordHits(text, KEYWORDS.funding) > 0 ||
    countKeywordHits(text, KEYWORDS.planning) > 0
  );
}

/**
 * Ingest gate for civic collectors (meetings, budgets, local procurement portals).
 * Product-only collectors (news, SAM.gov, grants) should keep `isRelevantSignalText`.
 */
export function isCivicDocumentIngestText(text: string): boolean {
  return isRelevantSignalText(text) || isCivicIqSignalText(text);
}

export function classifyProcurementStage(text: string): RapidIqProcurementStage {
  if (countKeywordHits(text, KEYWORDS.rfp) > 0) return "rfp";
  if (countKeywordHits(text, KEYWORDS.planning) > 0) return "rfi-planning";
  if (countKeywordHits(text, KEYWORDS.funding) > 0) return "budget-funded";
  if (countKeywordHits(text, KEYWORDS.problem) > 0) return "early-awareness";
  return "monitoring";
}

/** Map pipeline sourceId onto scoreFit sourceType buckets. */
export function scoreSourceType(sourceId: string): string {
  switch (sourceId) {
    case "sam-gov":
      return "sam-gov";
    case "grants-gov":
      return "grants-gov";
    case "911-gov":
    case "fcc-reports":
      return "911-gov";
    case "county-procurement":
    case "sourcewell-omnia":
    case "university-procurement":
      return "procurement";
    case "legistar-bulk":
      return "legistar";
    case "boarddocs":
    case "civiclerk":
      return "boarddocs";
    case "trade-publication":
      return "trade-publication";
    case "news-rss":
      return "news";
    default:
      return sourceId;
  }
}

/** Fit score 0–100 from keyword overlap + stage + source reliability. */
export function scoreFit(text: string, sourceType: string): number {
  let score = 0;

  const product911Hits = countKeywordHits(text, KEYWORDS.product911);
  score += Math.min(product911Hits * 8, 50);

  const campusHits = countKeywordHits(text, KEYWORDS.campus);
  const venueHits = countKeywordHits(text, KEYWORDS.venue);
  const transitHits = countKeywordHits(text, KEYWORDS.transit);
  score += Math.min((campusHits + venueHits + transitHits) * 4, 16);

  const stage = classifyProcurementStage(text);
  const stageBonus: Record<string, number> = {
    rfp: 30,
    "rfi-planning": 20,
    "budget-funded": 15,
    "early-awareness": 8,
  };
  score += stageBonus[stage] ?? 0;

  const sourceBonus: Record<string, number> = {
    "sam-gov": 15,
    "grants-gov": 12,
    "911-gov": 15,
    procurement: 20,
    legistar: 10,
    boarddocs: 10,
    "trade-publication": 8,
    news: 6,
    "competitor-intel": 10,
    "fcc-reports": 12,
    openlegislative: 10,
    "state-911-board": 12,
  };
  score += sourceBonus[sourceType] ?? sourceBonus[scoreSourceType(sourceType)] ?? 0;

  if (countKeywordHits(text, KEYWORDS.funding) > 0) score += 10;
  if (countKeywordHits(text, KEYWORDS.competitors) > 0) score += 8;

  return Math.min(score, 100);
}

export function matchesProcurementStageFilter(
  stage: RapidIqProcurementStage | undefined,
  filterId: RapidIqProcurementStageFilterId,
): boolean {
  const allowed = FILTER_STAGES[filterId];
  if (!allowed) return true;
  if (!stage) return false;
  return (allowed as readonly string[]).includes(stage);
}

export function inferCompetitorName(text: string): string | undefined {
  for (const name of KEYWORDS.competitors) {
    if (keywordMatches(text, name)) return name;
  }
  return undefined;
}

/** Buying-intent points (capped at 100 when summed). */
export const INTENT_FACTORS = {
  activeRfp: 30,
  rfiOrPlanning: 20,
  budgetIdentified: 15,
  earlyDiscussion: 8,
  multipleSignals: 10,
  signalRecency: 8,
  leadershipChange: 5,
  incumbentExpiring: 12,
  competitorMentioned: 6,
  grantAwarded: 10,
} as const;

/** Product-fit points (capped at 100 when summed). */
export const FIT_FACTORS = {
  isPsap911: 30,
  isLawEnforcement: 20,
  isFireEms: 15,
  isCampus: 20,
  isVenue: 15,
  isTransit: 20,
  mentionsTranscription: 15,
  mentionsTranslation: 15,
  mentionsNg911: 15,
  mentionsCad: 12,
  mentionsAiDispatch: 20,
  mentionsQa: 10,
  agencySize: 8,
} as const;

export type ScoreEvidence = {
  factor: string;
  contribution: number;
  sourceExcerpt: string;
  sourceUrl: string;
};

export type SignalScores = {
  buyingIntentScore: number;
  productFitScore: number;
  combinedScore: number;
  intentEvidence: ScoreEvidence[];
  fitEvidence: ScoreEvidence[];
};

export type ScoreSignalOptions = {
  sourceUrl?: string;
  signalDate?: string;
  relatedSignalCount?: number;
  agencyType?: string;
};

export const PS_TAXONOMY = {
  technology: [
    "ng911",
    "next-generation-911",
    "psap-modernization",
    "cad-replacement",
    "cad-integration",
    "call-handling",
    "real-time-transcription",
    "translation",
    "ai-call-taking",
    "emergency-communications",
    "location-intelligence",
    "video-to-911",
    "multimedia-911",
    "real-time-crime-center",
    "emergency-management",
    "campus-safety",
    "venue-security",
    "qa-analytics",
    "interoperability",
    "cjis-security",
    "ng911-eido",
    "text-to-911",
    "gis-mapping",
  ],
  procurement: [
    "rfp",
    "rfi",
    "rfq",
    "sole-source",
    "cooperative-contract",
    "budget-appropriation",
    "capital-improvement",
    "grant-award",
  ],
  stage: [
    "problem-discussion",
    "needs-assessment",
    "staff-recommendation",
    "budget-identified",
    "vendor-evaluation",
    "solicitation",
    "award",
    "implementation",
  ],
} as const;

/** Kanban columns (procurement stage pipeline). Competitor / future map to won-lost. */
export const RAPID_IQ_KANBAN_COLUMNS = [
  { id: "monitoring", label: "Monitoring", color: "#5a7090" },
  { id: "early-awareness", label: "Early Signal", color: "#3dc43d" },
  { id: "budget-funded", label: "Funded", color: "#c8c020" },
  { id: "rfi-planning", label: "Planning/RFI", color: "#f07030" },
  { id: "rfp", label: "Active RFP", color: "#E00020" },
  { id: "competitor-win", label: "Won/Lost", color: "#8758e8" },
] as const;
export type RapidIqKanbanColumnId = (typeof RAPID_IQ_KANBAN_COLUMNS)[number]["id"];

const STAGE_PRIORITY: RapidIqProcurementStage[] = [
  "rfp",
  "rfi-planning",
  "budget-funded",
  "funding-available",
  "early-awareness",
  "competitor-win",
  "future-opportunity",
  "monitoring",
];

const RFP_KEYWORDS = [
  "request for proposal",
  "invitation to bid",
  "bid opening",
  "solicitation",
] as const;

const RFI_KEYWORDS = [
  "request for information",
  "request for qualifications",
  "industry day",
  "pre-solicitation",
] as const;

const LEADERSHIP_KEYWORDS = [
  "new 911 director",
  "new sheriff",
  "new chief",
  "new cio",
  "appointed director",
  "named director",
  "incoming sheriff",
  "newly elected",
] as const;

const EXPIRING_KEYWORDS = [
  "end of life",
  "end-of-life",
  "contract expiration",
  "contract expires",
  "approaching end",
  "legacy system",
] as const;

const GRANT_KEYWORDS = [
  "grant award",
  "NG911 grant",
  "COPS grant",
  "FEMA grant",
  "SICG",
  "Byrne JAG",
  "ARPA",
  "SLFRF",
] as const;

const TRANSCRIPTION_KEYWORDS = [
  "transcription",
  "call recording",
  "real-time transcript",
] as const;
const TRANSLATION_KEYWORDS = ["translation", "multilingual", "language access"] as const;
const NG911_KEYWORDS = ["NG911", "next-generation 911", "ESInet", "i3"] as const;
const CAD_KEYWORDS = ["CAD", "computer aided dispatch", "computer-aided dispatch"] as const;
const AI_DISPATCH_KEYWORDS = [
  "AI dispatch",
  "AI-assisted dispatch",
  "AI call taking",
  "assistive dispatch",
] as const;
const QA_KEYWORDS = ["quality assurance", "call review", "QA analytics"] as const;
const SIZE_KEYWORDS = ["county", "city of", "municipality", "township"] as const;

function findMatchIndex(text: string, keyword: string): number {
  const escaped = escapeRegExp(keyword);
  const isAcronym = /^[A-Z0-9][A-Z0-9+./-]{0,12}$/.test(keyword);
  const pattern =
    keyword.length <= 5 || isAcronym
      ? new RegExp(`\\b${escaped}\\b`, "i")
      : new RegExp(escaped.replace(/\s+/g, "\\s+"), "i");
  const match = pattern.exec(text);
  return match ? match.index : -1;
}

function firstMatchIndex(text: string, keywords: readonly string[]): number {
  let best = -1;
  for (const keyword of keywords) {
    const idx = findMatchIndex(text, keyword);
    if (idx >= 0 && (best < 0 || idx < best)) best = idx;
  }
  return best;
}

/**
 * Capture ±150 characters around a keyword match. Max 500 chars.
 */
export function extractExcerpt(text: string, matchIndex: number): string {
  if (matchIndex < 0 || !text) {
    return text.replace(/\s+/g, " ").trim().slice(0, 500);
  }
  const start = Math.max(0, matchIndex - 150);
  const end = Math.min(text.length, matchIndex + 150);
  const excerpt = text.slice(start, end).replace(/\s+/g, " ").trim();
  const withEllipsis = start > 0 ? `...${excerpt}` : excerpt;
  return withEllipsis.slice(0, 500);
}

export function extractKeywordExcerpt(text: string): string {
  const categories = Object.values(KEYWORDS) as readonly (readonly string[])[];
  for (const keywords of categories) {
    const idx = firstMatchIndex(text, keywords);
    if (idx >= 0) return extractExcerpt(text, idx);
  }
  return text.replace(/\s+/g, " ").trim().slice(0, 500);
}

export function sourceDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function evidence(
  factor: string,
  contribution: number,
  text: string,
  keywords: readonly string[],
  sourceUrl: string,
): ScoreEvidence {
  const idx = firstMatchIndex(text, keywords);
  return {
    factor,
    contribution,
    sourceExcerpt: extractExcerpt(text, idx),
    sourceUrl,
  };
}

function anyHit(text: string, keywords: readonly string[]): boolean {
  return countKeywordHits(text, keywords) > 0;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function isRecentSignal(signalDate: string | undefined, now = Date.now()): boolean {
  if (!signalDate) return false;
  const t = new Date(signalDate).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= 30 * 24 * 60 * 60 * 1000;
}

function computeIntentScore(
  text: string,
  sourceUrl: string,
  options: ScoreSignalOptions,
): { score: number; evidence: ScoreEvidence[] } {
  const ev: ScoreEvidence[] = [];
  let score = 0;

  const hasRfp =
    keywordMatches(text, "RFP") || anyHit(text, RFP_KEYWORDS);
  const hasRfi = keywordMatches(text, "RFI") || keywordMatches(text, "RFQ") || anyHit(text, RFI_KEYWORDS);
  const hasPlanning = countKeywordHits(text, KEYWORDS.planning) > 0;

  if (hasRfp) {
    score += INTENT_FACTORS.activeRfp;
    ev.push(evidence("Active RFP / solicitation", INTENT_FACTORS.activeRfp, text, [...RFP_KEYWORDS, "RFP"], sourceUrl));
  } else if (hasRfi || hasPlanning) {
    score += INTENT_FACTORS.rfiOrPlanning;
    ev.push(
      evidence(
        "RFI / planning / evaluation",
        INTENT_FACTORS.rfiOrPlanning,
        text,
        [...RFI_KEYWORDS, ...KEYWORDS.planning],
        sourceUrl,
      ),
    );
  }

  if (countKeywordHits(text, KEYWORDS.funding) > 0) {
    score += INTENT_FACTORS.budgetIdentified;
    ev.push(
      evidence("Budget or funding identified", INTENT_FACTORS.budgetIdentified, text, KEYWORDS.funding, sourceUrl),
    );
  }

  if (!hasRfp && !hasRfi && !hasPlanning && countKeywordHits(text, KEYWORDS.problem) > 0) {
    score += INTENT_FACTORS.earlyDiscussion;
    ev.push(
      evidence("Early problem / need discussion", INTENT_FACTORS.earlyDiscussion, text, KEYWORDS.problem, sourceUrl),
    );
  }

  if ((options.relatedSignalCount ?? 1) >= 3) {
    score += INTENT_FACTORS.multipleSignals;
    ev.push({
      factor: "Multiple independent signals",
      contribution: INTENT_FACTORS.multipleSignals,
      sourceExcerpt: `${options.relatedSignalCount} signals linked to this agency`,
      sourceUrl,
    });
  }

  if (isRecentSignal(options.signalDate)) {
    score += INTENT_FACTORS.signalRecency;
    ev.push({
      factor: "Signal recency (< 30 days)",
      contribution: INTENT_FACTORS.signalRecency,
      sourceExcerpt: options.signalDate ?? "",
      sourceUrl,
    });
  }

  if (anyHit(text, LEADERSHIP_KEYWORDS)) {
    score += INTENT_FACTORS.leadershipChange;
    ev.push(
      evidence("Leadership change", INTENT_FACTORS.leadershipChange, text, LEADERSHIP_KEYWORDS, sourceUrl),
    );
  }

  if (anyHit(text, EXPIRING_KEYWORDS)) {
    score += INTENT_FACTORS.incumbentExpiring;
    ev.push(
      evidence("Incumbent / contract expiring", INTENT_FACTORS.incumbentExpiring, text, EXPIRING_KEYWORDS, sourceUrl),
    );
  }

  if (countKeywordHits(text, KEYWORDS.competitors) > 0) {
    score += INTENT_FACTORS.competitorMentioned;
    ev.push(
      evidence("Competitor mentioned", INTENT_FACTORS.competitorMentioned, text, KEYWORDS.competitors, sourceUrl),
    );
  }

  if (anyHit(text, GRANT_KEYWORDS)) {
    score += INTENT_FACTORS.grantAwarded;
    ev.push(evidence("Grant awarded / available", INTENT_FACTORS.grantAwarded, text, GRANT_KEYWORDS, sourceUrl));
  }

  return { score: clampScore(score), evidence: ev };
}

function computeProductFitScore(
  text: string,
  sourceUrl: string,
  agencyType?: string,
): { score: number; evidence: ScoreEvidence[] } {
  const ev: ScoreEvidence[] = [];
  let score = 0;
  const typeHay = `${agencyType ?? ""} ${text}`;

  const psap =
    /\b(psap|911|9-1-1|ecc|emergency communications|dispatch center|public safety answering)\b/i.test(typeHay);
  const le = /\b(sheriff|police department|law enforcement)\b/i.test(typeHay);
  const fire = /\b(fire rescue|fire department|\bems\b|emergency medical)\b/i.test(typeHay);
  const campus = countKeywordHits(text, KEYWORDS.campus) > 0 || /\bcampus\b/i.test(agencyType ?? "");
  const venue = countKeywordHits(text, KEYWORDS.venue) > 0 || /\bvenue\b/i.test(agencyType ?? "");
  const transit =
    countKeywordHits(text, KEYWORDS.transit) > 0 ||
    /\b(transit|metro|subway|rail)\b/i.test(agencyType ?? "");

  if (psap) {
    score += FIT_FACTORS.isPsap911;
    ev.push(evidence("PSAP / 911 / ECC", FIT_FACTORS.isPsap911, typeHay, KEYWORDS.product911, sourceUrl));
  } else if (le) {
    score += FIT_FACTORS.isLawEnforcement;
    ev.push({
      factor: "Law enforcement",
      contribution: FIT_FACTORS.isLawEnforcement,
      sourceExcerpt: extractExcerpt(typeHay, firstMatchIndex(typeHay, ["sheriff", "police department"])),
      sourceUrl,
    });
  } else if (fire) {
    score += FIT_FACTORS.isFireEms;
    ev.push({
      factor: "Fire / EMS",
      contribution: FIT_FACTORS.isFireEms,
      sourceExcerpt: extractExcerpt(typeHay, firstMatchIndex(typeHay, ["fire", "EMS"])),
      sourceUrl,
    });
  }

  if (campus) {
    score += FIT_FACTORS.isCampus;
    ev.push(evidence("Campus safety", FIT_FACTORS.isCampus, text, KEYWORDS.campus, sourceUrl));
  }
  if (venue) {
    score += FIT_FACTORS.isVenue;
    ev.push(evidence("Venue operations", FIT_FACTORS.isVenue, text, KEYWORDS.venue, sourceUrl));
  }
  if (transit) {
    score += FIT_FACTORS.isTransit;
    ev.push(evidence("Transit operations", FIT_FACTORS.isTransit, text, KEYWORDS.transit, sourceUrl));
  }

  if (anyHit(text, TRANSCRIPTION_KEYWORDS)) {
    score += FIT_FACTORS.mentionsTranscription;
    ev.push(
      evidence("Transcription / recording", FIT_FACTORS.mentionsTranscription, text, TRANSCRIPTION_KEYWORDS, sourceUrl),
    );
  }
  if (anyHit(text, TRANSLATION_KEYWORDS)) {
    score += FIT_FACTORS.mentionsTranslation;
    ev.push(evidence("Translation / multilingual", FIT_FACTORS.mentionsTranslation, text, TRANSLATION_KEYWORDS, sourceUrl));
  }
  if (anyHit(text, NG911_KEYWORDS)) {
    score += FIT_FACTORS.mentionsNg911;
    ev.push(evidence("NG911 / ESInet", FIT_FACTORS.mentionsNg911, text, NG911_KEYWORDS, sourceUrl));
  }
  if (anyHit(text, CAD_KEYWORDS)) {
    score += FIT_FACTORS.mentionsCad;
    ev.push(evidence("CAD / dispatch systems", FIT_FACTORS.mentionsCad, text, CAD_KEYWORDS, sourceUrl));
  }
  if (anyHit(text, AI_DISPATCH_KEYWORDS)) {
    score += FIT_FACTORS.mentionsAiDispatch;
    ev.push(evidence("AI-assisted dispatch", FIT_FACTORS.mentionsAiDispatch, text, AI_DISPATCH_KEYWORDS, sourceUrl));
  }
  if (anyHit(text, QA_KEYWORDS) || /\bQA\b/.test(text)) {
    score += FIT_FACTORS.mentionsQa;
    ev.push(evidence("QA / call review", FIT_FACTORS.mentionsQa, text, QA_KEYWORDS, sourceUrl));
  }
  if (anyHit(text, SIZE_KEYWORDS)) {
    score += FIT_FACTORS.agencySize;
    ev.push(evidence("County / municipal size fit", FIT_FACTORS.agencySize, text, SIZE_KEYWORDS, sourceUrl));
  }

  return { score: clampScore(score), evidence: ev };
}

/**
 * Two-score intelligence model. Does not replace `scoreFit()` — collectors and
 * existing tests continue to use the legacy 0–100 blend.
 */
export function scoreSignal(text: string, sourceType: string, options: ScoreSignalOptions = {}): SignalScores {
  void sourceType;
  const sourceUrl = options.sourceUrl ?? "";
  const intent = computeIntentScore(text, sourceUrl, options);
  const fit = computeProductFitScore(text, sourceUrl, options.agencyType);
  return {
    buyingIntentScore: intent.score,
    productFitScore: fit.score,
    combinedScore: clampScore(intent.score * 0.6 + fit.score * 0.4),
    intentEvidence: intent.evidence,
    fitEvidence: fit.evidence,
  };
}

export function classifyTaxonomy(text: string): string[] {
  const lower = text.toLowerCase();
  const matches: string[] = [];
  for (const [category, terms] of Object.entries(PS_TAXONOMY)) {
    for (const term of terms) {
      const spaced = term.replace(/-/g, " ");
      if (lower.includes(spaced) || (term.length <= 4 && new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text))) {
        matches.push(`${category}:${term}`);
      }
    }
  }
  return [...new Set(matches)];
}

export function recommendedActionFromStage(
  stage: RapidIqProcurementStage | undefined,
  intentScore?: number,
): string {
  if ((intentScore ?? 0) >= 70 && (stage === "budget-funded" || stage === "funding-available")) {
    return "Request demo before budget approval closes";
  }
  switch (stage) {
    case "rfp":
      return "Review solicitation and decide bid/no-bid before the due date";
    case "rfi-planning":
      return "Request a briefing or demo during vendor evaluation";
    case "budget-funded":
    case "funding-available":
      return "Request demo before budget approval closes";
    case "early-awareness":
      return "Open a discovery conversation about the stated need";
    case "competitor-win":
    case "future-opportunity":
      return "Monitor contract cycle and position for displacement";
    default:
      return "Keep monitoring for the next public buying signal";
  }
}

export function kanbanColumnForStage(stage: RapidIqProcurementStage | undefined): RapidIqKanbanColumnId {
  if (stage === "funding-available") return "budget-funded";
  if (stage === "future-opportunity") return "competitor-win";
  if (stage === "rfp") return "rfp";
  if (stage === "rfi-planning") return "rfi-planning";
  if (stage === "budget-funded") return "budget-funded";
  if (stage === "early-awareness") return "early-awareness";
  if (stage === "competitor-win") return "competitor-win";
  return "monitoring";
}

export function highestProcurementStage(
  stages: Array<RapidIqProcurementStage | undefined>,
): RapidIqProcurementStage {
  let best: RapidIqProcurementStage = "monitoring";
  let bestIdx = STAGE_PRIORITY.length;
  for (const stage of stages) {
    if (!stage) continue;
    const idx = STAGE_PRIORITY.indexOf(stage);
    if (idx >= 0 && idx < bestIdx) {
      best = stage;
      bestIdx = idx;
    }
  }
  return best;
}

/** Prompt intent colors: red ≥ 70, amber 40–69, green < 40. */
export function intentScoreTone(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
