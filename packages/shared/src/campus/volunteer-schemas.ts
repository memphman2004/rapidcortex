import { z } from "zod";

/**
 * K-12 Volunteer & Contractor Management schemas.
 *
 * Volunteers are recurring visitors (parent chaperones, coaches, tutors, contractors)
 * who require background check clearance before working with students.
 *
 * IMPORTANT: NexCort iQ tracks background check STATUS as reported by the district
 * HR system or state DOJ. It does NOT conduct background checks. Never deny access
 * automatically based solely on this status — a human safety officer makes all
 * access decisions.
 */

export const CAMPUS_VOLUNTEER_ROLES = [
  "parent_volunteer",
  "coach",
  "tutor",
  "contractor",
  "vendor",
  "field_trip_chaperone",
  "mentor",
  "other",
] as const;

export type CampusVolunteerRole = (typeof CAMPUS_VOLUNTEER_ROLES)[number];

export const CAMPUS_BG_CHECK_STATUSES = [
  "pending",
  "cleared",
  "flagged",
  "expired",
  "not_required",
] as const;

export type CampusBgCheckStatus = (typeof CAMPUS_BG_CHECK_STATUSES)[number];

export const CAMPUS_NSOPW_STATUSES = [
  "cleared",
  "flagged",
  "review_required",
  "not_checked",
] as const;

export type CampusNsopwStatus = (typeof CAMPUS_NSOPW_STATUSES)[number];

/** Full volunteer record stored in DynamoDB. */
export const campusVolunteerRecordSchema = z
  .object({
    agencyId: z.string().trim().min(1),
    volunteerId: z.string().trim().min(1).max(64),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(32).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    role: z.enum(CAMPUS_VOLUNTEER_ROLES),
    /** Site codes this volunteer is allowed to access. Empty array = all sites. */
    allowedSites: z.array(z.string().trim().min(1).max(32)).default([]),
    // Background check status (tracked by district; NexCort iQ does not conduct checks)
    bgCheckStatus: z.enum(CAMPUS_BG_CHECK_STATUSES).default("not_required"),
    bgCheckExpiresAt: z.string().datetime().optional(),
    /** e.g. "district_hr", "doj_live_scan", "checkr", "idemia" */
    bgCheckProvider: z.string().trim().max(80).optional(),
    bgCheckUpdatedAt: z.string().datetime().optional(),
    bgCheckUpdatedBy: z.string().trim().max(120).optional(),
    // NSOPW screening (run by NexCort iQ on creation and on-demand re-check)
    nsopwStatus: z.enum(CAMPUS_NSOPW_STATUSES).default("not_checked"),
    nsopwCheckedAt: z.string().datetime().optional(),
    /** Raw NSOPW match count — advisory only; never used for automatic denial. */
    nsopwMatchCount: z.number().int().min(0).optional(),
    notes: z.string().trim().max(2000).optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    archivedAt: z.string().datetime().optional(),
    createdBy: z.string().trim().min(1),
    updatedBy: z.string().trim().min(1),
  })
  .strict();

export type CampusVolunteerRecord = z.infer<typeof campusVolunteerRecordSchema>;

/** Body for creating or updating a volunteer. */
export const campusVolunteerUpsertBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(32).optional(),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    role: z.enum(CAMPUS_VOLUNTEER_ROLES),
    allowedSites: z.array(z.string().trim().min(1).max(32)).default([]),
    bgCheckStatus: z.enum(CAMPUS_BG_CHECK_STATUSES).optional(),
    bgCheckExpiresAt: z.string().datetime().optional(),
    bgCheckProvider: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type CampusVolunteerUpsertBody = z.infer<typeof campusVolunteerUpsertBodySchema>;

/** Partial body for PATCH updates — all fields optional. */
export const campusVolunteerPatchBodySchema = campusVolunteerUpsertBodySchema
  .partial()
  .extend({
    archivedAt: z.string().datetime().optional(),
  });

export type CampusVolunteerPatchBody = z.infer<typeof campusVolunteerPatchBodySchema>;

/** Query params for listing volunteers. */
export const campusVolunteerListQuerySchema = z.object({
  bgCheckStatus: z.enum(CAMPUS_BG_CHECK_STATUSES).optional(),
  role: z.enum(CAMPUS_VOLUNTEER_ROLES).optional(),
  includeArchived: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type CampusVolunteerListQuery = z.infer<typeof campusVolunteerListQuerySchema>;

/** Summary row for list responses (excludes notes). */
export type CampusVolunteerSummary = Pick<
  CampusVolunteerRecord,
  | "volunteerId"
  | "agencyId"
  | "firstName"
  | "lastName"
  | "role"
  | "bgCheckStatus"
  | "bgCheckExpiresAt"
  | "nsopwStatus"
  | "nsopwCheckedAt"
  | "allowedSites"
  | "createdAt"
  | "updatedAt"
  | "archivedAt"
>;

/**
 * Derive an effective volunteer access status combining bg check + NSOPW.
 * Returns advisory status only — never the final access decision.
 */
export function getVolunteerAccessAdvisory(
  record: Pick<CampusVolunteerRecord, "bgCheckStatus" | "nsopwStatus" | "bgCheckExpiresAt">,
): "cleared" | "flagged" | "pending" | "expired" | "unknown" {
  if (record.nsopwStatus === "flagged") return "flagged";
  if (record.bgCheckStatus === "flagged") return "flagged";
  if (record.bgCheckStatus === "expired") return "expired";
  if (
    record.bgCheckExpiresAt &&
    new Date(record.bgCheckExpiresAt) < new Date()
  ) {
    return "expired";
  }
  if (record.bgCheckStatus === "pending") return "pending";
  if (
    record.bgCheckStatus === "cleared" &&
    (record.nsopwStatus === "cleared" || record.nsopwStatus === "not_checked")
  ) {
    return "cleared";
  }
  if (record.bgCheckStatus === "not_required" && record.nsopwStatus === "cleared") {
    return "cleared";
  }
  return "unknown";
}
