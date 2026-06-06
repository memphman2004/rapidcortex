import type { MonetizationPlanId } from "../monetization/plan-ids.js";

/**
 * Packaged subscription plans (internal SKU + pricing).
 * Aligns with `MonetizationPlanId` / Dynamo `planId` for entitlements.
 */
export type SubscriptionPlanId = MonetizationPlanId;

export type OneTimeFeeKind =
  | "implementation"
  | "custom_integration"
  | "protocol_customization"
  | "premium_support"
  | "setup_implementation"
  | "onsite_deployment";

export type SubscriptionPlanDefinition = {
  id: SubscriptionPlanId;
  name: string;
  /** Monthly price in cents (Enterprise / Statewide uses `startingPriceCentsMonthly` when quote-only). */
  priceCentsMonthly: number | null;
  startingPriceCentsMonthly?: number;
  displayHint: string;
  /** Internal billing / catalog SKU (procurement references). */
  catalogItemSku: string;
  /** Feature narrative for procurement decks (not legal terms). */
  summary: string;
  /** Dashboard vs API-only — RC Lite must never grant dashboard entitlements. */
  productLine: "rapid_cortex_dashboard" | "rc_lite_api";
};

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlanDefinition[] = [
  {
    id: "essential",
    name: "Rapid Cortex Essential",
    priceCentsMonthly: 1_999_00,
    displayHint: "Contact for quote or enable public pricing",
    catalogItemSku: "RC-ESSENTIAL-M",
    summary: "Core dashboard operations, AI assist, standard audit exports.",
    productLine: "rapid_cortex_dashboard",
  },
  {
    id: "command",
    name: "Rapid Cortex Command",
    priceCentsMonthly: 4_999_00,
    displayHint: "Contact for quote or enable public pricing",
    catalogItemSku: "RC-COMMAND-M",
    summary: "Multi-supervisor visibility, advanced workflows, priority routing features.",
    productLine: "rapid_cortex_dashboard",
  },
  {
    id: "enterprise_statewide",
    name: "Rapid Cortex Enterprise / Statewide",
    priceCentsMonthly: null,
    startingPriceCentsMonthly: 12_999_00,
    displayHint: "Quote-based / manual contract",
    catalogItemSku: "RC-ENTERPRISE-ST-M",
    summary: "Custom SLA, procurement-friendly PO & Net terms; optional GovCloud posture.",
    productLine: "rapid_cortex_dashboard",
  },
  {
    id: "rc_lite",
    name: "RC Lite API Access",
    priceCentsMonthly: 499_00,
    displayHint: "API-only — no dispatch console",
    catalogItemSku: "RC-LITE-API-M",
    summary: "External API + portal only (incident intelligence, webhooks); no ECC dashboard seats.",
    productLine: "rc_lite_api",
  },
] as const;

export const ONE_TIME_FEE_CATALOG: readonly {
  kind: OneTimeFeeKind;
  label: string;
  suggestedCents: number;
  displayHint: string;
  catalogItemSku: string;
}[] = [
  {
    kind: "setup_implementation",
    label: "Setup / Implementation fee",
    suggestedCents: 25_000_00,
    displayHint: "From $25,000",
    catalogItemSku: "RC-SETUP-IMPL-FIXED",
  },
  {
    kind: "implementation",
    label: "Implementation fee",
    suggestedCents: 25_000_00,
    displayHint: "From $25,000",
    catalogItemSku: "RC-FEE-IMPL",
  },
  {
    kind: "custom_integration",
    label: "Custom integration fee",
    suggestedCents: 35_000_00,
    displayHint: "From $35,000",
    catalogItemSku: "RC-FEE-CUSTOM-INT",
  },
  {
    kind: "protocol_customization",
    label: "Protocol customization fee",
    suggestedCents: 15_000_00,
    displayHint: "From $15,000",
    catalogItemSku: "RC-FEE-PROTO",
  },
  {
    kind: "premium_support",
    label: "Premium support fee",
    suggestedCents: 5_000_00,
    displayHint: "From $5,000/mo equiv.",
    catalogItemSku: "RC-FEE-SUPPORT",
  },
  {
    kind: "onsite_deployment",
    label: "Onsite deployment & training",
    suggestedCents: 15_000_00,
    displayHint: "Scope-based",
    catalogItemSku: "RC-ONSITE-V1-FIXED",
  },
] as const;

export function getPlanById(id: string): SubscriptionPlanDefinition | undefined {
  return SUBSCRIPTION_PLANS.find((p) => p.id === id);
}
