import {
  DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS,
  normalizeConfidenceThresholds,
  type CallAssistConfidenceThresholds,
} from "./taxonomy.js";

export type ConfidenceSource = "lex" | "bedrock" | "triage";

export type ConfidenceAction = "self_service" | "continue_review" | "escalate_human";

export type ConfidenceDecision = {
  score: number;
  source: ConfidenceSource;
  thresholds: CallAssistConfidenceThresholds;
  action: ConfidenceAction;
  belowEscalate: boolean;
  belowSelfService: boolean;
  reason: string;
};

export function resolveCallAssistThresholds(
  input?: Partial<CallAssistConfidenceThresholds> | null,
): CallAssistConfidenceThresholds {
  return normalizeConfidenceThresholds(input ?? DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS);
}

/**
 * Agency control plane for NLU / triage scores.
 * Below escalate → auto-transfer to a person.
 * Between escalate and self-service → continue intake with human review.
 * At/above self-service → AI may complete without a person.
 */
export function evaluateConfidenceDecision(opts: {
  score: number;
  source: ConfidenceSource;
  thresholds?: Partial<CallAssistConfidenceThresholds> | null;
}): ConfidenceDecision {
  const thresholds = resolveCallAssistThresholds(opts.thresholds);
  const score = Number.isFinite(opts.score) ? Math.max(0, Math.min(1, opts.score)) : 0;
  const belowEscalate = score < thresholds.escalate;
  const belowSelfService = score < thresholds.selfService;
  let action: ConfidenceAction = "self_service";
  let reason = "above_self_service";
  if (belowEscalate) {
    action = "escalate_human";
    reason = "below_escalate_threshold";
  } else if (belowSelfService) {
    action = "continue_review";
    reason = "below_self_service_threshold";
  }
  return {
    score,
    source: opts.source,
    thresholds,
    action,
    belowEscalate,
    belowSelfService,
    reason,
  };
}

export function shouldTryBedrockFallback(opts: {
  lexConfidence: number;
  intentName: string;
  fallbackIntentName: string;
  thresholds?: Partial<CallAssistConfidenceThresholds> | null;
}): boolean {
  const thresholds = resolveCallAssistThresholds(opts.thresholds);
  return opts.intentName === opts.fallbackIntentName || opts.lexConfidence < thresholds.selfService;
}

export type CallTakerConfidenceRow = {
  id: "intent" | "classification" | "location" | "routing";
  label: string;
  score: number;
  action: ConfidenceAction;
  reason: string;
};

function locationScore(opts: {
  addressConfidence?: number | null;
  locationSource?: string | null;
  hasLocationText?: boolean;
}): number {
  if (typeof opts.addressConfidence === "number" && Number.isFinite(opts.addressConfidence)) {
    return Math.max(0, Math.min(1, opts.addressConfidence));
  }
  if (opts.locationSource === "ANI_ALI" || opts.locationSource === "RAPIDSOS") return 0.82;
  if (opts.locationSource === "GIS") return 0.78;
  if (opts.hasLocationText) return 0.45;
  return 0.2;
}

function routingScore(opts: {
  destinationType?: string | null;
  classification?: string | null;
}): number {
  const dest = opts.destinationType ?? "";
  const cls = (opts.classification ?? "").toUpperCase();
  if (dest === "EMERGENCY_911") return 0.99;
  if (cls === "UNKNOWN" || cls === "") return 0.35;
  if (dest === "EXTERNAL_AGENCY" || dest === "CALL_TAKER" || dest === "QUEUE") return 0.8;
  if (dest === "SELF_SERVICE" || dest === "INFORMATION") return 0.75;
  return 0.55;
}

/** Operator-facing scores for intent, classification, location, and routing. */
export function callTakerConfidenceRows(opts: {
  intentScore?: number | null;
  classificationScore?: number | null;
  addressConfidence?: number | null;
  locationSource?: string | null;
  locationText?: string | null;
  routingDestinationType?: string | null;
  classification?: string | null;
  thresholds?: Partial<CallAssistConfidenceThresholds> | null;
}): CallTakerConfidenceRow[] {
  const thresholds = resolveCallAssistThresholds(opts.thresholds);
  const intent = Number.isFinite(opts.intentScore) ? Number(opts.intentScore) : Number(opts.classificationScore) || 0;
  const classification = Number.isFinite(opts.classificationScore)
    ? Number(opts.classificationScore)
    : intent;
  const location = locationScore({
    addressConfidence: opts.addressConfidence,
    locationSource: opts.locationSource,
    hasLocationText: Boolean(opts.locationText?.trim()),
  });
  const routing = routingScore({
    destinationType: opts.routingDestinationType,
    classification: opts.classification,
  });
  const pack = (
    id: CallTakerConfidenceRow["id"],
    label: string,
    score: number,
  ): CallTakerConfidenceRow => {
    const d = evaluateConfidenceDecision({ score, source: "triage", thresholds });
    return { id, label, score: d.score, action: d.action, reason: d.reason };
  };
  return [
    pack("intent", "Intent", intent),
    pack("classification", "Classification", classification),
    pack("location", "Location", location),
    pack("routing", "Routing", routing),
  ];
}

export function confidenceActionLabel(action: ConfidenceAction): string {
  if (action === "escalate_human") return "Escalate";
  if (action === "continue_review") return "Review";
  return "Self-service";
}
