import { z } from "zod";

export const campusEscalationContactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(32).optional(),
});

export const campusTypeSchema = z.enum([
  "university",
  "k12",
  "community_college",
  "corporate",
  "other",
]);

export const campusNotificationRecipientsSchema = z.object({
  newIncidentEmails: z.array(z.string().email()).max(50).optional(),
  escalationEmails: z.array(z.string().email()).max(50).optional(),
  newIncidentSms: z.array(z.string().min(7).max(32)).max(50).optional(),
  escalationSms: z.array(z.string().min(7).max(32)).max(50).optional(),
});

export const campusAgencyConfigSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  campusType: campusTypeSchema.optional(),
  timezone: z.string().min(1).max(64).optional(),
  notificationPreferences: z
    .object({
      emailAlerts: z.boolean().optional(),
      smsAlerts: z.boolean().optional(),
      pushAlerts: z.boolean().optional(),
    })
    .optional(),
  notificationRecipients: campusNotificationRecipientsSchema.optional(),
  escalation: z
    .object({
      enabled: z.boolean().optional(),
      unacknowledgedMinutes: z.number().int().min(1).max(1440).optional(),
      contacts: z.array(campusEscalationContactSchema).max(20).optional(),
    })
    .optional(),
  publicReportForm: z
    .object({
      headline: z.string().min(1).max(200).optional(),
      instructions: z.string().max(2000).optional(),
      showPhotoUpload: z.boolean().optional(),
      showLocationPicker: z.boolean().optional(),
      collectName: z.boolean().optional(),
      collectPhone: z.boolean().optional(),
      collectLocation: z.boolean().optional(),
      customFields: z
        .array(
          z.object({
            label: z.string().min(1).max(120),
            required: z.boolean(),
          }),
        )
        .max(10)
        .optional(),
      emergencyDisclaimer: z.string().max(1000).optional(),
    })
    .optional(),
});

export type CampusAgencyConfig = z.infer<typeof campusAgencyConfigSchema>;

export const campusAgencyConfigPatchSchema = campusAgencyConfigSchema.partial();
