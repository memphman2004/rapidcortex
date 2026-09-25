/** Marginal commission tiers — single source of truth (contractor agreement §3a). Values in cents. */

export type CommissionTier = {
  label: string;
  fromCents: number;
  toCents: number;
  rate: number;
};

export const COMMISSION_TIERS: readonly CommissionTier[] = [
  { label: "First $10,000", fromCents: 0, toCents: 1_000_000, rate: 0.2 },
  { label: "$10,001 – $50,000", fromCents: 1_000_001, toCents: 5_000_000, rate: 0.175 },
  { label: "$50,001 – $100,000", fromCents: 5_000_001, toCents: 10_000_000, rate: 0.15 },
  { label: "$100,001 – $250,000", fromCents: 10_000_001, toCents: 25_000_000, rate: 0.125 },
  { label: "Above $250,000", fromCents: 25_000_001, toCents: Number.POSITIVE_INFINITY, rate: 0.1 },
] as const;

export type CommissionBreakdownRow = {
  label: string;
  bandCents: number;
  rate: number;
  commissionCents: number;
};

export type CommissionResult = {
  acvCents: number;
  commissionCents: number;
  effectiveRate: number;
  rows: CommissionBreakdownRow[];
};

/**
 * Marginal commission on ACV (cents).
 * Example: $200,000 ACV → $29,000 commission.
 */
export function computeCommission(acvCents: number): CommissionResult {
  let remaining = Math.max(0, Math.floor(acvCents));
  let commissionCents = 0;
  const rows: CommissionBreakdownRow[] = [];

  for (const tier of COMMISSION_TIERS) {
    if (remaining <= 0) break;
    const cap =
      tier.toCents === Number.POSITIVE_INFINITY
        ? remaining
        : tier.toCents - tier.fromCents + 1;
    const applied = Math.min(remaining, Math.max(0, cap));
    if (applied <= 0) continue;
    const bandCommission = Math.round(applied * tier.rate);
    commissionCents += bandCommission;
    rows.push({
      label: tier.label,
      bandCents: applied,
      rate: tier.rate,
      commissionCents: bandCommission,
    });
    remaining -= applied;
  }

  const acv = Math.max(0, Math.floor(acvCents));
  return {
    acvCents: acv,
    commissionCents,
    effectiveRate: acv > 0 ? commissionCents / acv : 0,
    rows,
  };
}
