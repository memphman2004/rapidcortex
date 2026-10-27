export type SurgeTransferReason = "LOW_CONFIDENCE" | "EXTERNAL_311" | "HUMAN_REQUEST" | "EMERGENCY";

/**
 * During a surge, non-urgent reports stay with Nexiq and get a report number.
 * A caller who asks for a person, and every emergency, still transfers.
 */
export function surgeCompletesInsteadOfTransfer(opts: {
  surgeMode?: boolean | null;
  reason: SurgeTransferReason;
}): boolean {
  if (opts.surgeMode !== true) return false;
  return opts.reason === "LOW_CONFIDENCE" || opts.reason === "EXTERNAL_311";
}
