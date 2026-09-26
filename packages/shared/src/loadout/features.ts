/**
 * NexCort iQ Loadout — Feature Catalog (cents).
 * Design dollars × 100 → monthlyBaseCents / overagePer1kCents.
 */

import type { FeatureCategory, LoadoutFeature } from "./types.js";

export type { FeatureCategory, LoadoutFeature };

/** Convert design-file dollars to integer cents (avoids float drift on overage rates). */
function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export const LOADOUT_FEATURES: Record<string, LoadoutFeature> = {
  transcription: {
    id: "transcription",
    name: "AI Transcription",
    description:
      "Real-time speech-to-text for 911 calls and radio traffic. Public safety vocabulary model, speaker diarization, ambient noise filtering.",
    category: "core",
    enterprise: false,
    monthlyBaseCents: dollarsToCents(750),
    includedCalls: 10_000,
    overagePer1kCents: dollarsToCents(0.08),
    endpoint: "/v1/transcribe",
  },

  translation: {
    id: "translation",
    name: "Real-Time Translation",
    description:
      "Bidirectional translation across 70+ languages with dual-language display and emergency-optimized terminology.",
    category: "core",
    enterprise: false,
    monthlyBaseCents: dollarsToCents(500),
    includedCalls: 10_000,
    overagePer1kCents: dollarsToCents(0.06),
    endpoint: "/v1/translate",
  },

  ai_analysis: {
    id: "ai_analysis",
    name: "AI Incident Analysis",
    description:
      "AI-generated incident summaries, entity extraction (people, vehicles, weapons, locations), and risk scoring from raw call transcripts.",
    category: "intelligence",
    enterprise: false,
    monthlyBaseCents: dollarsToCents(600),
    includedCalls: 5_000,
    overagePer1kCents: dollarsToCents(0.12),
    endpoint: "/v1/analyze",
  },

  classification: {
    id: "classification",
    name: "Incident Classification",
    description:
      "Automatic incident type tagging and priority scoring using models trained on public safety dispatch data.",
    category: "intelligence",
    enterprise: false,
    monthlyBaseCents: dollarsToCents(350),
    includedCalls: 8_000,
    overagePer1kCents: dollarsToCents(0.05),
    endpoint: "/v1/classify",
  },

  sentiment: {
    id: "sentiment",
    name: "Caller Sentiment Scoring",
    description:
      "Real-time urgency and emotional state analysis for caller triage. Flags escalating distress before the dispatcher notices it.",
    category: "intelligence",
    enterprise: false,
    monthlyBaseCents: dollarsToCents(450),
    includedCalls: 8_000,
    overagePer1kCents: dollarsToCents(0.07),
    endpoint: "/v1/sentiment",
  },

  qa_scoring: {
    id: "qa_scoring",
    name: "QA Scoring",
    description:
      "Automated call quality scoring against configurable rubrics. Score every call, not just a random 5% sample.",
    category: "quality",
    enterprise: false,
    monthlyBaseCents: dollarsToCents(400),
    includedCalls: 3_000,
    overagePer1kCents: dollarsToCents(0.15),
    endpoint: "/v1/qa/score",
  },

  field_brief: {
    id: "field_brief",
    name: "Field Brief Delivery",
    description:
      "AI incident brief pushed to responding units via SMS, native app, or MDT the moment they are dispatched.",
    category: "field",
    enterprise: false,
    monthlyBaseCents: dollarsToCents(600),
    includedCalls: 5_000,
    overagePer1kCents: dollarsToCents(0.1),
    endpoint: "/v1/field/brief",
  },

  non_emergency: {
    id: "non_emergency",
    name: "Non-Emergency Call Handling",
    description:
      "AI-powered 24/7 intake for non-emergency lines. Deflects non-critical calls, collects structured info, and routes appropriately.",
    category: "automation",
    enterprise: true,
    monthlyBaseCents: dollarsToCents(800),
    includedCalls: 2_000,
    overagePer1kCents: dollarsToCents(0.4),
    endpoint: "/v1/calls/non-emergency",
    enterpriseNote: "Requires telephony integration and IVR configuration.",
  },

  sop_protocol: {
    id: "sop_protocol",
    name: "SOP Protocol AI",
    description:
      "AI-assisted protocol matching aligned to your agency's own SOPs and call-taking guides in real time.",
    category: "intelligence",
    enterprise: true,
    monthlyBaseCents: dollarsToCents(700),
    includedCalls: 3_000,
    overagePer1kCents: dollarsToCents(0.25),
    endpoint: "/v1/sop/match",
    enterpriseNote: "Requires SOP library upload and protocol configuration.",
  },

  cad_integration: {
    id: "cad_integration",
    name: "CAD Integration",
    description:
      "Bidirectional CAD data sync. Read incident metadata and push AI-enriched data back to your CAD system automatically.",
    category: "core",
    enterprise: true,
    monthlyBaseCents: dollarsToCents(1_200),
    includedCalls: 5_000,
    overagePer1kCents: dollarsToCents(0.2),
    endpoint: "/v1/cad",
    enterpriseNote: "Requires CAD vendor assessment and connector build.",
  },

  cross_jurisdiction: {
    id: "cross_jurisdiction",
    name: "Cross-Jurisdiction Sharing",
    description:
      "Controlled sharing of incident context across neighboring agencies with configurable access policies and full audit trail.",
    category: "intelligence",
    enterprise: true,
    monthlyBaseCents: dollarsToCents(950),
    includedCalls: 3_000,
    overagePer1kCents: dollarsToCents(0.3),
    endpoint: "/v1/incidents/share",
    enterpriseNote: "Multi-agency agreement and network setup required.",
  },

  hospital_portal: {
    id: "hospital_portal",
    name: "Hospital Pre-Alert Portal",
    description:
      "EMS-to-hospital pre-alert delivery with real-time bed capacity. Hospitals acknowledge alerts without PSAP console access.",
    category: "field",
    enterprise: true,
    monthlyBaseCents: dollarsToCents(600),
    includedCalls: 2_000,
    overagePer1kCents: dollarsToCents(0.3),
    endpoint: "/v1/hospital",
    enterpriseNote: "Hospital network enrollment and portal setup required.",
  },

  deception_shield: {
    id: "deception_shield",
    name: "Deception Shield",
    description:
      "Honeypot and decoy surfaces to detect unauthorized probing of your agency's operational data and API infrastructure.",
    category: "quality",
    enterprise: true,
    monthlyBaseCents: dollarsToCents(1_500),
    includedCalls: null,
    overagePer1kCents: null,
    endpoint: null,
    enterpriseNote: "Security configuration and agency IT coordination required.",
  },

  full_platform: {
    id: "full_platform",
    name: "Full NexCortiQ Platform",
    description:
      "Complete platform deployment: dispatcher console, supervisor dashboard, command war room, all AI features, onboarding, and 24/7 support.",
    category: "enterprise",
    enterprise: true,
    monthlyBaseCents: null,
    includedCalls: null,
    overagePer1kCents: null,
    endpoint: null,
    enterpriseNote: "Custom deployment, training, and dedicated support included.",
  },
};

/** Route → feature ID mapping used by the Lambda authorizer */
export const ENDPOINT_FEATURE_MAP: Record<string, string> = Object.fromEntries(
  Object.values(LOADOUT_FEATURES)
    .filter((f) => f.endpoint !== null)
    .map((f) => [f.endpoint!, f.id]),
);

/** Calculate invoice line total for one feature. All values in CENTS. */
export function featureLineCost(
  featureId: string,
  callsUsed: number,
): { baseCents: number; overageCents: number; totalCents: number } {
  const f = LOADOUT_FEATURES[featureId];
  if (!f || !f.monthlyBaseCents) return { baseCents: 0, overageCents: 0, totalCents: 0 };
  const baseCents = f.monthlyBaseCents;
  const overageCents =
    f.includedCalls && f.overagePer1kCents && callsUsed > f.includedCalls
      ? Math.ceil(((callsUsed - f.includedCalls) / 1000) * f.overagePer1kCents)
      : 0;
  return { baseCents, overageCents, totalCents: baseCents + overageCents };
}

export function formatCentsAsUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
