import { z } from "zod";
import { campusSiteSchema } from "../campus/campus-sites.js";

const emailOrEmpty = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "Invalid email",
  });

const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), {
    message: "Must be an http(s) URL",
  });

export const campusIntegrationCampusSchema = campusSiteSchema.extend({
  estimatedBuildings: z.number().int().min(0).max(10_000).optional(),
  studentHeadcount: z.number().int().min(0).max(5_000_000).optional(),
  staffHeadcount: z.number().int().min(0).max(500_000).optional(),
});

export const campusIdpVendorSchema = z.enum([
  "shibboleth",
  "entra",
  "okta",
  "duo",
  "other",
  "unknown",
]);
export const campusSsoProtocolSchema = z.enum(["saml", "oidc", "unknown"]);
export const campusProvisioningSchema = z.enum(["jit", "scim", "manual", "unknown"]);
export const campusVmsVendorSchema = z.enum([
  "milestone",
  "hanwha",
  "genetec",
  "avigilon",
  "other",
  "none",
  "unknown",
]);
export const campusAccessControlVendorSchema = z.enum([
  "cbord",
  "lenel",
  "software_house",
  "other",
  "none",
  "unknown",
]);
export const campusAlprVendorSchema = z.enum([
  "flock",
  "genetec_autovu",
  "other",
  "none",
  "unknown",
]);

export const campusIntegrationQuestionnaireSchema = z
  .object({
    campuses: z.array(campusIntegrationCampusSchema).min(1).max(50),

    idpVendor: campusIdpVendorSchema,
    idpVendorOther: z.string().trim().max(200).optional(),
    ssoProtocol: campusSsoProtocolSchema,
    idpMetadataUrl: optionalUrl.optional().default(""),
    entityId: z.string().trim().max(500).optional(),
    mfaRequired: z.boolean(),
    provisioning: campusProvisioningSchema,
    sisOrHrms: z.string().trim().max(200).optional(),
    identityNotes: z.string().trim().max(4000).optional(),

    vmsPrimary: campusVmsVendorSchema,
    vmsPrimaryOther: z.string().trim().max(200).optional(),
    vmsVersion: z.string().trim().max(120).optional(),
    estimatedCameraCount: z.number().int().min(0).max(100_000).optional(),
    privacyMaskOwner: z.string().trim().max(200).optional(),
    vmsNotes: z.string().trim().max(4000).optional(),

    accessControlVendor: campusAccessControlVendorSchema,
    accessControlOther: z.string().trim().max(200).optional(),
    estimatedDoorCount: z.number().int().min(0).max(100_000).optional(),
    lockdownOperatorConfirmUnderstood: z.boolean(),
    accessControlNotes: z.string().trim().max(4000).optional(),

    alprVendor: campusAlprVendorSchema,
    alprOther: z.string().trim().max(200).optional(),
    alprCameraCount: z.number().int().min(0).max(10_000).optional(),
    alprNotes: z.string().trim().max(4000).optional(),

    cadVendor: z.string().trim().max(200).optional(),
    rmsVendor: z.string().trim().max(200).optional(),
    cadWritebackDesired: z.boolean(),
    cadWritebackAddendumAcknowledged: z.boolean(),
    cadNotes: z.string().trim().max(4000).optional(),

    alarmVendor: z.string().trim().max(200).optional(),
    digitalSignageVendor: z.string().trim().max(200).optional(),
    weatherVendor: z.string().trim().max(200).optional(),
    eocPlatform: z.string().trim().max(200).optional(),
    itsmVendor: z.string().trim().max(200).optional(),
    patrolVendor: z.string().trim().max(200).optional(),
    massNotificationVendor: z.string().trim().max(200).optional(),
    otherSystemsNotes: z.string().trim().max(4000).optional(),

    eapLibraryOwnerName: z.string().trim().max(120).optional(),
    eapLibraryOwnerEmail: emailOrEmpty.optional().default(""),
    cleryCoordinatorName: z.string().trim().max(120).optional(),
    cleryCoordinatorEmail: emailOrEmpty.optional().default(""),
    counselorRoutingContact: z.string().trim().max(200).optional(),
    clerySuggestionOnlyAcknowledged: z.boolean(),
    eapNotes: z.string().trim().max(4000).optional(),

    webhookAllowlistCidrs: z.string().trim().max(4000).optional(),
    firewallContactName: z.string().trim().max(120).optional(),
    firewallContactEmail: emailOrEmpty.optional().default(""),
    implementationLeadName: z.string().trim().min(1).max(120),
    implementationLeadEmail: z.string().trim().email().max(254),
    implementationLeadPhone: z.string().trim().max(32).optional(),
    targetGoLive: z.string().trim().max(40).optional(),
    changeWindowNotes: z.string().trim().max(2000).optional(),
    networkNotes: z.string().trim().max(4000).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.idpVendor === "other" && !value.idpVendorOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the identity provider",
        path: ["idpVendorOther"],
      });
    }
    if (value.vmsPrimary === "other" && !value.vmsPrimaryOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the VMS",
        path: ["vmsPrimaryOther"],
      });
    }
    if (value.accessControlVendor === "other" && !value.accessControlOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the access-control system",
        path: ["accessControlOther"],
      });
    }
    if (value.alprVendor === "other" && !value.alprOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Describe the ALPR system",
        path: ["alprOther"],
      });
    }
    if (!value.lockdownOperatorConfirmUnderstood) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirm Rapid Cortex never auto-locks doors — operators confirm every lockdown",
        path: ["lockdownOperatorConfirmUnderstood"],
      });
    }
    if (!value.clerySuggestionOnlyAcknowledged) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirm Clery stays suggestion-only — Rapid Cortex never auto-files or issues Timely Warnings",
        path: ["clerySuggestionOnlyAcknowledged"],
      });
    }
    if (value.cadWritebackDesired && !value.cadWritebackAddendumAcknowledged) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Acknowledge that CAD write-back stays off until a signed addendum — this form does not enable it",
        path: ["cadWritebackAddendumAcknowledged"],
      });
    }
  });

export type CampusIntegrationCampus = z.infer<typeof campusIntegrationCampusSchema>;
export type CampusIntegrationQuestionnaire = z.infer<typeof campusIntegrationQuestionnaireSchema>;

export type CampusIntegrationQuestionnaireRecord = CampusIntegrationQuestionnaire & {
  orgCode: string;
  agencyId: string;
  submittedAt: string;
  submittedBy?: string;
  updatedAt: string;
};

export function blankCampusIntegrationQuestionnaire(
  orgCode: string,
): CampusIntegrationQuestionnaire {
  const code = orgCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  return {
    campuses: [
      {
        code: code.length >= 2 ? code : "CAMPUS",
        name: "",
        city: "",
        state: "",
        kind: "main",
        active: true,
      },
    ],
    idpVendor: "unknown",
    idpVendorOther: "",
    ssoProtocol: "unknown",
    idpMetadataUrl: "",
    entityId: "",
    mfaRequired: true,
    provisioning: "unknown",
    sisOrHrms: "",
    identityNotes: "",
    vmsPrimary: "unknown",
    vmsPrimaryOther: "",
    vmsVersion: "",
    estimatedCameraCount: 0,
    privacyMaskOwner: "",
    vmsNotes: "",
    accessControlVendor: "unknown",
    accessControlOther: "",
    estimatedDoorCount: 0,
    lockdownOperatorConfirmUnderstood: false,
    accessControlNotes: "",
    alprVendor: "unknown",
    alprOther: "",
    alprCameraCount: 0,
    alprNotes: "",
    cadVendor: "",
    rmsVendor: "",
    cadWritebackDesired: false,
    cadWritebackAddendumAcknowledged: false,
    cadNotes: "",
    alarmVendor: "",
    digitalSignageVendor: "",
    weatherVendor: "",
    eocPlatform: "",
    itsmVendor: "",
    patrolVendor: "",
    massNotificationVendor: "",
    otherSystemsNotes: "",
    eapLibraryOwnerName: "",
    eapLibraryOwnerEmail: "",
    cleryCoordinatorName: "",
    cleryCoordinatorEmail: "",
    counselorRoutingContact: "",
    clerySuggestionOnlyAcknowledged: false,
    eapNotes: "",
    webhookAllowlistCidrs: "",
    firewallContactName: "",
    firewallContactEmail: "",
    implementationLeadName: "",
    implementationLeadEmail: "",
    implementationLeadPhone: "",
    targetGoLive: "",
    changeWindowNotes: "",
    networkNotes: "",
  };
}
