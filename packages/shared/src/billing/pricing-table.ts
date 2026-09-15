/**
 * Hardcoded pricing lookup tables derived from RC_Pricing_Master_Guide_v4.
 * All monetary values in cents (USD). Never store or compute in floats.
 *
 * UPDATE THIS FILE when pricing changes — it is the single source of truth
 * for the automated billing engine. The version string is stored on invoices.
 */

export const PRICING_TABLE_VERSION = "2026-09";

export type AutomatedBillingPlanId = "essential" | "professional" | "command" | "enterprise";
/** @deprecated Use {@link AutomatedBillingPlanId} */
export type PlanId = AutomatedBillingPlanId;

export type TierId = "micro" | "small" | "medium" | "large" | "t1" | "t2" | "t3" | "t4" | "custom";

export interface TierDefinition {
  tierId: TierId;
  label: string;
  /** Inclusive seat range */
  minDispatcherSeats: number;
  maxDispatcherSeats: number;
  /** Included call volume per month */
  includedCallVolume: number;
  /** Monthly recurring cost in cents */
  monthlyFeeCents: number;
  /** Included dispatcher seats in base */
  includedDispatcherSeats: number;
  /** Included admin/supervisor seats in base */
  includedAdminSeats: number;
  /** Included storage in GB */
  includedStorageGb: number;
  /** Overage per additional dispatcher seat (cents/seat/mo) */
  dispatcherSeatOverageCents: number;
  /** Overage per additional admin/supervisor seat (cents/seat/mo) */
  adminSeatOverageCents: number;
}

export const PLAN_TIERS: Record<AutomatedBillingPlanId, TierDefinition[]> = {
  essential: [
    {
      tierId: "micro",
      label: "Essential — Micro",
      minDispatcherSeats: 1,
      maxDispatcherSeats: 3,
      includedCallVolume: 2000,
      monthlyFeeCents: 280000,
      includedDispatcherSeats: 3,
      includedAdminSeats: 3,
      includedStorageGb: 100,
      dispatcherSeatOverageCents: 15000,
      adminSeatOverageCents: 10000,
    },
    {
      tierId: "small",
      label: "Essential — Small",
      minDispatcherSeats: 4,
      maxDispatcherSeats: 6,
      includedCallVolume: 3500,
      monthlyFeeCents: 420000,
      includedDispatcherSeats: 6,
      includedAdminSeats: 3,
      includedStorageGb: 100,
      dispatcherSeatOverageCents: 15000,
      adminSeatOverageCents: 10000,
    },
    {
      tierId: "medium",
      label: "Essential — Medium",
      minDispatcherSeats: 7,
      maxDispatcherSeats: 8,
      includedCallVolume: 4500,
      monthlyFeeCents: 540000,
      includedDispatcherSeats: 8,
      includedAdminSeats: 3,
      includedStorageGb: 100,
      dispatcherSeatOverageCents: 15000,
      adminSeatOverageCents: 10000,
    },
    {
      tierId: "large",
      label: "Essential — Large",
      minDispatcherSeats: 9,
      maxDispatcherSeats: 10,
      includedCallVolume: 5000,
      monthlyFeeCents: 600000,
      includedDispatcherSeats: 10,
      includedAdminSeats: 3,
      includedStorageGb: 100,
      dispatcherSeatOverageCents: 15000,
      adminSeatOverageCents: 10000,
    },
  ],

  professional: [
    {
      tierId: "t1",
      label: "Professional — T1",
      minDispatcherSeats: 1,
      maxDispatcherSeats: 10,
      includedCallVolume: 10000,
      monthlyFeeCents: 850000,
      includedDispatcherSeats: 10,
      includedAdminSeats: 8,
      includedStorageGb: 500,
      dispatcherSeatOverageCents: 12500,
      adminSeatOverageCents: 10000,
    },
    {
      tierId: "t2",
      label: "Professional — T2",
      minDispatcherSeats: 11,
      maxDispatcherSeats: 18,
      includedCallVolume: 18000,
      monthlyFeeCents: 1300000,
      includedDispatcherSeats: 18,
      includedAdminSeats: 8,
      includedStorageGb: 500,
      dispatcherSeatOverageCents: 12500,
      adminSeatOverageCents: 10000,
    },
    {
      tierId: "t3",
      label: "Professional — T3",
      minDispatcherSeats: 19,
      maxDispatcherSeats: 23,
      includedCallVolume: 23000,
      monthlyFeeCents: 1550000,
      includedDispatcherSeats: 23,
      includedAdminSeats: 8,
      includedStorageGb: 500,
      dispatcherSeatOverageCents: 12500,
      adminSeatOverageCents: 10000,
    },
    {
      tierId: "t4",
      label: "Professional — T4",
      minDispatcherSeats: 24,
      maxDispatcherSeats: 25,
      includedCallVolume: 25000,
      monthlyFeeCents: 1800000,
      includedDispatcherSeats: 25,
      includedAdminSeats: 8,
      includedStorageGb: 500,
      dispatcherSeatOverageCents: 12500,
      adminSeatOverageCents: 10000,
    },
  ],

  command: [
    {
      tierId: "t1",
      label: "Command — T1",
      minDispatcherSeats: 1,
      maxDispatcherSeats: 25,
      includedCallVolume: 30000,
      monthlyFeeCents: 2250000,
      includedDispatcherSeats: 25,
      includedAdminSeats: 20,
      includedStorageGb: 2048,
      dispatcherSeatOverageCents: 10000,
      adminSeatOverageCents: 8500,
    },
    {
      tierId: "t2",
      label: "Command — T2",
      minDispatcherSeats: 26,
      maxDispatcherSeats: 50,
      includedCallVolume: 60000,
      monthlyFeeCents: 3100000,
      includedDispatcherSeats: 50,
      includedAdminSeats: 20,
      includedStorageGb: 2048,
      dispatcherSeatOverageCents: 10000,
      adminSeatOverageCents: 8500,
    },
    {
      tierId: "t3",
      label: "Command — T3",
      minDispatcherSeats: 51,
      maxDispatcherSeats: 65,
      includedCallVolume: 85000,
      monthlyFeeCents: 4000000,
      includedDispatcherSeats: 65,
      includedAdminSeats: 20,
      includedStorageGb: 2048,
      dispatcherSeatOverageCents: 10000,
      adminSeatOverageCents: 8500,
    },
    {
      tierId: "t4",
      label: "Command — T4",
      minDispatcherSeats: 66,
      maxDispatcherSeats: 75,
      includedCallVolume: 100000,
      monthlyFeeCents: 5000000,
      includedDispatcherSeats: 75,
      includedAdminSeats: 20,
      includedStorageGb: 2048,
      dispatcherSeatOverageCents: 10000,
      adminSeatOverageCents: 8500,
    },
  ],

  // Enterprise: monthly fee stored in AgencyBillingConfig.customMonthlyFeeCents
  enterprise: [],
};

/** Usage overage rates. Call overage is a fractional cent; always round the product. */
export const OVERAGE_RATES = {
  storagePerGbCents: 8,
  callsPerCallCents: 0.3,
  transcriptionPerMinuteCents: 1,
  translationPerRequestCents: 5,
  photosPer100Cents: 5,
  archiveStoragePerGbCents: 2,
  dataExportPerGbCents: 10,
} as const;

/** Discount percentages (basis points — 1000 = 10%) */
export const DISCOUNT_BASIS_POINTS = {
  annualCommit1yr: 1000,
  annualCommit2yr: 1500,
  annualCommit3yr: 2000,
  pilotConversion: 1000,
  competitiveDisplacement: 1500,
  bundleAddon3Plus: 1500,
  nonprofitTribal: 2000,
  strategicReference: 2500,
} as const;

export type DiscountType = keyof typeof DISCOUNT_BASIS_POINTS;

/** Maximum stacked commercial discount without VP+CFO approval (25%). */
export const MAX_UNAPPROVED_DISCOUNT_BASIS_POINTS = 2500;

/** Tier resolution: find the right tier for a plan + contracted dispatcher seat count */
export function resolveTier(
  planId: AutomatedBillingPlanId,
  dispatcherSeats: number,
): TierDefinition | null {
  if (planId === "enterprise") return null;
  const tiers = PLAN_TIERS[planId];
  return (
    tiers.find(
      (t) => dispatcherSeats >= t.minDispatcherSeats && dispatcherSeats <= t.maxDispatcherSeats,
    ) ?? null
  );
}
