import { z } from "zod";

export const hospitalPreAlertTypeSchema = z.enum([
  "TRAUMA",
  "STROKE",
  "CARDIAC",
  "OVERDOSE",
  "RESPIRATORY",
  "PEDIATRIC",
  "BEHAVIORAL",
  "MASS_CASUALTY",
  "LANGUAGE_ACCESS",
  "GENERAL_EMS",
]);
export type HospitalPreAlertType = z.infer<typeof hospitalPreAlertTypeSchema>;

export const hospitalPreAlertPrioritySchema = z.enum([
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);
export type HospitalPreAlertPriority = z.infer<typeof hospitalPreAlertPrioritySchema>;

export const hospitalPreAlertStatusSchema = z.enum([
  "DRAFT",
  "READY_TO_SEND",
  "SENT",
  "ACKNOWLEDGED",
  "UPDATED",
  "CANCELLED",
  "FAILED",
]);
export type HospitalPreAlertStatus = z.infer<typeof hospitalPreAlertStatusSchema>;

export const hospitalPreAlertAttachmentSchema = z.object({
  type: z.enum(["PHOTO", "VIDEO", "AUDIO", "TRANSCRIPT"]),
  url: z.string().url().max(2000),
  uploadedAt: z.string().datetime(),
});

export const hospitalPreAlertSchema = z.object({
  alertId: z.string().min(1).max(80),
  agencyId: z.string().min(1).max(120),
  incidentId: z.string().min(1).max(120),
  hospitalId: z.string().min(1).max(120),
  hospitalName: z.string().min(1).max(300),
  alertType: hospitalPreAlertTypeSchema,
  priority: hospitalPreAlertPrioritySchema,
  status: hospitalPreAlertStatusSchema,
  chiefComplaint: z.string().min(1).max(500),
  patientApproxAge: z.number().int().min(0).max(130).optional(),
  patientSex: z.enum(["M", "F", "X", "UNKNOWN"]).optional(),
  languageNeed: z.string().max(120).optional(),
  incidentLocation: z.string().min(1).max(500),
  destinationHospital: z.string().min(1).max(300),
  etaMinutes: z.number().int().min(0).max(600).optional(),
  emsUnitId: z.string().max(80).optional(),
  responderNotes: z.string().max(4000).optional(),
  dispatcherSummary: z.string().max(4000).optional(),
  vitalsSummary: z.string().max(500).optional(),
  attachments: z.array(hospitalPreAlertAttachmentSchema).max(20).optional(),
  sentAt: z.string().datetime().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  acknowledgedBy: z.string().max(120).optional(),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  createdBy: z.string().min(1).max(120),
});
export type HospitalPreAlert = z.infer<typeof hospitalPreAlertSchema>;

export const hospitalTraumaLevelSchema = z.enum([
  "LEVEL_1",
  "LEVEL_2",
  "LEVEL_3",
  "LEVEL_4",
  "NONE",
]);
export type HospitalTraumaLevel = z.infer<typeof hospitalTraumaLevelSchema>;

export const hospitalNotificationMethodSchema = z.enum([
  "SECURE_DASHBOARD",
  "EMAIL_SECURE",
  "SMS_NOTIFICATION_ONLY",
  "FHIR_ENDPOINT",
  "WEBHOOK",
  "MANUAL_CALL_LOG",
]);
export type HospitalNotificationMethod = z.infer<typeof hospitalNotificationMethodSchema>;

export const hospitalProfileSchema = z.object({
  hospitalId: z.string().min(1).max(120),
  agencyId: z.string().min(1).max(120),
  name: z.string().min(1).max(300),
  address: z.string().min(1).max(500),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  phone: z.string().min(3).max(40),
  emergencyDepartmentPhone: z.string().max(40).optional(),
  traumaLevel: hospitalTraumaLevelSchema.optional(),
  strokeCenter: z.boolean().default(false),
  cardiacCenter: z.boolean().default(false),
  pediatricCapable: z.boolean().default(false),
  burnCenter: z.boolean().default(false),
  behavioralHealthCapable: z.boolean().default(false),
  preferredNotificationMethod: hospitalNotificationMethodSchema,
  integrationType: z.enum(["FHIR", "WEBHOOK", "MANUAL"]).optional(),
  endpointUrlSecretRef: z.string().max(500).optional(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type HospitalProfile = z.infer<typeof hospitalProfileSchema>;

export const createHospitalPreAlertBodySchema = z.object({
  incidentId: z.string().min(1).max(120),
  hospitalId: z.string().min(1).max(120),
  alertType: hospitalPreAlertTypeSchema,
  priority: hospitalPreAlertPrioritySchema.optional(),
  chiefComplaint: z.string().min(1).max(500),
  patientApproxAge: z.number().int().min(0).max(130).optional(),
  patientSex: z.enum(["M", "F", "X", "UNKNOWN"]).optional(),
  languageNeed: z.string().max(120).optional(),
  incidentLocation: z.string().min(1).max(500),
  etaMinutes: z.number().int().min(0).max(600).optional(),
  emsUnitId: z.string().max(80).optional(),
  dispatcherSummary: z.string().max(4000).optional(),
  vitalsSummary: z.string().max(500).optional(),
  responderNotes: z.string().max(4000).optional(),
});
export type CreateHospitalPreAlertBody = z.infer<typeof createHospitalPreAlertBodySchema>;

export const updateHospitalPreAlertBodySchema = createHospitalPreAlertBodySchema
  .partial()
  .extend({
    status: z.enum(["DRAFT", "READY_TO_SEND"]).optional(),
  });
export type UpdateHospitalPreAlertBody = z.infer<typeof updateHospitalPreAlertBodySchema>;

export const acknowledgeHospitalPreAlertBodySchema = z.object({
  acknowledgedBy: z.string().min(1).max(120).optional(),
});
export type AcknowledgeHospitalPreAlertBody = z.infer<
  typeof acknowledgeHospitalPreAlertBodySchema
>;

export const upsertHospitalProfileBodySchema = z.object({
  name: z.string().min(1).max(300),
  address: z.string().min(1).max(500),
  coordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  phone: z.string().min(3).max(40),
  emergencyDepartmentPhone: z.string().max(40).optional(),
  traumaLevel: hospitalTraumaLevelSchema.optional(),
  strokeCenter: z.boolean().optional(),
  cardiacCenter: z.boolean().optional(),
  pediatricCapable: z.boolean().optional(),
  burnCenter: z.boolean().optional(),
  behavioralHealthCapable: z.boolean().optional(),
  preferredNotificationMethod: hospitalNotificationMethodSchema.optional(),
  integrationType: z.enum(["FHIR", "WEBHOOK", "MANUAL"]).optional(),
  endpointUrlSecretRef: z.string().max(500).optional(),
  active: z.boolean().optional(),
});
export type UpsertHospitalProfileBody = z.infer<typeof upsertHospitalProfileBodySchema>;

export type HospitalPreAlertListResponse = { items: HospitalPreAlert[] };
export type HospitalProfileListResponse = { items: HospitalProfile[] };
