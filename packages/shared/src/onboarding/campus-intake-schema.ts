import { z } from "zod";

export const campusAnonymousReportingPolicySchema = z.enum(["allow", "require", "disallow"]);
export const campusAcademicCalendarTypeSchema = z.enum(["semester", "quarter", "trimester"]);
export const campusNfcTagsNeededSchema = z.enum(["yes", "no", "unknown"]);
export const campusSignInstallerSchema = z.enum(["facilities", "vendor", "rc"]);
export const campusStudentCommsChannelSchema = z.enum([
  "email",
  "posted_notices",
  "student_app",
  "other",
]);
export const campusDataRetentionPreferenceSchema = z.enum(["1yr", "3yr", "7yr"]);

export const campusIntakeSchema = z
  .object({
    orgName: z.string().trim().min(1).max(200),
    legalName: z.string().trim().min(1).max(200),
    state: z.string().trim().min(2).max(2),
    primaryDomain: z.string().trim().min(1).max(253),
    studentPopulation: z.number().int().min(0).max(5_000_000),
    securityDepartmentName: z.string().trim().min(1).max(200),
    dispatchNumber24x7: z.string().trim().min(7).max(32),
    securityDirectorName: z.string().trim().min(1).max(120),
    securityDirectorEmail: z.string().trim().email().max(254),
    titleIxCleryContactName: z.string().trim().min(1).max(120),
    titleIxCleryContactEmail: z.string().trim().email().max(254),
    existingReportingTools: z.string().trim().max(4000),
    anonymousReportingPolicy: campusAnonymousReportingPolicySchema,
    preferredSmsKeyword: z.string().trim().min(2).max(16).regex(/^[A-Za-z0-9]+$/),
    academicCalendarType: campusAcademicCalendarTypeSchema,
    estimatedSignLocations: z.number().int().min(0).max(100_000),
    nfcTagsNeeded: campusNfcTagsNeededSchema,
    signInstaller: campusSignInstallerSchema,
    studentCommsChannel: campusStudentCommsChannelSchema,
    studentCommsChannelOther: z.string().trim().max(500).optional(),
    dataRetentionPreference: campusDataRetentionPreferenceSchema,
    notes: z.string().trim().max(8000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.studentCommsChannel === "other" && !value.studentCommsChannelOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the other communication channel",
        path: ["studentCommsChannelOther"],
      });
    }
  });

export type CampusIntake = z.infer<typeof campusIntakeSchema>;

export type CampusIntakeRecord = CampusIntake & {
  orgCode: string;
  agencyId: string;
  submittedAt: string;
  submittedBy?: string;
  updatedAt: string;
};
