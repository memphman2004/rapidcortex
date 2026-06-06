import type { RcLiteKeyTier } from "rapid-cortex-shared";

/** Rollup consumed by recurring invoice generation / PDF (Phase 8). */

export interface RcLiteBillingKeySummary {
  keyId: string;
  keyName: string;
  tier: RcLiteKeyTier;
  totalCalls: number;
  includedCalls: number;
  overageCalls: number;
  overageRate: number;
  overageCharge: number;
}

export interface RcLiteBillingSummary {
  customerId: string;
  yearMonth: string;
  keys: RcLiteBillingKeySummary[];
  totalOverageCharge: number;
  /** Base recurring charges remain in billing_schedule / invoice rows. */
  baseSubscriptionCharge: number;
}

/**
 * Reads RC Lite Dynamo usage summaries for invoicing (query by customer GSI client-side stub).
 */
export async function getRcLiteUsageSummaryForBilling(
  _customerId: string,
  _yearMonth: string,
): Promise<RcLiteBillingSummary> {
  return {
    customerId: _customerId,
    yearMonth: _yearMonth,
    keys: [],
    totalOverageCharge: 0,
    baseSubscriptionCharge: 0,
  };
}
