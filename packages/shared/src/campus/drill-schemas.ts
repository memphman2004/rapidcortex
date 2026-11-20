import { z } from "zod";

/**
 * K-12 Safety Drill Scheduling & Compliance Schemas
 *
 * Tracks required safety drills (fire evacuation, lockdown, shelter-in-place, etc.)
 * per CISA and state fire/safety code requirements.
 *
 * Drill tracking is a state compliance requirement in most US states —
 * typically fire evacuation monthly (10/year), lockdown 2-3/year.
 * Districts must maintain documentation for state audit.
 */

export const CAMPUS_DRILL_TYPES = [
  "fire_evacuation",
  "lockdown",
  "shelter_in_place",
  "soft_lockout",
  "severe_weather",
  "bus_evacuation",
  "active_threat",
  "hazmat",
  "other",
] as const;

export type CampusDrillType = (typeof CAMPUS_DRILL_TYPES)[number];

export const CAMPUS_DRILL_STATUSES = ["scheduled", "completed", "cancelled"] as const;

export type CampusDrillStatus = (typeof CAMPUS_DRILL_STATUSES)[number];

/** Human-readable labels for drill types. */
export const CAMPUS_DRILL_TYPE_LABELS: Record<CampusDrillType, string> = {
  fire_evacuation: "Fire Evacuation",
  lockdown: "Lockdown",
  shelter_in_place: "Shelter-in-Place",
  soft_lockout: "Soft Lockout / Secure",
  severe_weather: "Severe Weather",
  bus_evacuation: "School Bus Evacuation",
  active_threat: "Active Threat Response",
  hazmat: "Hazmat / Chemical Spill",
  other: "Other",
};

/**
 * Typical state-mandated minimum drills per school year.
 * Districts may require more; this is a floor for compliance reporting.
 * Update annually as state laws change.
 */
export const CAMPUS_DRILL_ANNUAL_MINIMUMS: Partial<Record<CampusDrillType, number>> = {
  fire_evacuation: 10, // Most states: monthly or near-monthly
  lockdown: 2,
  shelter_in_place: 1,
  bus_evacuation: 1,
};

/** A single drill record. */
export const campusDrillRecordSchema = z
  .object({
    drillId: z.string().trim().min(1).max(64),
    agencyId: z.string().trim().min(1),
    siteId: z.string().trim().min(1).max(64),
    type: z.enum(CAMPUS_DRILL_TYPES),
    status: z.enum(CAMPUS_DRILL_STATUSES),
    /** School year in format "2026-27". */
    schoolYear: z.string().regex(/^\d{4}-\d{2}$/, "School year must be in format 2026-27"),
    scheduledAt: z.string().datetime().optional(),
    conductedAt: z.string().datetime().optional(),
    durationMinutes: z.number().int().min(1).max(240).optional(),
    participantCount: z.number().int().min(0).optional(),
    conductedBy: z.string().trim().min(1).max(120),
    /** Deficiencies or issues noted during the drill. */
    issues: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    createdBy: z.string().trim().min(1),
    updatedBy: z.string().trim().min(1),
  })
  .strict();

export type CampusDrillRecord = z.infer<typeof campusDrillRecordSchema>;

/** Body for logging a completed or scheduled drill. */
export const campusDrillCreateBodySchema = z
  .object({
    siteId: z.string().trim().min(1).max(64),
    type: z.enum(CAMPUS_DRILL_TYPES),
    status: z.enum(CAMPUS_DRILL_STATUSES).default("completed"),
    schoolYear: z.string().regex(/^\d{4}-\d{2}$/, "School year must be in format 2026-27"),
    scheduledAt: z.string().datetime().optional(),
    conductedAt: z.string().datetime().optional(),
    durationMinutes: z.number().int().min(1).max(240).optional(),
    participantCount: z.number().int().min(0).optional(),
    conductedBy: z.string().trim().min(1).max(120),
    issues: z.string().trim().max(2000).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine(
    (d) =>
      d.status !== "completed" || d.conductedAt != null,
    { message: "conductedAt is required when status is 'completed'" },
  );

export type CampusDrillCreateBody = z.infer<typeof campusDrillCreateBodySchema>;

/** Partial body for PATCH updates. */
export const campusDrillPatchBodySchema = campusDrillCreateBodySchema.omit({ siteId: true, schoolYear: true }).partial();

export type CampusDrillPatchBody = z.infer<typeof campusDrillPatchBodySchema>;

/** Query params for listing drills. */
export const campusDrillListQuerySchema = z.object({
  siteId: z.string().trim().min(1).max(64).optional(),
  schoolYear: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  type: z.enum(CAMPUS_DRILL_TYPES).optional(),
  status: z.enum(CAMPUS_DRILL_STATUSES).optional(),
});

export type CampusDrillListQuery = z.infer<typeof campusDrillListQuerySchema>;

/** Compliance summary for a school site in a school year. */
export interface CampusDrillComplianceSummary {
  siteId: string;
  schoolYear: string;
  byType: Record<
    CampusDrillType,
    {
      completed: number;
      scheduled: number;
      minimumRequired: number;
      isCompliant: boolean;
    }
  >;
  overallCompliant: boolean;
  totalCompleted: number;
}

/**
 * Compute compliance summary for a site's drills in a school year.
 */
export function computeDrillCompliance(
  drills: CampusDrillRecord[],
  siteId: string,
  schoolYear: string,
): CampusDrillComplianceSummary {
  const siteDrills = drills.filter(
    (d) => d.siteId === siteId && d.schoolYear === schoolYear,
  );

  const byType = {} as CampusDrillComplianceSummary["byType"];

  for (const type of CAMPUS_DRILL_TYPES) {
    const typeDrills = siteDrills.filter((d) => d.type === type);
    const completed = typeDrills.filter((d) => d.status === "completed").length;
    const scheduled = typeDrills.filter((d) => d.status === "scheduled").length;
    const minimumRequired = CAMPUS_DRILL_ANNUAL_MINIMUMS[type] ?? 0;
    byType[type] = {
      completed,
      scheduled,
      minimumRequired,
      isCompliant: completed >= minimumRequired,
    };
  }

  const requiredTypes = CAMPUS_DRILL_TYPES.filter(
    (t) => (CAMPUS_DRILL_ANNUAL_MINIMUMS[t] ?? 0) > 0,
  );
  const overallCompliant = requiredTypes.every((t) => byType[t].isCompliant);
  const totalCompleted = siteDrills.filter((d) => d.status === "completed").length;

  return { siteId, schoolYear, byType, overallCompliant, totalCompleted };
}

/** Derive current school year string (e.g. "2026-27") from a Date. */
export function getCurrentSchoolYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed
  // School year starts in August (month 8)
  if (month >= 8) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}
