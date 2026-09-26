import { z } from "zod";
import { LeadVerticalSchema, type LeadVertical } from "../monetization/leads-crm.js";

/** Buying-intent / enablement signals attached to CRM leads (not Rapid IQ SignalType). */
export const LeadSignalTypeSchema = z.enum([
  "GRANT_SIGNAL",
  "RFP_SIGNAL",
  "HIRING_SIGNAL",
  "BUDGET_SIGNAL",
  "LEADERSHIP_CHANGE",
  "GRANT_AWARD",
  "CONFERENCE_SIGNAL",
  "COMPETITOR_MENTION",
  "STALE_PIPELINE",
]);
export type LeadSignalType = z.infer<typeof LeadSignalTypeSchema>;

export const SignalStrengthSchema = z.enum(["weak", "moderate", "strong"]);
export type SignalStrength = z.infer<typeof SignalStrengthSchema>;

export const LeadSignalSchema = z.object({
  signalId: z.string().min(1),
  leadId: z.string().min(1),
  type: LeadSignalTypeSchema,
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(4000),
  sourceUrl: z.string().url().optional(),
  source: z.string().min(1).max(80),
  strength: SignalStrengthSchema,
  detectedAt: z.string().min(1),
  repAcknowledged: z.boolean().default(false),
  outcome: z.enum(["acted_on", "dismissed", "not_relevant"]).optional(),
  /**
   * Product vertical this signal belongs to. Required for isolation —
   * campus signals never appear on venue/911 CRM surfaces.
   */
  vertical: LeadVerticalSchema,
});
export type LeadSignal = z.infer<typeof LeadSignalSchema>;

export const GrantSourceSchema = z.enum(["grants.gov", "sam.gov", "state", "sbir", "council"]);
export type GrantSource = z.infer<typeof GrantSourceSchema>;

export const NcqTierMatchSchema = z.enum([
  "essential",
  "professional",
  "command",
  "enterprise",
  "none",
]);
export type NcqTierMatch = z.infer<typeof NcqTierMatchSchema>;

export const GrantCategorySchema = z.enum([
  "911_technology",
  "public_safety_software",
  "first_responder",
  "campus_safety",
  "venue_security",
  "hospital_routing",
  "transit_ops",
]);
export type GrantCategory = z.infer<typeof GrantCategorySchema>;

/** Map classifier categories → CRM LeadVertical for isolation. */
export const GRANT_CATEGORY_TO_VERTICAL: Record<GrantCategory, LeadVertical> = {
  "911_technology": "rc911",
  public_safety_software: "rc911",
  first_responder: "rc911",
  campus_safety: "campus",
  venue_security: "venue",
  hospital_routing: "hospital",
  transit_ops: "transit",
};

export const GrantRecordSchema = z.object({
  grantId: z.string().min(1),
  opportunityId: z.string().min(1),
  source: GrantSourceSchema,
  title: z.string().min(1),
  agency: z.string().min(1),
  description: z.string().default(""),
  awardFloor: z.number().nonnegative().default(0),
  awardCeiling: z.number().nonnegative().default(0),
  postedDate: z.string().optional(),
  closeDate: z.string().optional(),
  eligibility: z.array(z.string()).default([]),
  categories: z.array(GrantCategorySchema).default([]),
  /** Derived from categories — never cross-show across verticals in UI/matching. */
  verticals: z.array(LeadVerticalSchema).min(1),
  relevanceScore: z.number().min(0).max(100).default(0),
  ncqTierMatch: NcqTierMatchSchema.default("none"),
  states: z.array(z.string()).default([]),
  status: z.enum(["active", "closed", "expired"]).default("active"),
  sourceUrl: z.string().url().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GrantRecord = z.infer<typeof GrantRecordSchema>;

export const GrantMatchOutcomeSchema = z.enum([
  "applied",
  "not_applicable",
  "won",
  "lost",
]);
export type GrantMatchOutcome = z.infer<typeof GrantMatchOutcomeSchema>;

export const GrantMatchRecordSchema = z.object({
  leadId: z.string().min(1),
  grantId: z.string().min(1),
  matchScore: z.number().min(0).max(100),
  matchReason: z.string().min(1).max(1000),
  matchedAt: z.string(),
  notifiedAt: z.string().nullable().optional(),
  repAcknowledged: z.boolean().default(false),
  outcome: GrantMatchOutcomeSchema.nullable().optional(),
  /** Copied from lead + grant intersection — query/filter without joins. */
  vertical: LeadVerticalSchema,
  createdAt: z.string(),
});
export type GrantMatchRecord = z.infer<typeof GrantMatchRecordSchema>;

export const patchGrantMatchOutcomeBodySchema = z
  .object({
    outcome: GrantMatchOutcomeSchema,
  })
  .strict();

/** Derive CRM verticals from grant categories (deduped). Falls back to rc911 if empty. */
export function verticalsFromGrantCategories(
  categories: readonly GrantCategory[],
): LeadVertical[] {
  const set = new Set<LeadVertical>();
  for (const c of categories) {
    set.add(GRANT_CATEGORY_TO_VERTICAL[c]);
  }
  if (set.size === 0) set.add("rc911");
  return [...set];
}

/**
 * True when a grant may be shown / matched for a lead vertical.
 * Unknown leads only match grants that include rc911 (default PSAP lane) — never bleed campus↔venue.
 */
export function grantVisibleToVertical(
  grantVerticals: readonly LeadVertical[],
  leadVertical: LeadVertical | undefined | null,
): boolean {
  const v = leadVertical && leadVertical !== "unknown" ? leadVertical : null;
  if (!v) {
    return grantVerticals.includes("rc911");
  }
  return grantVerticals.includes(v);
}

/** Filter signals to a single vertical — never return other verticals' signals. */
export function filterSignalsForVertical(
  signals: readonly LeadSignal[] | undefined,
  vertical: LeadVertical | undefined | null,
): LeadSignal[] {
  if (!signals?.length) return [];
  const v = vertical && vertical !== "unknown" ? vertical : null;
  if (!v) return signals.filter((s) => s.vertical === "rc911" || s.vertical === "unknown");
  return signals.filter((s) => s.vertical === v);
}

/** Hot-score weights by signal type (prompt 2). */
export const SIGNAL_HOT_WEIGHT: Record<LeadSignalType, number> = {
  GRANT_SIGNAL: 20,
  RFP_SIGNAL: 30,
  BUDGET_SIGNAL: 15,
  LEADERSHIP_CHANGE: 10,
  GRANT_AWARD: 25,
  HIRING_SIGNAL: 12,
  CONFERENCE_SIGNAL: 8,
  COMPETITOR_MENTION: 10,
  STALE_PIPELINE: -5,
};

export function computeHotScore(
  signals: readonly LeadSignal[],
  nowMs = Date.now(),
): number {
  const cutoff = nowMs - 30 * 24 * 60 * 60 * 1000;
  let score = 0;
  for (const s of signals) {
    const t = Date.parse(s.detectedAt);
    if (!Number.isFinite(t) || t < cutoff) continue;
    const base = SIGNAL_HOT_WEIGHT[s.type] ?? 0;
    const mult = s.strength === "strong" ? 1 : s.strength === "moderate" ? 0.7 : 0.4;
    score += base * mult;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
