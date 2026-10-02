/**
 * Pro-rata billing calculations.
 * All amounts are in cents. All dates treated as UTC.
 */

/**
 * Returns the pro-rated amount in cents for a partial first month.
 * Uses the number of remaining calendar days in the go-live month (inclusive).
 */
export function calculateProratedAmount(goLiveDate: Date, monthlyFeeCents: number): number {
  if (monthlyFeeCents <= 0) return 0;
  const year = goLiveDate.getUTCFullYear();
  const month = goLiveDate.getUTCMonth();
  const totalDays = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const remainingDays = totalDays - goLiveDate.getUTCDate() + 1; // inclusive
  return Math.round((remainingDays / totalDays) * monthlyFeeCents);
}
