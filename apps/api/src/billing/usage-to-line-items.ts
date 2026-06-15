import type { BillingInvoiceLineItemInput } from "rapid-cortex-shared";
import type { RcLiteKeyTier } from "rapid-cortex-shared";
import type { RcAdminUsageCustomerRow } from "../services/rcAdminUsageService.js";
import { RC_LITE_OVERAGE_RATES_PER_1K, RC_LITE_TIER_LIMITS } from "../v1/config/tierLimits.js";
import { RC_LITE_TIER_BASE_FEES_USD } from "../services/rcAdminUsageService.js";

export function formatBillingPeriodLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
}

export function bulkDraftNotesTag(yearMonth: string): string {
  return `billingPeriod:${yearMonth}`;
}

export function overageFeeUsd(totalCalls: number, tier: RcLiteKeyTier): number {
  const quota = RC_LITE_TIER_LIMITS[tier].monthlyCallLimit;
  const over = Math.max(0, totalCalls - quota);
  const rate = RC_LITE_OVERAGE_RATES_PER_1K[tier] ?? 0;
  return Math.round((over / 1_000) * rate * 100) / 100;
}

export function usageRowTotalUsd(row: RcAdminUsageCustomerRow): number {
  const base = RC_LITE_TIER_BASE_FEES_USD[row.tier] ?? 500;
  return base + overageFeeUsd(row.totalCalls, row.tier);
}

export function buildLineItemsForUsageRow(
  row: RcAdminUsageCustomerRow,
  sortOffset = 0,
): BillingInvoiceLineItemInput[] {
  const periodLabel = formatBillingPeriodLabel(row.yearMonth);
  const keyLabel = row.keyName?.trim() || row.customerId;
  const tierLabel = row.tier.charAt(0).toUpperCase() + row.tier.slice(1);
  const baseFee = RC_LITE_TIER_BASE_FEES_USD[row.tier] ?? 500;
  const overFee = overageFeeUsd(row.totalCalls, row.tier);
  const items: BillingInvoiceLineItemInput[] = [
    {
      serviceName: "RC Lite API",
      description: `${tierLabel} plan — ${keyLabel} — ${periodLabel}`,
      quantity: 1,
      unitPrice: baseFee,
      sortOrder: sortOffset,
    },
  ];
  if (overFee > 0) {
    const overCalls = Math.max(0, row.totalCalls - row.monthlyCallLimit);
    items.push({
      serviceName: "RC Lite API Overage",
      description: `API overage — ${overCalls.toLocaleString()} calls over ${row.monthlyCallLimit.toLocaleString()} included (${keyLabel})`,
      quantity: 1,
      unitPrice: overFee,
      sortOrder: sortOffset + 1,
    });
  }
  return items;
}

export function buildAgencyLineItems(rows: RcAdminUsageCustomerRow[]): BillingInvoiceLineItemInput[] {
  const lineItems: BillingInvoiceLineItemInput[] = [];
  let sortOrder = 0;
  for (const row of rows) {
    const built = buildLineItemsForUsageRow(row, sortOrder);
    lineItems.push(...built);
    sortOrder += built.length;
  }
  return lineItems;
}

export function agencyInvoiceTotal(rows: RcAdminUsageCustomerRow[]): number {
  return Number(rows.reduce((sum, row) => sum + usageRowTotalUsd(row), 0).toFixed(2));
}
