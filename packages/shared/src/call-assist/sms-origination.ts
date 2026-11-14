/**
 * Call Assist SMS must not use Pre-Arrival iQ’s Pinpoint origination number.
 * Live stacks may still be mis-pointed; treat equality as a config defect, not a product default.
 */

/** Pre-Arrival iQ Pinpoint / SMS number — owned by Pre-Arrival, not Call Assist. */
export const PRE_ARRIVAL_IQ_SMS_ORIGINATION_E164 = "+13198358230";

export function isPreArrivalIqSmsOrigination(e164: string | null | undefined): boolean {
  const n = (e164 ?? "").trim();
  if (!n) return false;
  const digits = n.replace(/\D/g, "");
  return digits === "13198358230" || digits === "3198358230";
}

/**
 * Example DID for unit tests only — not a live production number.
 * Do not copy Pre-Arrival iQ’s number into Call Assist fixtures.
 */
export const CALL_ASSIST_SMS_TEST_DID_E164 = "+18165550199";
