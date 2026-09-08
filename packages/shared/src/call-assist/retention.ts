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
