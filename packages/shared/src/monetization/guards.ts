import type { MonetizationPlanId } from "./plan-ids.js";

const PLANS = new Set<MonetizationPlanId>([
  "essential",
  "command",
  "enterprise_statewide",
  "rc_lite",
]);

export function isMonetizationPlanId(value: string): value is MonetizationPlanId {
  return PLANS.has(value as MonetizationPlanId);
}
