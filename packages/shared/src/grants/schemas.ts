import { z } from "zod";

export const GRANT_PROGRAM_IDS = [
  "cops_svpp",
  "bja_stop",
  "state",
  "homeland",
  "fema_bric",
  "other",
] as const;
export type GrantProgramId = (typeof GRANT_PROGRAM_IDS)[number];

export const GRANT_PROGRAM_LABELS: Record<GrantProgramId, string> = {
  cops_svpp: "COPS School Violence Prevention Program (SVPP)",
  bja_stop: "BJA STOP School Violence Program",
  state: "State school safety grant",
  homeland: "Homeland Security Grant Program (HSGP)",
  fema_bric: "FEMA BRIC / Hazard Mitigation Grant",
  other: "Other / to be determined",
};

export const GRANT_SCHOOL_TYPE_IDS = [
  "university",
  "community_college",
  "k12",
  "school_district",
  "private_school",
  "technical_college",
  "city",
  "state",
  "county",
] as const;
export type GrantSchoolTypeId = (typeof GRANT_SCHOOL_TYPE_IDS)[number];

export const GRANT_SCHOOL_TYPE_LABELS: Record<GrantSchoolTypeId, string> = {
  university: "University / 4-year institution",
  community_college: "Community college",
  k12: "K–12 school",
  school_district: "School district",
  private_school: "Private school",
  technical_college: "Technical / trade college",
  city: "City",
  state: "State",
  county: "County",
};

/** Grant Success Program — campus/school safety profile intake (Platform Ops → Grants). */
export const grantSuccessProfileSchema = z
  .object({
    schoolName: z.string().trim().min(1).max(200),
    schoolType: z.enum(GRANT_SCHOOL_TYPE_IDS),
    city: z.string().trim().min(1).max(120),
    state: z.string().trim().min(1).max(60),
    studentPopulation: z.string().trim().min(1).max(20),
    campusCount: z.string().trim().max(10).default("1"),
    buildingCount: z.string().trim().max(10).optional().default(""),
    residenceHalls: z.string().trim().max(10).optional().default("0"),
    campusPolice: z.enum(["yes", "contract", "no"]).default("yes"),
    officerCount: z.string().trim().max(10).optional().default(""),
    existingENS: z.string().trim().max(200).optional().default(""),
    blueLight: z.enum(["yes", "no"]).default("yes"),
    blueLightCount: z.string().trim().max(10).optional().default(""),
    accessControl: z.enum(["yes", "partial", "no"]).default("yes"),
    cameraCount: z.string().trim().max(10).optional().default(""),
    cadSystem: z.enum(["yes", "no"]).default("no"),
    reportingProcess: z.string().trim().max(300).optional().default(""),
    mutualAid: z.string().trim().max(300).optional().default(""),
    safetyConcerns: z.string().trim().max(4000).optional().default(""),
    grantPrograms: z.array(z.enum(GRANT_PROGRAM_IDS)).min(1),
    grantAmount: z.string().trim().max(20).optional().default(""),
    projectPeriod: z.enum(["12", "18", "24", "36"]).default("12"),
    additionalContext: z.string().trim().max(4000).optional().default(""),
  })
  .strict();
export type GrantSuccessProfile = z.infer<typeof grantSuccessProfileSchema>;

/** POST /api/platform/grant-generate body. */
export const generateGrantPackageRequestSchema = z
  .object({
    form: grantSuccessProfileSchema,
  })
  .strict();
export type GenerateGrantPackageRequest = z.infer<typeof generateGrantPackageRequestSchema>;

/** Models often emit numeric fields as strings — coerce before reject. */
const moneyNumber = z.coerce.number().finite();

const budgetLineSchema = z.object({
  item: z.string().min(1),
  quantity: moneyNumber,
  unitCost: moneyNumber,
  totalCost: moneyNumber,
  category: z.string().min(1),
});

const timelinePhaseSchema = z.object({
  phase: z.string().min(1),
  period: z.string().min(1),
  milestones: z
    .array(z.union([z.string(), z.number()]).transform((v) => String(v)))
    .default([]),
});

const grantOutcomeSchema = z.object({
  metric: z.string().min(1),
  baseline: z.string().min(1),
  target: z.string().min(1),
  timeframe: z.string().min(1),
});

/** AI-generated grant package returned by /api/platform/grant-generate. */
export const grantPackageSchema = z.object({
  executiveSummary: z.string().min(1),
  problemStatement: z.string().min(1),
  projectNarrative: z.string().min(1),
  technologyDescription: z.string().min(1),
  budget: z.array(budgetLineSchema).min(1),
  totalBudget: moneyNumber,
  budgetJustification: z.string().min(1),
  timeline: z.array(timelinePhaseSchema).min(1),
  cybersecurity: z.string().min(1),
  sustainability: z.string().min(1),
  evaluation: z.string().min(1),
  outcomes: z.array(grantOutcomeSchema).min(1),
});
export type GrantPackage = z.infer<typeof grantPackageSchema>;
export type GrantBudgetLine = z.infer<typeof budgetLineSchema>;
export type GrantTimelinePhase = z.infer<typeof timelinePhaseSchema>;
export type GrantOutcome = z.infer<typeof grantOutcomeSchema>;

/**
 * Normalize common LLM shape drift before Zod (extra keys, stringified arrays, nulls).
 */
export function normalizeGrantPackageCandidate(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };

  const asText = (v: unknown): string => {
    if (typeof v === "string") return v.trim();
    if (v == null) return "";
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return JSON.stringify(v);
  };

  for (const key of [
    "executiveSummary",
    "problemStatement",
    "projectNarrative",
    "technologyDescription",
    "budgetJustification",
    "cybersecurity",
    "sustainability",
    "evaluation",
  ] as const) {
    if (key in o) o[key] = asText(o[key]);
  }

  if (Array.isArray(o.budget)) {
    o.budget = o.budget.map((line) => {
      if (!line || typeof line !== "object") return line;
      const row = { ...(line as Record<string, unknown>) };
      if (row.item != null) row.item = asText(row.item);
      if (row.category != null) row.category = asText(row.category);
      return row;
    });
  }

  if (Array.isArray(o.timeline)) {
    o.timeline = o.timeline.map((phase) => {
      if (!phase || typeof phase !== "object") return phase;
      const row = { ...(phase as Record<string, unknown>) };
      if (row.phase != null) row.phase = asText(row.phase);
      if (row.period != null) row.period = asText(row.period);
      if (typeof row.milestones === "string") {
        row.milestones = row.milestones
          .split(/\n|;|•/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return row;
    });
  }

  if (Array.isArray(o.outcomes)) {
    o.outcomes = o.outcomes.map((out) => {
      if (!out || typeof out !== "object") return out;
      const row = { ...(out as Record<string, unknown>) };
      for (const k of ["metric", "baseline", "target", "timeframe"] as const) {
        if (k in row) row[k] = asText(row[k]);
      }
      return row;
    });
  }

  return o;
}
