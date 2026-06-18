import { z } from "zod";

export const venueEventFrequencySchema = z.enum(["year_round", "seasonal", "single_event"]);
export const venueSecurityStaffingSchema = z.enum(["in_house", "contracted", "hybrid"]);
export const venueSecurityCommsToolSchema = z.enum([
  "radio",
  "app",
  "dispatch_software",
  "other",
]);
export const venueNfcTagsNeededSchema = z.enum(["yes", "no", "unknown"]);
export const venueSignInstallerSchema = z.enum(["venue_ops", "vendor", "rc"]);
export const venueDataRetentionPreferenceSchema = z.enum(["1yr", "3yr", "7yr"]);

export const venueIntakeSchema = z
  .object({
    venueName: z.string().trim().min(1).max(200),
    legalEntityName: z.string().trim().min(1).max(200),
    state: z.string().trim().min(2).max(2),
    venueCapacity: z.number().int().min(0).max(500_000),
    eventFrequency: venueEventFrequencySchema,
    securityStaffingModel: venueSecurityStaffingSchema,
    securityDispatchContactName: z.string().trim().min(1).max(120),
    securityDispatchContactNumber: z.string().trim().min(7).max(32),
    guestServicesContactName: z.string().trim().min(1).max(120),
    guestServicesContactEmail: z.string().trim().email().max(254),
    adaCoordinatorName: z.string().trim().min(1).max(120),
    adaCoordinatorEmail: z.string().trim().email().max(254),
    existingSecurityCommsTools: z.array(venueSecurityCommsToolSchema).min(1).max(4),
    existingSecurityCommsToolsOther: z.string().trim().max(500).optional(),
    guestServicesReceiveReports: z.boolean(),
    sectionZoneCount: z.number().int().min(0).max(10_000),
    nfcTagsNeeded: venueNfcTagsNeededSchema,
    signInstaller: venueSignInstallerSchema,
    eventCodesAutoExpire: z.boolean(),
    mediaSignageRestrictions: z.string().trim().max(4000).optional(),
    dataRetentionPreference: venueDataRetentionPreferenceSchema,
    notes: z.string().trim().max(8000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.existingSecurityCommsTools.includes("other") &&
      !value.existingSecurityCommsToolsOther?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the other security comms tool",
        path: ["existingSecurityCommsToolsOther"],
      });
    }
  });

export type VenueIntake = z.infer<typeof venueIntakeSchema>;

export type VenueIntakeRecord = VenueIntake & {
  orgCode: string;
  agencyId: string;
  submittedAt: string;
  submittedBy?: string;
  updatedAt: string;
};
