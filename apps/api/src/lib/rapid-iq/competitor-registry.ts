import type { RapidIqOpportunity } from "rapid-cortex-shared";

export const KNOWN_COMPETITORS = [
  "Motorola Solutions",
  "CentralSquare",
  "Carbyne",
  "Axon",
  "RapidSOS",
  "Mark43",
  "Tyler Technologies",
  "Zetron",
  "Bandwidth",
  "Prepared",
  "Priority Dispatch",
  "NICE",
  "Verint",
  "Intrado",
  "West Technology",
] as const;

export function isKnownCompetitor(vendor: string | null | undefined): boolean {
  const v = vendor?.trim().toLowerCase() ?? "";
  if (!v) return false;
  return KNOWN_COMPETITORS.some((c) => v.includes(c.toLowerCase()));
}

/** Estimate contract expiry urgency from signal timing when exact dates are unknown. */
export function estimateContractExpiry(
  _incumbentVendor: string,
  lastSignalDate: string,
): { expiryYear: number | null; urgency: "high" | "medium" | "low" } {
  const signalYear = new Date(lastSignalDate).getFullYear();
  if (Number.isNaN(signalYear)) {
    return { expiryYear: null, urgency: "medium" };
  }
  return {
    expiryYear: signalYear + 1,
    urgency: "high",
  };
}

export function getDisplacementScore(opp: Pick<
  RapidIqOpportunity,
  "incumbentVendor" | "intentStage" | "contractExpirySignal" | "opportunityScore"
>): number {
  if (!isKnownCompetitor(opp.incumbentVendor)) return 0;

  let score = 50;
  if (opp.intentStage === "active_rfp") score += 30;
  if (opp.intentStage === "evaluation") score += 20;
  if (opp.contractExpirySignal) score += 15;
  if (opp.opportunityScore >= 80) score += 5;
  return Math.min(score, 100);
}
