import { z } from "zod";

/**
 * Statutory Clery geographic categories (20 U.S.C. § 1092(f) · 34 CFR 668.46).
 * Independent of QRLocation / zone registry. Named CleryActGeography so it does not
 * collide with the existing ASR-tally `CleryGeography` (`on_campus` snake_case).
 */
export const CLERY_ACT_GEOGRAPHIES = [
  "ON_CAMPUS",
  "ON_CAMPUS_RESIDENTIAL",
  "NON_CAMPUS",
  "PUBLIC_PROPERTY",
  "NOT_CLERY_REPORTABLE",
] as const;

export type CleryActGeography = (typeof CLERY_ACT_GEOGRAPHIES)[number];
export const cleryActGeographySchema = z.enum(CLERY_ACT_GEOGRAPHIES);

export const CLERY_ACT_GEOGRAPHY_LABELS: Record<CleryActGeography, string> = {
  ON_CAMPUS: "On Campus",
  ON_CAMPUS_RESIDENTIAL: "On-Campus Student Housing",
  NON_CAMPUS: "Non-Campus",
  PUBLIC_PROPERTY: "Public Property",
  NOT_CLERY_REPORTABLE: "Not Clery-reportable",
};

/** 20 U.S.C. § 1092(f)(1)(F) — exact statutory categories used in classification JSON. */
export const CLERY_OFFENSE_CATEGORIES = [
  "MURDER_NON_NEG_MANSLAUGHTER",
  "NEG_MANSLAUGHTER",
  "RAPE",
  "FONDLING",
  "INCEST",
  "STATUTORY_RAPE",
  "ROBBERY",
  "AGGRAVATED_ASSAULT",
  "BURGLARY",
  "MOTOR_VEHICLE_THEFT",
  "ARSON",
  "DATING_VIOLENCE",
  "DOMESTIC_VIOLENCE",
  "STALKING",
  "ARREST_LIQUOR_LAW",
  "ARREST_DRUG_LAW",
  "ARREST_WEAPONS",
  "REFERRAL_LIQUOR_LAW",
  "REFERRAL_DRUG_LAW",
  "REFERRAL_WEAPONS",
  "SIMPLE_ASSAULT",
  "LARCENY_THEFT",
  "INTIMIDATION",
  "DESTRUCTION_VANDALISM",
  "NOT_CLERY_REPORTABLE",
] as const;

export type CleryOffenseCategory = (typeof CLERY_OFFENSE_CATEGORIES)[number];
export const cleryOffenseCategorySchema = z.enum(CLERY_OFFENSE_CATEGORIES);

export const CLERY_OFFENSE_DISPLAY_NAMES: Record<CleryOffenseCategory, string> = {
  MURDER_NON_NEG_MANSLAUGHTER: "Murder / Non-negligent Manslaughter",
  NEG_MANSLAUGHTER: "Negligent Manslaughter",
  RAPE: "Rape",
  FONDLING: "Fondling",
  INCEST: "Incest",
  STATUTORY_RAPE: "Statutory Rape",
  ROBBERY: "Robbery",
  AGGRAVATED_ASSAULT: "Aggravated Assault",
  BURGLARY: "Burglary",
  MOTOR_VEHICLE_THEFT: "Motor Vehicle Theft",
  ARSON: "Arson",
  DATING_VIOLENCE: "Dating Violence",
  DOMESTIC_VIOLENCE: "Domestic Violence",
  STALKING: "Stalking",
  ARREST_LIQUOR_LAW: "Arrest — Liquor Law Violation",
  ARREST_DRUG_LAW: "Arrest — Drug Law Violation",
  ARREST_WEAPONS: "Arrest — Weapons Violation",
  REFERRAL_LIQUOR_LAW: "Disciplinary Referral — Liquor Law",
  REFERRAL_DRUG_LAW: "Disciplinary Referral — Drug Law",
  REFERRAL_WEAPONS: "Disciplinary Referral — Weapons",
  SIMPLE_ASSAULT: "Simple Assault (hate crime only)",
  LARCENY_THEFT: "Larceny-Theft (hate crime only)",
  INTIMIDATION: "Intimidation (hate crime only)",
  DESTRUCTION_VANDALISM: "Destruction / Vandalism (hate crime only)",
  NOT_CLERY_REPORTABLE: "Not Clery-reportable",
};

export const SEX_OFFENSE_CATEGORIES: readonly CleryOffenseCategory[] = [
  "RAPE",
  "FONDLING",
  "INCEST",
  "STATUTORY_RAPE",
];

export const TIMELY_WARNING_HIGH_CATEGORIES: readonly CleryOffenseCategory[] = [
  "RAPE",
  "ROBBERY",
  "AGGRAVATED_ASSAULT",
  "ARSON",
  "BURGLARY",
];

export const CRIMINAL_OFFENSE_CATEGORIES: readonly CleryOffenseCategory[] = [
  "MURDER_NON_NEG_MANSLAUGHTER",
  "NEG_MANSLAUGHTER",
  "RAPE",
  "FONDLING",
  "INCEST",
  "STATUTORY_RAPE",
  "ROBBERY",
  "AGGRAVATED_ASSAULT",
  "BURGLARY",
  "MOTOR_VEHICLE_THEFT",
  "ARSON",
];

export const VAWA_OFFENSE_CATEGORIES: readonly CleryOffenseCategory[] = [
  "DATING_VIOLENCE",
  "DOMESTIC_VIOLENCE",
  "STALKING",
];

export const HATE_CRIME_ONLY_CATEGORIES: readonly CleryOffenseCategory[] = [
  "SIMPLE_ASSAULT",
  "LARCENY_THEFT",
  "INTIMIDATION",
  "DESTRUCTION_VANDALISM",
];

export const HATE_CRIME_BIASES = [
  "RACE",
  "RELIGION",
  "SEXUAL_ORIENTATION",
  "GENDER",
  "GENDER_IDENTITY",
  "ETHNICITY_NATIONAL_ORIGIN",
  "DISABILITY",
] as const;

export type HateCrimeBias = (typeof HATE_CRIME_BIASES)[number];
export const hateCrimeBiasSchema = z.enum(HATE_CRIME_BIASES);

export const DRUG_LAW_VIOLATION_TYPES = ["MARIJUANA", "OTHER_CONTROLLED_SUBSTANCE"] as const;
export type DrugLawViolationType = (typeof DRUG_LAW_VIOLATION_TYPES)[number];
export const drugLawViolationTypeSchema = z.enum(DRUG_LAW_VIOLATION_TYPES);

export const VAWA_OFFENSE_TYPES = ["DATING_VIOLENCE", "DOMESTIC_VIOLENCE", "STALKING"] as const;
export type VAWAOffenseType = (typeof VAWA_OFFENSE_TYPES)[number];
export const vawaOffenseTypeSchema = z.enum(VAWA_OFFENSE_TYPES);

export const CLERY_RECORD_STATUSES = [
  "PENDING_REVIEW",
  "CLASSIFIED",
  "UNFOUNDED",
  "EXCLUDED",
  "PENDING_INFORMATION",
] as const;

export type CleryRecordStatus = (typeof CLERY_RECORD_STATUSES)[number];
export const cleryRecordStatusSchema = z.enum(CLERY_RECORD_STATUSES);

export const CLERY_ENFORCEMENT_ACTIONS = ["ARREST", "DISCIPLINARY_REFERRAL", "NONE"] as const;
export type CleryEnforcementAction = (typeof CLERY_ENFORCEMENT_ACTIONS)[number];
export const cleryEnforcementActionSchema = z.enum(CLERY_ENFORCEMENT_ACTIONS);

export const CSA_REPORTER_TYPES = [
  "SWORN_OFFICER",
  "CAMPUS_SECURITY_STAFF",
  "DESIGNATED_OFFICIAL",
  "VOLUNTARY_CONFIDENTIAL",
] as const;

export type CSAReporterType = (typeof CSA_REPORTER_TYPES)[number];
export const csaReporterTypeSchema = z.enum(CSA_REPORTER_TYPES);

export const CLERY_ASR_STATUSES = ["DRAFT", "REVIEW", "PUBLISHED"] as const;
export type CleryAsrStatus = (typeof CLERY_ASR_STATUSES)[number];
export const cleryAsrStatusSchema = z.enum(CLERY_ASR_STATUSES);

export const CLERY_DCL_DISPOSITIONS = [
  "Open — Investigation Ongoing",
  "Closed",
  "Referred for Prosecution",
  "Referred for Disciplinary Action",
  "No Charges",
  "Unfounded",
] as const;

export type CleryDclDisposition = (typeof CLERY_DCL_DISPOSITIONS)[number];
export const cleryDclDispositionSchema = z.enum(CLERY_DCL_DISPOSITIONS);

const isoDateTimeSchema = z
  .string()
  .min(10)
  .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

export const cleryClassificationHistoryEntrySchema = z.object({
  version: z.number().int().positive(),
  previousOffense: cleryOffenseCategorySchema.optional(),
  newOffense: cleryOffenseCategorySchema,
  changedBy: z.string().min(1),
  changedAt: isoDateTimeSchema,
  reason: z.string().max(4000).optional(),
});

export type CleryClassificationHistoryEntry = z.infer<typeof cleryClassificationHistoryEntrySchema>;

export const cleryRecordSchema = z.object({
  recordId: z.string().min(1),
  agencyId: z.string().min(1),
  incidentId: z.string().min(1),
  campusCode: z.string().min(1),
  organizationId: z.string().optional(),
  primaryOffense: cleryOffenseCategorySchema,
  secondaryOffenses: z.array(cleryOffenseCategorySchema).default([]),
  isHateCrime: z.boolean(),
  hateCrimeBiasCategories: z.array(hateCrimeBiasSchema).default([]),
  isVAWAOffense: z.boolean(),
  vawaOffenseType: vawaOffenseTypeSchema.optional(),
  enforcementAction: cleryEnforcementActionSchema,
  drugViolationType: drugLawViolationTypeSchema.optional(),
  cleryGeography: cleryActGeographySchema,
  isResidentialFacility: z.boolean(),
  cleryZoneRcli: z.string().optional(),
  generalLocationDescription: z.string().min(1).max(240),
  reportedToInstitutionAt: isoDateTimeSchema,
  occurredAt: isoDateTimeSchema.optional(),
  occurredAtApproximate: z.boolean(),
  occurredAtRangeStart: isoDateTimeSchema.optional(),
  occurredAtRangeEnd: isoDateTimeSchema.optional(),
  reportingCalendarYear: z.number().int().min(2000).max(2100),
  status: cleryRecordStatusSchema,
  unfoundedBy: z.string().optional(),
  unfoundedByBadgeNumber: z.string().optional(),
  unfoundedAt: isoDateTimeSchema.optional(),
  unfoundedReason: z.string().max(4000).optional(),
  classifiedBy: z.string().optional(),
  classifiedAt: isoDateTimeSchema.optional(),
  classificationNotes: z.string().max(4000).optional(),
  classificationVersion: z.number().int().min(0),
  classificationHistory: z.array(cleryClassificationHistoryEntrySchema).default([]),
  aiSuggestedOffense: cleryOffenseCategorySchema.optional(),
  aiSuggestedGeography: cleryActGeographySchema.optional(),
  aiSuggestionConfidence: z.number().min(0).max(1).optional(),
  aiSuggestionRationale: z.string().max(4000).optional(),
  aiSuggestionAccepted: z.boolean().optional(),
  inDailyCrimeLog: z.boolean(),
  dailyCrimeLogEnteredAt: isoDateTimeSchema.optional(),
  dailyCrimeLogDeadline: isoDateTimeSchema,
  dailyCrimeLogOverdue: z.boolean(),
  dailyCrimeLogDisposition: z.string().max(200).optional(),
  timelyWarningAssessed: z.boolean(),
  timelyWarningRequired: z.boolean().optional(),
  timelyWarningDeclinedReason: z.string().max(4000).optional(),
  timelyWarningIssuedAt: isoDateTimeSchema.optional(),
  timelyWarningAlertId: z.string().optional(),
  includedInASR: z.boolean(),
  asrReportYear: z.number().int().optional(),
  asrGeneratedAt: isoDateTimeSchema.optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type CleryRecord = z.infer<typeof cleryRecordSchema>;

export const cleryZoneConfigSchema = z.object({
  rcli: z.string().min(1),
  agencyId: z.string().min(1),
  cleryGeography: cleryActGeographySchema,
  buildingName: z.string().min(1).max(200),
  isResidentialFacility: z.boolean(),
  cleryBuildingCode: z.string().max(64).optional(),
  configuredBy: z.string().min(1),
  configuredAt: isoDateTimeSchema,
  notes: z.string().max(2000).optional(),
});

export type CleryZoneConfig = z.infer<typeof cleryZoneConfigSchema>;

export const campusSecurityAuthoritySchema = z.object({
  agencyId: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1).max(200),
  email: z.string().email(),
  reporterType: csaReporterTypeSchema,
  isSwornOfficer: z.boolean(),
  badgeNumber: z.string().max(64).optional(),
  isCleryCoordinator: z.boolean(),
  trainingCompletedAt: isoDateTimeSchema.optional(),
  trainingExpiresAt: isoDateTimeSchema.optional(),
  trainingDocumentS3Key: z.string().max(500).optional(),
  activeFrom: isoDateTimeSchema,
  activeTo: isoDateTimeSchema.optional(),
  addedBy: z.string().min(1),
  addedAt: isoDateTimeSchema,
});

export type CampusSecurityAuthority = z.infer<typeof campusSecurityAuthoritySchema>;

export const dailyCrimeLogEntrySchema = z.object({
  entryId: z.string().min(1),
  agencyId: z.string().min(1),
  cleryRecordId: z.string().min(1),
  reportedDate: z.string().min(8),
  reportedTime: z.string().max(16).optional(),
  occurredDate: z.string().max(16).optional(),
  occurredTime: z.string().max(16).optional(),
  occurredDateRange: z.string().max(120).optional(),
  cleryOffenseCategory: cleryOffenseCategorySchema,
  offenseCategoryDisplayName: z.string().min(1),
  generalLocation: z.string().min(1).max(240),
  cleryGeography: cleryActGeographySchema,
  disposition: z.string().min(1).max(200),
  isHateCrime: z.boolean(),
  enteredAt: isoDateTimeSchema,
  enteredBy: z.string().min(1),
  lastUpdatedAt: isoDateTimeSchema,
  isPubliclyVisible: z.boolean(),
  publicVisibleFrom: isoDateTimeSchema,
  publicWindowExpiresAt: isoDateTimeSchema,
  archiveExpiresAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
});

export type DailyCrimeLogEntry = z.infer<typeof dailyCrimeLogEntrySchema>;

/** Public crime log DTO — never include victim identifiers, room numbers, or actor userIds. */
export const publicDailyCrimeLogEntrySchema = z.object({
  reportedDate: z.string(),
  reportedTime: z.string().optional(),
  occurredDate: z.string().optional(),
  occurredTime: z.string().optional(),
  occurredDateRange: z.string().optional(),
  offenseCategoryDisplayName: z.string(),
  generalLocation: z.string(),
  disposition: z.string(),
  isHateCrime: z.boolean(),
});

export type PublicDailyCrimeLogEntry = z.infer<typeof publicDailyCrimeLogEntrySchema>;

export const cleryCreateRecordBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    incidentId: z.string().trim().min(1).max(128),
    reportedToInstitutionAt: isoDateTimeSchema.optional(),
    cleryZoneRcli: z.string().trim().max(64).optional(),
  })
  .strict();

export type CleryCreateRecordBody = z.infer<typeof cleryCreateRecordBodySchema>;

export const cleryClassifyBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    primaryOffense: cleryOffenseCategorySchema,
    secondaryOffenses: z.array(cleryOffenseCategorySchema).optional().default([]),
    cleryGeography: cleryActGeographySchema,
    isResidentialFacility: z.boolean(),
    isHateCrime: z.boolean(),
    hateCrimeBiasCategories: z.array(hateCrimeBiasSchema).optional().default([]),
    isVAWAOffense: z.boolean(),
    vawaOffenseType: vawaOffenseTypeSchema.optional(),
    enforcementAction: cleryEnforcementActionSchema.optional().default("NONE"),
    drugViolationType: drugLawViolationTypeSchema.optional(),
    generalLocationDescription: z.string().trim().min(3).max(240),
    reportedToInstitutionAt: isoDateTimeSchema.optional(),
    occurredAt: isoDateTimeSchema.optional(),
    occurredAtApproximate: z.boolean().optional().default(false),
    occurredAtRangeStart: isoDateTimeSchema.optional(),
    occurredAtRangeEnd: isoDateTimeSchema.optional(),
    dailyCrimeLogDisposition: cleryDclDispositionSchema.optional(),
    classificationNotes: z.string().trim().max(4000).optional(),
    aiSuggestionAccepted: z.boolean().optional(),
    confirm: z.literal(true),
  })
  .strict();

export type CleryClassifyBody = z.infer<typeof cleryClassifyBodySchema>;

export const cleryUnfoundBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    reason: z.string().trim().min(20).max(4000),
    fullInvestigationCompleted: z.literal(true),
  })
  .strict();

export type CleryUnfoundBody = z.infer<typeof cleryUnfoundBodySchema>;

export const cleryExcludeBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    reason: z.string().trim().min(10).max(4000),
  })
  .strict();

export const cleryCsaCreateBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    userId: z.string().trim().min(1).max(128),
    displayName: z.string().trim().min(1).max(200),
    email: z.string().email(),
    reporterType: csaReporterTypeSchema,
    isSwornOfficer: z.boolean(),
    badgeNumber: z.string().trim().max(64).optional(),
    isCleryCoordinator: z.boolean().optional().default(false),
    trainingCompletedAt: isoDateTimeSchema.optional(),
    trainingExpiresAt: isoDateTimeSchema.optional(),
  })
  .strict()
  .refine((v) => !v.isSwornOfficer || (v.badgeNumber && v.badgeNumber.trim().length > 0), {
    message: "badgeNumber is required when isSwornOfficer is true",
    path: ["badgeNumber"],
  })
  .refine((v) => !v.isSwornOfficer || v.reporterType === "SWORN_OFFICER", {
    message: "Sworn officers must use reporterType SWORN_OFFICER",
    path: ["reporterType"],
  });

export type CleryCsaCreateBody = z.infer<typeof cleryCsaCreateBodySchema>;

export const cleryCsaUpdateBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    displayName: z.string().trim().min(1).max(200).optional(),
    email: z.string().email().optional(),
    reporterType: csaReporterTypeSchema.optional(),
    isSwornOfficer: z.boolean().optional(),
    badgeNumber: z.string().trim().max(64).optional().nullable(),
    isCleryCoordinator: z.boolean().optional(),
    trainingCompletedAt: isoDateTimeSchema.optional().nullable(),
    trainingExpiresAt: isoDateTimeSchema.optional().nullable(),
    activeTo: isoDateTimeSchema.optional().nullable(),
  })
  .strict();

export const cleryZonePatchBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    cleryGeography: cleryActGeographySchema,
    buildingName: z.string().trim().min(1).max(200),
    isResidentialFacility: z.boolean(),
    cleryBuildingCode: z.string().trim().max(64).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.cleryGeography !== "ON_CAMPUS_RESIDENTIAL" || v.isResidentialFacility === true,
    { message: "ON_CAMPUS_RESIDENTIAL requires isResidentialFacility true" },
  );

export type CleryZonePatchBody = z.infer<typeof cleryZonePatchBodySchema>;

export const cleryDclPatchBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    disposition: cleryDclDispositionSchema,
  })
  .strict();

export const cleryTimelyWarningBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    required: z.boolean(),
    declinedReason: z.string().trim().max(4000).optional(),
    alertId: z.string().trim().max(128).optional(),
  })
  .strict()
  .refine((v) => v.required || (v.declinedReason && v.declinedReason.trim().length >= 10), {
    message: "declinedReason is required when a timely warning is not issued",
    path: ["declinedReason"],
  });

export const cleryAsrPolicyPatchBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    section: z.string().trim().min(1).max(64),
    body: z.string().max(20000),
  })
  .strict();

export const cleryPublicSettingsPatchBodySchema = z
  .object({
    campusCode: z.string().trim().min(2).max(32),
    institutionName: z.string().trim().min(1).max(200).optional(),
    publicContactName: z.string().trim().max(200).optional(),
    publicContactEmail: z.string().email().optional().or(z.literal("")),
    publicContactPhone: z.string().trim().max(40).optional(),
  })
  .strict();

export type CleryPublicSettings = {
  agencyId: string;
  institutionName: string;
  publicContactName?: string;
  publicContactEmail?: string;
  publicContactPhone?: string;
  updatedAt: string;
  updatedBy: string;
};

export const UNFOUND_FORBIDDEN_MESSAGE =
  "Only a sworn law enforcement officer with a badge number on file in the CSA registry may unfound a Clery crime. Campus administrators and non-sworn security cannot unfound records.";

export const CLERY_HUMAN_CLASSIFICATION_REQUIRED =
  "AI suggestions are advisory only. A Clery Coordinator or campus administrator must confirm classification before the record counts in statistics or the Daily Crime Log.";
