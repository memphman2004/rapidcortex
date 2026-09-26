import type { QuotePlan, RoiInputs } from "rapid-cortex-shared";

/** Internal plan pricing for ROI recommendation only — never shown on public ROI page. */
const PLAN_PRICING: Record<
  Exclude<QuotePlan, "Enterprise">,
  { monthlyMid: number; setupMid: number }
> = {
  Essential: { monthlyMid: 3500, setupMid: 5000 },
  Professional: { monthlyMid: 7500, setupMid: 12000 },
  Command: { monthlyMid: 15000, setupMid: 25000 },
};

export function recommendPlan(seatCount: number, callVolume: number): QuotePlan {
  if (seatCount >= 40 || callVolume >= 50_000) return "Enterprise";
  if (seatCount >= 20 || callVolume >= 20_000) return "Command";
  if (seatCount >= 8 || callVolume >= 5_000) return "Professional";
  return "Essential";
}

export type RoiSavingsPreview = {
  recommendedPlan: QuotePlan;
  annualLanguageSavings: number;
  annualQaSavings: number;
  annualAdminTimeSavings: number;
  totalAnnualSavings: number;
};

export function computeRoiSavings(inputs: RoiInputs): RoiSavingsPreview {
  const recommendedPlan = recommendPlan(inputs.seatCount, inputs.callVolume);
  const annualLanguageSavings = Math.max(0, inputs.languageLineCostDollars) * 0.45;
  const annualQaSavings = Math.max(0, inputs.qaCostDollars) * 0.35;
  const hoursSavedPerCall = Math.max(0, inputs.avgCallTimeSec) / 3600 * 0.15;
  const annualAdminTimeSavings =
    hoursSavedPerCall * Math.max(0, inputs.callVolume) * Math.max(0, inputs.dispatcherHourlyRate);
  const totalAnnualSavings = annualLanguageSavings + annualQaSavings + annualAdminTimeSavings;
  return {
    recommendedPlan,
    annualLanguageSavings: Math.round(annualLanguageSavings),
    annualQaSavings: Math.round(annualQaSavings),
    annualAdminTimeSavings: Math.round(annualAdminTimeSavings),
    totalAnnualSavings: Math.round(totalAnnualSavings),
  };
}

/** Internal-only — do not import from public ROI components. */
export function internalPlanCostHint(plan: QuotePlan): { monthlyMid: number; setupMid: number } | null {
  if (plan === "Enterprise") return null;
  return PLAN_PRICING[plan];
}
