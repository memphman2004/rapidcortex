/** Agency grounding — the model must never invent policy, hours, or phone numbers. */

const FABRICATION_CUES =
  /\b(as a doctor|you should take|i recommend cpr|the fine is|hours are|our policy is|officers will arrive in)\b/i;

export type GroundingDecision = {
  allowed: boolean;
  reason: string;
};

export function groundedKnowledgeReply(opts: {
  proposedText: string;
  knowledgeHit: boolean;
  requiresKnowledge?: boolean;
  isEmergencyTransfer?: boolean;
}): string {
  const check = assertGroundedReply({
    proposedText: opts.proposedText,
    knowledgeHit: opts.knowledgeHit,
    isEmergencyTransfer: Boolean(opts.isEmergencyTransfer),
    requiresKnowledge: opts.requiresKnowledge,
  });
  if (!check.allowed) {
    return "I don't have that in the department knowledge base. I can connect you with a call taker.";
  }
  return opts.proposedText;
}

export function assertGroundedReply(opts: {
  proposedText: string;
  knowledgeHit: boolean;
  isEmergencyTransfer: boolean;
  /** Information / policy answers must come from the agency knowledge base. */
  requiresKnowledge?: boolean;
}): GroundingDecision {
  if (opts.isEmergencyTransfer) {
    return { allowed: true, reason: "emergency_transfer_script" };
  }
  if (opts.requiresKnowledge && !opts.knowledgeHit) {
    return { allowed: false, reason: "no_knowledge_base_hit" };
  }
  if (FABRICATION_CUES.test(opts.proposedText) && !opts.knowledgeHit) {
    return { allowed: false, reason: "unsupported_policy_or_medical_claim" };
  }
  return { allowed: true, reason: "pass" };
}
