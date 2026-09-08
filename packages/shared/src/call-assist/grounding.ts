/** Agency grounding — the model must never invent policy, hours, or phone numbers. */

const FABRICATION_CUES =
  /\b(as a doctor|you should take|i recommend cpr|the fine is|hours are|our policy is|officers will arrive in)\b/i;

export type GroundingDecision = {
  allowed: boolean;
  reason: string;
};

export function assertGroundedReply(opts: {
  proposedText: string;
  knowledgeHit: boolean;
  isEmergencyTransfer: boolean;
}): GroundingDecision {
  if (opts.isEmergencyTransfer) {
    return { allowed: true, reason: "emergency_transfer_script" };
  }
  if (FABRICATION_CUES.test(opts.proposedText) && !opts.knowledgeHit) {
    return { allowed: false, reason: "unsupported_policy_or_medical_claim" };
  }
  return { allowed: true, reason: "pass" };
}
