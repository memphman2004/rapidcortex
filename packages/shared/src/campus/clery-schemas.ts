import { z } from "zod";

/** Clery crime / arrest / VAWA categories used for ASR tallies. */
export const CLERY_CATEGORIES = [
  "Criminal Homicide - Murder/Non-negligent Manslaughter",
  "Criminal Homicide - Manslaughter by Negligence",
  "Sexual Assault - Rape",
  "Sexual Assault - Fondling",
  "Sexual Assault - Incest",
  "Sexual Assault - Statutory Rape",
  "Robbery",
  "Aggravated Assault",
  "Burglary",
  "Motor Vehicle Theft",
  "Arson",
  "VAWA - Domestic Violence",
  "VAWA - Dating Violence",
  "VAWA - Stalking",
  "Hate Crime",
  "Arrests - Weapons Violations",
  "Arrests - Drug Abuse Violations",
  "Arrests - Liquor Law Violations",
  "Hazing",
] as const;

export type CleryCategory = (typeof CLERY_CATEGORIES)[number];

export const cleryCategorySchema = z.enum(CLERY_CATEGORIES);

/** Clery geography classifications for ASR statistics. */
export const CLERY_GEOGRAPHIES = [
  "on_campus",
  "on_campus_residential",
  "noncampus",
  "public_property",
] as const;

export type CleryGeography = (typeof CLERY_GEOGRAPHIES)[number];

export const cleryGeographySchema = z.enum(CLERY_GEOGRAPHIES);

export const CLERY_GEOGRAPHY_LABELS: Record<CleryGeography, string> = {
  on_campus: "On Campus",
  on_campus_residential: "On-Campus Student Housing",
  noncampus: "Noncampus",
  public_property: "Public Property",
};

export const cleryEntrySourceSchema = z.enum([
  "platform_incident",
  "manual",
  "import",
  "external_sync",
]);

export type CleryEntrySource = z.infer<typeof cleryEntrySourceSchema>;

/** Academic year string like 2025-2026 (Clery calendar typically Aug 1–Jul 31). */
export const cleryAcademicYearSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/, "academicYear must be YYYY-YYYY")
  .refine((v) => {
    const [a, b] = v.split("-").map(Number);
    return b === a + 1;
  }, "academicYear end must be start + 1");

const isoDateTimeSchema = z
  .string()
  .min(10)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const cleryEntryCreateSchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    academicYear: cleryAcademicYearSchema,
    category: cleryCategorySchema,
    geography: cleryGeographySchema,
    occurredAt: isoDateTimeSchema,
    location: z.string().trim().max(500).optional().default(""),
    building: z.string().trim().max(200).optional().default(""),
    notes: z.string().trim().max(4000).optional().default(""),
    hateCrimeBias: z.string().trim().max(200).optional().nullable(),
    unfounded: z.boolean().optional().default(false),
    includedInAsr: z.boolean().optional().default(true),
    externalSourceSystem: z.string().trim().max(100).optional().nullable(),
    externalRecordId: z.string().trim().max(200).optional().nullable(),
    platformIncidentId: z.string().trim().max(100).optional().nullable(),
  })
  .strict();

export type CleryEntryCreateInput = z.infer<typeof cleryEntryCreateSchema>;

export const cleryEntryUpdateSchema = z
  .object({
    category: cleryCategorySchema.optional(),
    geography: cleryGeographySchema.optional(),
    occurredAt: isoDateTimeSchema.optional(),
    location: z.string().trim().max(500).optional(),
    building: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(4000).optional(),
    hateCrimeBias: z.string().trim().max(200).nullable().optional(),
    unfounded: z.boolean().optional(),
    includedInAsr: z.boolean().optional(),
    reviewed: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field required" });

export type CleryEntryUpdateInput = z.infer<typeof cleryEntryUpdateSchema>;

export const cleryImportRowSchema = z
  .object({
    occurredAt: isoDateTimeSchema,
    category: cleryCategorySchema,
    geography: cleryGeographySchema.optional().default("on_campus"),
    location: z.string().trim().max(500).optional().default(""),
    building: z.string().trim().max(200).optional().default(""),
    notes: z.string().trim().max(4000).optional().default(""),
    hateCrimeBias: z.string().trim().max(200).optional().nullable(),
    unfounded: z.boolean().optional().default(false),
    includedInAsr: z.boolean().optional().default(true),
    externalRecordId: z.string().trim().max(200).optional().nullable(),
  })
  .strict();

export type CleryImportRow = z.infer<typeof cleryImportRowSchema>;

export const cleryImportBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    academicYear: cleryAcademicYearSchema,
    sourceSystem: z.string().trim().min(1).max(100),
    /** When true, skip rows whose externalRecordId already exists for this campus/year. */
    skipDuplicates: z.boolean().optional().default(true),
    rows: z.array(cleryImportRowSchema).min(1).max(2000),
  })
  .strict();

export type CleryImportBody = z.infer<typeof cleryImportBodySchema>;

export const cleryExternalSyncBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    academicYear: cleryAcademicYearSchema,
    /**
     * Connector id for another campus system (e.g. maxient, report_exec).
     * Use `mock` with ENABLE_CAMPUS_CLERY_EXTERNAL_MOCK for dry-run rows.
     */
    sourceSystem: z.string().trim().min(1).max(100),
    skipDuplicates: z.boolean().optional().default(true),
  })
  .strict();

export type CleryExternalSyncBody = z.infer<typeof cleryExternalSyncBodySchema>;

export const clerySyncFromPlatformBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    academicYear: cleryAcademicYearSchema,
    /** Default geography when platform incident has no Clery geography yet. */
    defaultGeography: cleryGeographySchema.optional().default("on_campus"),
  })
  .strict();

export type ClerySyncFromPlatformBody = z.infer<typeof clerySyncFromPlatformBodySchema>;

export const cleryReportQuerySchema = z.object({
  campusCode: z.string().trim().min(2).max(32),
  academicYear: cleryAcademicYearSchema,
  format: z.enum(["json", "csv"]).optional().default("json"),
});

export type CleryReportQuery = z.infer<typeof cleryReportQuerySchema>;

export interface CleryEntry {
  entryId: string;
  agencyId: string;
  campusCode: string;
  academicYear: string;
  category: CleryCategory;
  geography: CleryGeography;
  occurredAt: string;
  location: string;
  building: string;
  notes: string;
  hateCrimeBias: string | null;
  unfounded: boolean;
  includedInAsr: boolean;
  source: CleryEntrySource;
  externalSourceSystem: string | null;
  externalRecordId: string | null;
  platformIncidentId: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CleryAsrCell = {
  category: CleryCategory;
  geography: CleryGeography;
  count: number;
  unfounded: number;
};

export type CleryReport = {
  campusCode: string;
  academicYear: string;
  generatedAt: string;
  disclaimer: string;
  period: { start: string; end: string };
  totals: {
    entries: number;
    includedInAsr: number;
    unfounded: number;
    bySource: Record<CleryEntrySource, number>;
  };
  matrix: CleryAsrCell[];
  entries: CleryEntry[];
};
