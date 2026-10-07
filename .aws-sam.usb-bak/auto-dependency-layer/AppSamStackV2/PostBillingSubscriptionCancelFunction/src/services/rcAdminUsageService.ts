import type { RcLiteKeyTier } from "rapid-cortex-shared";
import { RcLiteApiKeyRepository } from "../repositories/rcLiteApiKeyRepository.js";
import { RcLiteUsageRepository } from "../repositories/rcLiteUsageRepository.js";
import { RC_LITE_OVERAGE_RATES_PER_1K, RC_LITE_TIER_LIMITS } from "../v1/config/tierLimits.js";

export const RC_LITE_TIER_BASE_FEES_USD: Record<RcLiteKeyTier, number> = {
  dev: 500,
  small: 2_500,
  medium: 8_500,
  large: 18_000,
  enterprise: 0,
};

export type RcAdminUsageCustomerRow = {
  customerId: string;
  agencyId: string;
  keyId: string;
  keyName?: string;
  yearMonth: string;
  totalCalls: number;
  tier: RcLiteKeyTier;
  monthlyCallLimit: number;
  overageCalls: number;
  lastCallAt?: string;
};

function overageCharge(calls: number, tier: RcLiteKeyTier): number {
  const quota = RC_LITE_TIER_LIMITS[tier].monthlyCallLimit;
  const over = Math.max(0, calls - quota);
  const rate = RC_LITE_OVERAGE_RATES_PER_1K[tier] ?? 0;
  return Math.round((over / 1_000) * rate * 100) / 100;
}

const usageRepo = new RcLiteUsageRepository();
const keyRepo = new RcLiteApiKeyRepository();

export class RcAdminUsageService {
  async listCustomersForMonth(yearMonth: string): Promise<RcAdminUsageCustomerRow[]> {
    const rows = await usageRepo.listByYearMonth(yearMonth, 1000);
    const out: RcAdminUsageCustomerRow[] = [];
    for (const row of rows) {
      const key = await keyRepo.getByKeyId(row.keyId);
      out.push({
        customerId: row.customerId,
        agencyId: row.agencyId,
        keyId: row.keyId,
        keyName: key?.name,
        yearMonth: row.yearMonth,
        totalCalls: row.totalCalls,
        tier: row.tier,
        monthlyCallLimit: row.monthlyCallLimit,
        overageCalls: row.overageCalls,
        lastCallAt: row.lastUpdatedAt,
      });
    }
    out.sort((a, b) => b.totalCalls - a.totalCalls);
    return out;
  }

  buildUsageCsv(customers: RcAdminUsageCustomerRow[]): string {
    const header =
      "customerId,agencyId,keyId,keyName,tier,totalCalls,monthlyCallLimit,overageCalls,lastCallAt";
    const lines = customers.map((r) =>
      [
        r.customerId,
        r.agencyId,
        r.keyId,
        r.keyName ?? "",
        r.tier,
        r.totalCalls,
        r.monthlyCallLimit,
        r.overageCalls,
        r.lastCallAt ?? "",
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(","),
    );
    return [header, ...lines].join("\n");
  }

  buildBillingCsv(customers: RcAdminUsageCustomerRow[]): string {
    const header = "customerId,agencyId,keyId,tier,baseFeeUsd,overageFeeUsd,totalDueUsd,yearMonth";
    const lines = customers.map((r) => {
      const base = RC_LITE_TIER_BASE_FEES_USD[r.tier] ?? 500;
      const over = overageCharge(r.totalCalls, r.tier);
      const total = base + over;
      return [
        r.customerId,
        r.agencyId,
        r.keyId,
        r.tier,
        base,
        over,
        total,
        r.yearMonth,
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(",");
    });
    return [header, ...lines].join("\n");
  }
}
