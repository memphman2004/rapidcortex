/**
 * Late fee and interest calculations per MSA Article 4.6.
 * All amounts are in cents (integers). Never use floating-point for money.
 */

/** $50 flat fee for 1–30 days overdue; $100 for 31+ days. */
export function calculateLateFee(daysOverdue: number): number {
  if (daysOverdue <= 0) return 0;
  if (daysOverdue <= 30) return 50_00; // $50.00
  return 100_00;                        // $100.00
}

/** 1.5%/month compound interest on outstanding balance per MSA §4.6. */
export function calculateLateInterest(outstandingCents: number, daysOverdue: number): number {
  if (daysOverdue <= 0 || outstandingCents <= 0) return 0;
  const monthsOverdue = daysOverdue / 30;
  const monthlyRate = 0.015;
  return Math.round(outstandingCents * monthlyRate * monthsOverdue);
}
