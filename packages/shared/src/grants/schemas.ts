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

const budgetLineSchema = z.object({
  item: z.string(),
  quantity: z.number(),
  unitCost: z.number(),
  totalCost: z.number(),
  category: z.string(),
});

const timelinePhaseSchema = z.object({
  phase: z.string(),
  period: z.string(),
  milestones: z.array(z.string()),
});

const grantOutcomeSchema = z.object({
  metric: z.string(),
  baseline: z.string(),
  target: z.string(),
  timeframe: z.string(),
});

/** AI-generated grant package returned by /api/platform/grant-generate. */
export const grantPackageSchema = z.object({
  executiveSummary: z.string(),
  problemStatement: z.string(),
  projectNarrative: z.string(),
  technologyDescription: z.string(),
  budget: z.array(budgetLineSchema),
  totalBudget: z.number(),
  budgetJustification: z.string(),
  timeline: z.array(timelinePhaseSchema),
  cybersecurity: z.string(),
  sustainability: z.string(),
  evaluation: z.string(),
  outcomes: z.array(grantOutcomeSchema),
});
export type GrantPackage = z.infer<typeof grantPackageSchema>;
export type GrantBudgetLine = z.infer<typeof budgetLineSchema>;
export type GrantTimelinePhase = z.infer<typeof timelinePhaseSchema>;
export type GrantOutcome = z.infer<typeof grantOutcomeSchema>;
