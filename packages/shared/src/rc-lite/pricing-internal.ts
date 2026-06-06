/**
 * Internal RC Lite SKU metadata for quotes / RC Admin tooling.
 * Public marketing uses Contact Support unless `showPublicRcLitePricing()` is true in web layer.
 */

export type RcLitePricingTierId = "sandbox" | "developer" | "pilot" | "professional" | "enterprise";

export type RcLitePricingTier = {
  id: RcLitePricingTierId;
  label: string;
  monthlyUsd: number | "custom";
  includedApiCalls: number | null;
  overageUsdPerCall: number | "custom" | null;
  notes: string;
};

export const RC_LITE_INTERNAL_PRICING_TIERS: readonly RcLitePricingTier[] = [
  {
    id: "sandbox",
    label: "Sandbox",
    monthlyUsd: 0,
    includedApiCalls: 1000,
    overageUsdPerCall: null,
    notes: "Sandbox only; no production CAD export.",
  },
  {
    id: "developer",
    label: "Developer",
    monthlyUsd: 99,
    includedApiCalls: 10_000,
    overageUsdPerCall: 0.015,
    notes: "Developer workload; pay-as-you-grow overage.",
  },
  {
    id: "pilot",
    label: "Pilot",
    monthlyUsd: 499,
    includedApiCalls: 50_000,
    overageUsdPerCall: 0.012,
    notes: "Agency or vendor bounded pilot.",
  },
  {
    id: "professional",
    label: "Professional",
    monthlyUsd: 1500,
    includedApiCalls: 250_000,
    overageUsdPerCall: 0.008,
    notes: "Minimum floor; module-specific overage bands $0.008–0.015 in contract.",
  },
  {
    id: "enterprise",
    label: "Enterprise",
    monthlyUsd: "custom",
    includedApiCalls: null,
    overageUsdPerCall: "custom",
    notes: "Annual minimum, SLA, GovCloud/private optional, CAD adapters negotiated.",
  },
];

export const RC_LITE_ADD_ON_LABELS = [
  "CAD Export API",
  "Transcription API",
  "Translation API",
  "Caller Media API",
  "QA Analysis API",
  "Operational analytics add-on",
  "GovCloud / Data residency",
  "Dedicated tenant",
  "Emergency priority throughput",
  "Priority support",
  "SLA",
] as const;
