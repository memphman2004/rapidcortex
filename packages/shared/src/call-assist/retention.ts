import { z } from "zod";

export const retentionPolicySchema = z.object({
  policyId: z.string().min(1).max(64),
  jurisdiction: z.string().min(2).max(8),
  statute: z.string().max(120).optional(),
  /** Public-facing policy name (e.g. "Missouri Sunshine Law"). Never a specific agency. */
  displayName: z.string().max(120).optional(),
  policyName: z.string().max(120).optional(),
  governingLaw: z.string().max(500).nullable().optional(),
  audioRetentionDays: z.number().int().min(1).max(3650),
  transcriptRetentionDays: z.number().int().min(1).max(3650),
  intakeDataRetentionDays: z.number().int().min(1).max(3650),
  analyticsRetentionDays: z.number().int().min(1).max(3650),
  publicRecordsRequestSupported: z.boolean(),
  exportFormats: z.array(z.string().min(1).max(16)).min(1),
  chainOfCustodyRequired: z.boolean(),
  deletionAuditRequired: z.boolean(),
  legalHoldSupported: z.boolean(),
});
export type RetentionPolicy = z.infer<typeof retentionPolicySchema>;

/** Missouri Sunshine Law (RSMo 610) — tenant default, not engine logic. */
export const MISSOURI_SUNSHINE_RETENTION_POLICY: RetentionPolicy = {
  policyId: "mo-sunshine-default",
  jurisdiction: "MO",
  statute: "RSMo 610",
  displayName: "Missouri Sunshine Law",
  policyName: "Missouri Sunshine Law",
  governingLaw: "Missouri Sunshine Law (RSMo 610)",
  audioRetentionDays: 365 * 3,
  transcriptRetentionDays: 365 * 3,
  intakeDataRetentionDays: 365 * 7,
  analyticsRetentionDays: 365 * 7,
  publicRecordsRequestSupported: true,
  exportFormats: ["MP3", "WAV", "JSON", "CSV", "PDF", "TXT"],
  chainOfCustodyRequired: true,
  deletionAuditRequired: true,
  legalHoldSupported: true,
};

export const CALL_ASSIST_RETENTION_DATA_TYPES = [
  "audio",
  "transcript",
  "intake",
  "analytics",
] as const;
export type CallAssistRetentionDataType = (typeof CALL_ASSIST_RETENTION_DATA_TYPES)[number];

export function retentionDaysForType(
  policy: Pick<
    RetentionPolicy,
    "audioRetentionDays" | "transcriptRetentionDays" | "intakeDataRetentionDays" | "analyticsRetentionDays"
  >,
  dataType: CallAssistRetentionDataType,
): number {
  if (dataType === "audio") return policy.audioRetentionDays;
  if (dataType === "transcript") return policy.transcriptRetentionDays;
  if (dataType === "intake") return policy.intakeDataRetentionDays;
  return policy.analyticsRetentionDays;
}

export function isRetentionDue(opts: {
  createdAtIso: string;
  retentionDays: number;
  legalHold: boolean;
  nowMs?: number;
}): boolean {
  if (opts.legalHold) return false;
  const created = Date.parse(opts.createdAtIso);
  if (!Number.isFinite(created)) return false;
  const now = opts.nowMs ?? Date.now();
  return now - created >= opts.retentionDays * 86_400_000;
}

export const callAssistRetentionPatchSchema = retentionPolicySchema.partial();
export type CallAssistRetentionPatch = z.infer<typeof callAssistRetentionPatchSchema>;

export type CallAssistRetentionPurgePlan = {
  redactAudio: boolean;
  redactTranscript: boolean;
  deleteSession: boolean;
  deleteSurvey: boolean;
};

export function planCallAssistRetentionActions(opts: {
  createdAtIso: string;
  policy: Pick<
    RetentionPolicy,
    "audioRetentionDays" | "transcriptRetentionDays" | "intakeDataRetentionDays" | "analyticsRetentionDays"
  >;
  legalHold: boolean;
  nowMs?: number;
}): CallAssistRetentionPurgePlan {
  const due = (days: number) => isRetentionDue({ createdAtIso: opts.createdAtIso, retentionDays: days, legalHold: opts.legalHold, nowMs: opts.nowMs });
  return {
    redactAudio: due(opts.policy.audioRetentionDays),
    redactTranscript: due(opts.policy.transcriptRetentionDays),
    deleteSession: due(opts.policy.intakeDataRetentionDays),
    deleteSurvey: due(opts.policy.analyticsRetentionDays),
  };
}
