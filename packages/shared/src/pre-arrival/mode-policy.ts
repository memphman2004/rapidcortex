import { z } from "zod";

/**
 * Agency Response iQ / Pre-Arrival mode policy.
 * SOP steps override protocol library defaults by CAD nature pattern.
 */

export const sopStepOverrideSchema = z.object({
  /** e.g. "CARDIAC", "FIRE_*" — `*` matches any suffix */
  cadNaturePattern: z.string().min(1).max(128),
  steps: z.array(z.string().min(1).max(2000)).min(1).max(20),
});
export type SOPStepOverride = z.infer<typeof sopStepOverrideSchema>;

export const responseIQModePolicySchema = z.object({
  showInstructions: z.boolean().default(true),
  /** Show "Your dispatcher is on the line — keep this call open." */
  stayOnLine: z.boolean().default(false),
  sopSteps: z.array(sopStepOverrideSchema).optional(),
});
export type ResponseIQModePolicy = z.infer<typeof responseIQModePolicySchema>;

export const DEFAULT_RESPONSE_IQ_MODE_POLICY: ResponseIQModePolicy = {
  showInstructions: true,
  stayOnLine: false,
};

/** Match CAD nature against agency SOP pattern (`*` suffix wildcard). */
export function matchCadNaturePattern(natureCode: string, pattern: string): boolean {
  const code = natureCode.trim().toUpperCase();
  const pat = pattern.trim().toUpperCase();
  if (!pat) return false;
  if (pat.endsWith("*")) {
    const prefix = pat.slice(0, -1);
    return code.startsWith(prefix);
  }
  return code === pat;
}

export function findAgencySopSteps(
  policy: ResponseIQModePolicy | null | undefined,
  cadNatureCode: string,
): string[] | null {
  if (!policy?.sopSteps?.length) return null;
  for (const override of policy.sopSteps) {
    if (matchCadNaturePattern(cadNatureCode, override.cadNaturePattern)) {
      return [...override.steps];
    }
  }
  return null;
}
