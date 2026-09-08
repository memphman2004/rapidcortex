import { evaluateSafety } from "./safety.js";
import type { CallTriageClassification } from "./classifications.js";
import {
  DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS,
  enabledCallTypes,
  findCallType,
  type AgencyTaxonomy,
  type CallAssistConfidenceThresholds,
  type CallType,
} from "./taxonomy.js";
import { resolveAgencyTaxonomy } from "./taxonomy-presets.js";

export type CallTriageResult = {
  primaryClassification: CallTriageClassification;
  secondaryClassifications: CallTriageClassification[];
  confidence: number;
  reasons: string[];
  emergencyDetected: boolean;
  humanReviewRequired: boolean;
  onlineReportingEligible: boolean;
  carfaxReportingEligible: boolean;
  continueIntake: boolean;
  matchedCallTypeId?: string;
  escalationPath?: CallType["escalationPath"];
};

/** Legacy 911 regexes — used only when the resolved taxonomy is the 911 vertical, so existing matches stay stable. */
const CLASS_PATTERNS: ReadonlyArray<{ cls: CallTriageClassification; re: RegExp; weight: number }> = [
  { cls: "NOISE_COMPLAINT", re: /\b(noise|loud music|party|barking|música alta|musica alta|ruido)\b/i, weight: 0.86 },
  { cls: "PARKING", re: /\b(parking|blocked driveway|hydrant|handicap spot)\b/i, weight: 0.84 },
  { cls: "TOW_COMPLAINT", re: /\b(tow|towed|impound)\b/i, weight: 0.82 },
  { cls: "ANIMAL_CONTROL", re: /\b(stray dog|animal control|loose dog|aggressive dog|raccoon)\b/i, weight: 0.83 },
  { cls: "CODE_ENFORCEMENT", re: /\b(code enforcement|trash pile|overgrown|illegal dumping|junk vehicle)\b/i, weight: 0.8 },
  { cls: "PUBLIC_WORKS", re: /\b(water main|burst pipe|pothole|sewer|street light|traffic light)\b/i, weight: 0.88 },
  { cls: "REPORT_ONLY", re: /\b(theft report|stolen (bike|phone|package)|past tense|happened yesterday|happened last night)\b/i, weight: 0.78 },
  { cls: "INFORMATION_REQUEST", re: /\b(what is the number|hours of operation|how do i file|where do i report)\b/i, weight: 0.75 },
  {
    cls: "NON_EMERGENCY_POLICE",
    re: /\b(suspicious (person|vehicle)|welfare check|abandoned vehicle|carro abandonado|veh[ií]culo abandonado|vandalism|harassment)\b/i,
    weight: 0.8,
  },
];

const VEHICLE_CRIME = /\b(stolen (car|vehicle)|vehicle (burglary|break[- ]in)|hit and run|catalytic)\b/i;
const IN_PROGRESS = /\b(happening (right )?now|still going on|in progress)\b/i;

export type ClassifyCallTriageOptions = {
  prior?: CallTriageClassification;
  taxonomy?: AgencyTaxonomy | null;
  vertical?: AgencyTaxonomy["vertical"];
  confidenceThresholds?: Partial<CallAssistConfidenceThresholds> | null;
};

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const raw of keywords) {
    const k = raw.trim().toLowerCase();
    if (!k) continue;
    if (k.includes(" ")) {
      if (lower.includes(k)) hits += 1;
    } else {
      const re = new RegExp(`\\b${escapeRe(k)}\\b`, "i");
      if (re.test(text)) hits += 1;
    }
  }
  if (hits === 0) return 0;
  return Math.min(0.95, 0.62 + hits * 0.08);
}

function unknownId(taxonomy: AgencyTaxonomy): string {
  return taxonomy.vertical === "911" ? "UNKNOWN" : "unknown";
}

/**
 * Classification after Safety Engine. Emergency from safety always wins —
 * triage cannot continue the AI conversation on an emergency utterance.
 * Taxonomy is consulted for non-emergency type matching only.
 */
export function classifyCallTriage(
  utterance: string,
  prior?: CallTriageClassification | ClassifyCallTriageOptions,
  options?: ClassifyCallTriageOptions,
): CallTriageResult {
  const opts: ClassifyCallTriageOptions =
    typeof prior === "object" && prior !== null ? { ...prior, ...options } : { prior, ...options };
  const taxonomy = resolveAgencyTaxonomy({
    taxonomy: opts.taxonomy,
    vertical: opts.vertical ?? opts.taxonomy?.vertical,
  });
  const thresholds = {
    ...DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS,
    ...opts.confidenceThresholds,
  };
  const safety = evaluateSafety(utterance);
  if (safety.classification === "EMERGENCY") {
    const emergencyType =
      enabledCallTypes(taxonomy).find((t) => t.isEmergency) ?? findCallType(taxonomy, "EMERGENCY") ?? findCallType(taxonomy, "emergency");
    const id = emergencyType?.id ?? "EMERGENCY";
    return {
      primaryClassification: id,
      secondaryClassifications: opts.prior && opts.prior !== id ? [opts.prior] : [],
      confidence: 0.99,
      reasons: ["safety_engine_override", ...safety.reasons],
      emergencyDetected: true,
      humanReviewRequired: true,
      onlineReportingEligible: false,
      carfaxReportingEligible: false,
      continueIntake: false,
      matchedCallTypeId: id,
      escalationPath: "emergency",
    };
  }

  const enabled = enabledCallTypes(taxonomy);
  const enabledIds = new Set(enabled.map((t) => t.id));
  const scores = new Map<string, { score: number; reasons: string[]; type: CallType }>();

  for (const type of enabled) {
    const kw = keywordScore(utterance, type.classifierKeywords);
    if (kw > 0) {
      scores.set(type.id, { score: kw, reasons: [`keyword:${type.id}`], type });
    }
  }

  if (taxonomy.vertical === "911") {
    for (const row of CLASS_PATTERNS) {
      if (!enabledIds.has(row.cls)) continue;
      if (!row.re.test(utterance)) continue;
      const type = enabled.find((t) => t.id === row.cls);
      if (!type) continue;
      const prev = scores.get(row.cls);
      if (!prev || row.weight > prev.score) {
        scores.set(row.cls, {
          score: row.weight,
          reasons: [...(prev?.reasons ?? []), `matched:${row.cls}`],
          type,
        });
      } else {
        prev.reasons.push(`matched:${row.cls}`);
      }
    }
  }

  const ranked = [...scores.values()].sort((a, b) => b.score - a.score || a.type.sortOrder - b.type.sortOrder);
  const top = ranked[0];
  const fallbackId = unknownId(taxonomy);
  let primary: CallTriageClassification = top?.type.id ?? opts.prior ?? fallbackId;
  if (!enabledIds.has(primary)) {
    primary = fallbackId;
  }
  const primaryType = enabled.find((t) => t.id === primary);
  const secondary = ranked.slice(1, 3).map((h) => h.type.id);
  let confidence = top?.score ?? 0.4;
  const reasons = top?.reasons ?? ["no_keyword_match"];

  const vehicleCrime = VEHICLE_CRIME.test(utterance);
  const inProgress = IN_PROGRESS.test(utterance);
  const carfaxTypeEnabled = enabledIds.has("CARFAX_REPORTING_ELIGIBLE");
  const carfaxEligible = taxonomy.vertical === "911" && carfaxTypeEnabled && vehicleCrime && !inProgress && !safety.triggers.length;
  const onlineEligible =
    taxonomy.vertical === "911" &&
    (primary === "REPORT_ONLY" || primary === "PARKING" || primary === "NOISE_COMPLAINT" || carfaxEligible) &&
    !inProgress;

  if (carfaxEligible) {
    secondary.unshift(primary);
    primary = "CARFAX_REPORTING_ELIGIBLE";
    confidence = Math.max(confidence, 0.82);
    reasons.push("vehicle_crime_historical");
  } else if (onlineEligible && primary !== "ONLINE_REPORTING_ELIGIBLE") {
    reasons.push("online_report_candidate");
  }

  const matched = findCallType(taxonomy, primary) ?? primaryType;
  const taxonomyEmergency = Boolean(matched?.isEmergency) && confidence >= thresholds.emergency;
  const emergencyDetected = taxonomyEmergency;
  const humanReviewRequired =
    emergencyDetected || confidence < thresholds.escalate || primary === fallbackId || primary === "UNKNOWN";

  return {
    primaryClassification: primary,
    secondaryClassifications: [...new Set(secondary)].filter((c) => c !== primary),
    confidence,
    reasons,
    emergencyDetected,
    humanReviewRequired,
    onlineReportingEligible: onlineEligible,
    carfaxReportingEligible: carfaxEligible,
    continueIntake: !emergencyDetected,
    matchedCallTypeId: matched?.id,
    escalationPath: emergencyDetected ? "emergency" : matched?.escalationPath,
  };
}
