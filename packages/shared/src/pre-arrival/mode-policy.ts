import { z } from "zod";
import { isRestrictedNatureCode } from "./reconciliation-types.js";

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

/** Match CAD nature against agency SOP / protocol pattern.
 *  `FIRE*` prefix, `*ROBBERY*` contains, exact otherwise.
 */
export function matchCadNaturePattern(natureCode: string, pattern: string): boolean {
  const code = natureCode.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const pat = pattern.trim().toUpperCase();
  if (!pat) return false;
  if (pat === "*") return true;
  if (pat.startsWith("*") && pat.endsWith("*") && pat.length > 2) {
    const needle = pat.slice(1, -1).replace(/[^A-Z0-9]+/g, "_");
    return needle.length > 0 && code.includes(needle);
  }
  if (pat.endsWith("*")) {
    const prefix = pat.slice(0, -1);
    return code.startsWith(prefix);
  }
  return code === pat;
}

/**
 * Disclosure modes from provisional NXQ-2026-001-PROV.
 * Hardcoded. Agency SOP text may replace FULL instruction wording.
 * It cannot move an incident out of RESTRICTED or into FULL.
 */
export const preArrivalSessionModeSchema = z.enum(["RESTRICTED", "STATUS_ONLY", "FULL"]);
export type PreArrivalSessionMode = z.infer<typeof preArrivalSessionModeSchema>;

/** Crime-in-progress natures: assignment status only. No ETA, route, or instructions. */
const STATUS_ONLY_PATTERNS = [
  "*ROBBERY*",
  "*BURGLAR*",
  "*THEFT*",
  "*INVASION*",
  "*ASSAULT*",
  "*FIGHT*",
  "*WEAPON*",
  "*STABB*",
  "*DISTURBANCE*",
  "211",
] as const;

/** Whether a CAD incident event may open a session with no dispatcher action. */
export function decideCadAutoOpen(params: {
  natureCode: string;
  callerPhoneE164: string | null | undefined;
  hasOpenSession: boolean;
}): "open" | "restricted" | "missing_phone" | "already_open" {
  if (params.hasOpenSession) return "already_open";
  if (classifyPreArrivalSessionMode(params.natureCode) === "RESTRICTED") return "restricted";
  if (!params.callerPhoneE164) return "missing_phone";
  return "open";
}

export function classifyPreArrivalSessionMode(natureCode: string): PreArrivalSessionMode {
  if (isRestrictedNatureCode(natureCode)) return "RESTRICTED";
  if (STATUS_ONLY_PATTERNS.some((pattern) => matchCadNaturePattern(natureCode, pattern))) {
    return "STATUS_ONLY";
  }
  return "FULL";
}

/**
 * Map a precise ETA onto a range that contains it, whose bounds are at least
 * two minutes away, and that is shared by neighboring values so the precise
 * minute cannot be read back from the range.
 */
export function blurEstimatedArrivalMinutes(preciseMinutes: number): { low: number; high: number } | null {
  const precise = Math.round(preciseMinutes);
  if (!Number.isFinite(precise) || precise <= 2) return null;
  const shift = precise % 3;
  const low = Math.max(1, precise - 2 - shift);
  const width = precise <= 8 ? 7 : precise <= 15 ? 9 : 12;
  const high = low + width;
  if (low >= precise || high <= precise) return { low: precise - 2, high: precise + 4 };
  if (precise - low < 2 || high - precise < 2) return { low: precise - 2, high: precise + 4 };
  return { low, high };
}

/** Coarse route progress. Buckets are too wide to recover a precise ETA or coordinate. */
export function callerRouteProgress(params: {
  responderStatus: "dispatched" | "responding" | "arrived";
  etaMinutes?: number | null;
}): number {
  if (params.responderStatus === "arrived") return 1;
  if (params.responderStatus === "dispatched") return 0.2;
  const eta = params.etaMinutes;
  if (eta == null || eta <= 2) return 0.85;
  if (eta <= 8) return 0.65;
  return 0.4;
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
