import { findAgencySopSteps, type ResponseIQModePolicy } from "./mode-policy.js";
import { matchCadNaturePattern } from "./mode-policy.js";
import {
  DEFAULT_PROTOCOL_LIBRARY,
  GENERIC_FALLBACK_STEPS,
  type ProtocolLibraryEntry,
  type ResponseIQInstruction,
} from "./instructions.js";
import type { StepCategory } from "./reconciliation-types.js";

export type ResolveInstructionsInput = {
  cadNatureCode: string;
  policy?: ResponseIQModePolicy | null;
  protocolLibrary?: ProtocolLibraryEntry[];
};

/**
 * Hierarchy:
 * 1. Agency SOP steps for matching nature pattern
 * 2. Protocol library defaults
 * 3. Generic fallback
 */
export function resolveResponseIQInstructions(
  input: ResolveInstructionsInput,
): { instructions: ResponseIQInstruction[]; source: "agency_sop" | "protocol_library" | "generic"; protocolId: string } {
  const nature = input.cadNatureCode.trim() || "UNKNOWN";
  const nowPrefix = nature.replace(/[^A-Z0-9_]/gi, "_").toUpperCase() || "GENERIC";

  const agencySteps = findAgencySopSteps(input.policy, nature);
  if (agencySteps?.length) {
    return {
      source: "agency_sop",
      protocolId: `AGENCY_SOP_${nowPrefix}`,
      instructions: agencySteps.map((text, i) => ({
        stepId: `AGENCY_${nowPrefix}_s${i + 1}`,
        order: i + 1,
        text,
        category: "GENERAL" as StepCategory,
        status: "ACTIVE" as const,
      })),
    };
  }

  const library = input.protocolLibrary ?? DEFAULT_PROTOCOL_LIBRARY;
  for (const entry of library) {
    const matched = entry.cadNaturePatterns.some((p) => matchCadNaturePattern(nature, p));
    if (!matched) continue;
    // Skip catch-all `*` until we've tried specific protocols
    if (entry.cadNaturePatterns.length === 1 && entry.cadNaturePatterns[0] === "*") continue;
    return {
      source: "protocol_library",
      protocolId: entry.protocolId,
      instructions: entry.steps.map((s, i) => ({
        stepId: `${entry.protocolId}_s${i + 1}`,
        order: i + 1,
        text: s.text,
        category: s.category,
        status: "ACTIVE" as const,
      })),
    };
  }

  const genericEntry = library.find((e) => e.cadNaturePatterns.includes("*"));
  if (genericEntry) {
    return {
      source: "protocol_library",
      protocolId: genericEntry.protocolId,
      instructions: genericEntry.steps.map((s, i) => ({
        stepId: `${genericEntry.protocolId}_s${i + 1}`,
        order: i + 1,
        text: s.text,
        category: s.category,
        status: "ACTIVE" as const,
      })),
    };
  }

  return {
    source: "generic",
    protocolId: "GENERIC_FALLBACK",
    instructions: GENERIC_FALLBACK_STEPS.map((text, i) => ({
      stepId: `GENERIC_s${i + 1}`,
      order: i + 1,
      text,
      category: "GENERAL" as StepCategory,
      status: "ACTIVE" as const,
    })),
  };
}
