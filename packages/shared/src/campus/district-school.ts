import { z } from "zod";

/**
 * One school within a K-12 district agency.
 * Distinct from multi-campus `CampusSite` (code/name) used for higher-ed site scope.
 */
export const CAMPUS_GRADE_LEVELS = ["hs", "ms", "es", "k8", "pk12"] as const;
export type CampusGradeLevel = (typeof CAMPUS_GRADE_LEVELS)[number];

export const CAMPUS_GRADE_LABELS: Record<CampusGradeLevel, string> = {
  hs: "High School",
  ms: "Middle School",
  es: "Elementary School",
  k8: "K-8 School",
  pk12: "PK-12 School",
};

export const CAMPUS_ALERT_STATUSES = ["clear", "active", "elevated", "lockdown"] as const;
export type CampusAlertStatus = (typeof CAMPUS_ALERT_STATUSES)[number];

export const campusGradeLevelSchema = z.enum(CAMPUS_GRADE_LEVELS);
export const campusAlertStatusSchema = z.enum(CAMPUS_ALERT_STATUSES);

export const campusDistrictSchoolSchema = z.object({
  siteId: z.string().trim().min(1).max(64),
  agencyId: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(200),
  shortName: z.string().trim().max(16).optional(),
  gradeLevel: campusGradeLevelSchema,
  address: z.string().trim().max(300).optional(),
  active: z.boolean(),
  alertStatus: campusAlertStatusSchema,
  activeIncidentCount: z.number().int().min(0),
  respondersOnDuty: z.number().int().min(0),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type CampusDistrictSchool = z.infer<typeof campusDistrictSchoolSchema>;

/** @deprecated Prefer CampusDistrictSchool — prompt alias for district school records. */
export type CampusSchoolSite = CampusDistrictSchool;
