/**
 * Continuous Safety Engine.
 *
 * Emergency transfer is architectural, not a prompt or feature flag.
 * This module has no `enabled` switch and ignores admin config for the 911 path.
 */
import { EMERGENCY_TRANSFER_ACTION, type EmergencyTransferAction } from "./classifications.js";

export type SafetyRiskLevel = "NONE" | "LOW" | "ELEVATED" | "CRITICAL";

export type SafetyTriggerId =
  | "WEAPON"
  | "ACTIVE_VIOLENCE"
  | "MEDICAL_CRISIS"
  | "FIRE_EXPLOSION"
  | "IN_PROGRESS_CRIME"
  | "SELF_HARM_IMMINENT"
  | "CALLER_SAYS_EMERGENCY"
  | "DISTRESS_KEYWORD";

export type SafetyDecision = {
  classification: "EMERGENCY" | "CONTINUE";
  action: EmergencyTransferAction | "CONTINUE";
  continueAiConversation: boolean;
  riskLevel: SafetyRiskLevel;
  triggers: SafetyTriggerId[];
  matchedPhrases: string[];
  reasons: string[];
};

const TRIGGER_PATTERNS: ReadonlyArray<{ id: SafetyTriggerId; re: RegExp; phrase: string }> = [
  {
    id: "CALLER_SAYS_EMERGENCY",
    re: /\b(emergency|nine[\s-]?one[\s-]?one|911|emergencia)\b/i,
    phrase: "emergency/911",
  },
  {
    id: "WEAPON",
    re: /\b(gun|firearm|pistol|rifle|shotgun|he has a gun|she has a gun|they have a gun|weapon|pistola|arma de fuego)\b/i,
    phrase: "weapon",
  },
  {
    id: "ACTIVE_VIOLENCE",
    re: /\b(shooting|shot|stabbed|stabbing|active shooter|beating (him|her|them)|being attacked)\b/i,
    phrase: "active violence",
  },
  {
    id: "MEDICAL_CRISIS",
    re: /\b(not breathing|unconscious|overdose|heart attack|choking|dying|can't breathe|cannot breathe)\b/i,
    phrase: "medical crisis",
  },
  {
    id: "FIRE_EXPLOSION",
    re: /\b(on fire|house fire|building fire|explosion|exploded|smoke filling)\b/i,
    phrase: "fire/explosion",
  },
  {
    id: "IN_PROGRESS_CRIME",
    re: /\b(breaking in (right )?now|he's inside|she's inside|still here with (a |the )?weapon|kidnapping|abduction)\b/i,
    phrase: "crime in progress",
  },
  {
    id: "SELF_HARM_IMMINENT",
    re: /\b(going to kill (myself|himself|herself)|has a knife to|suicide (right )?now)\b/i,
    phrase: "imminent self-harm",
  },
  {
    id: "DISTRESS_KEYWORD",
    re: /\b(help me|auxilio|ayúdame|ayudame|he's going to kill me|she's going to kill me|they're going to kill me)\b/i,
    phrase: "distress",
  },
];

function riskFromTriggers(triggers: SafetyTriggerId[]): SafetyRiskLevel {
  if (triggers.length === 0) return "NONE";
  if (triggers.includes("WEAPON") || triggers.includes("ACTIVE_VIOLENCE") || triggers.includes("MEDICAL_CRISIS")) {
    return "CRITICAL";
  }
  if (triggers.includes("CALLER_SAYS_EMERGENCY") || triggers.includes("FIRE_EXPLOSION") || triggers.includes("IN_PROGRESS_CRIME")) {
    return "CRITICAL";
  }
  if (triggers.includes("SELF_HARM_IMMINENT") || triggers.includes("DISTRESS_KEYWORD")) {
    return "CRITICAL";
  }
  return "ELEVATED";
}

/**
 * Evaluate a caller utterance (or concatenated recent text).
 * Feature flags, prompts, and tenant config cannot suppress TRANSFER_911.
 */
export function evaluateSafety(utterance: string): SafetyDecision {
  const text = (utterance ?? "").trim();
  if (!text) {
    return {
      classification: "CONTINUE",
      action: "CONTINUE",
      continueAiConversation: true,
      riskLevel: "NONE",
      triggers: [],
      matchedPhrases: [],
      reasons: ["empty_utterance"],
    };
  }

  const triggers: SafetyTriggerId[] = [];
  const matchedPhrases: string[] = [];
  for (const row of TRIGGER_PATTERNS) {
    if (row.re.test(text) && !triggers.includes(row.id)) {
      triggers.push(row.id);
      matchedPhrases.push(row.phrase);
    }
  }

  if (triggers.length === 0) {
    return {
      classification: "CONTINUE",
      action: "CONTINUE",
      continueAiConversation: true,
      riskLevel: "NONE",
      triggers: [],
      matchedPhrases: [],
      reasons: ["no_safety_triggers"],
    };
  }

  return {
    classification: "EMERGENCY",
    action: EMERGENCY_TRANSFER_ACTION,
    continueAiConversation: false,
    riskLevel: riskFromTriggers(triggers),
    triggers,
    matchedPhrases,
    reasons: ["deterministic_safety_engine"],
  };
}

/** True when the pipeline must stop AI talk-track and transfer. */
export function isImmutableEmergency(decision: SafetyDecision): boolean {
  return decision.action === EMERGENCY_TRANSFER_ACTION && decision.continueAiConversation === false;
}
