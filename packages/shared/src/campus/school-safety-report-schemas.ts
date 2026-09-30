import { z } from "zod";

/** One typed row in the K-12 School Safety period report (PDF / CSV). */
export const schoolSafetyReportRowSchema = z
  .object({
    groupLabel: z.string().trim().min(1).max(120),
    typeValue: z.string().trim().min(1).max(64),
    typeLabel: z.string().trim().min(1).max(120),
    severity: z.string().trim().min(1).max(40),
    requiresEscalation: z.boolean(),
    count: z.number().int().min(0).max(1_000_000),
  })
  .strict();

export const schoolSafetyReportPdfBodySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    siteCode: z.string().trim().max(20).optional(),
    schoolName: z.string().trim().min(1).max(200),
    schoolShortName: z.string().trim().max(80).optional(),
    gradeLevel: z.string().trim().max(40).optional(),
    addressLine: z.string().trim().max(400).optional(),
    districtName: z.string().trim().max(200).optional(),
    campusCode: z.string().trim().min(2).max(20),
    /** Optional narrative / notes filled by the operator. */
    notes: z.string().trim().max(4000).optional(),
    preparedBy: z.string().trim().max(120).optional(),
    total: z.number().int().min(0).max(1_000_000),
    rows: z.array(schoolSafetyReportRowSchema).max(200),
    /** Live platform snapshot at generation (optional). */
    snapshot: z
      .object({
        activeIncidents: z.number().int().min(0).optional(),
        respondersOnDuty: z.number().int().min(0).optional(),
        buildingsMonitored: z.number().int().min(0).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type SchoolSafetyReportPdfBody = z.infer<typeof schoolSafetyReportPdfBodySchema>;
export type SchoolSafetyReportRow = z.infer<typeof schoolSafetyReportRowSchema>;
