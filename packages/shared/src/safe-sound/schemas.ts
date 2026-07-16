import { z } from "zod";

/** Mobile API envelope — `{ success, data?, error? }`. */
export const apiEnvelopeSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export const rcCodeReportTypeSchema = z.enum(["anonymous", "identified", "both"]);
export const codeVerticalSchema = z.enum(["venue", "campus"]);
export const codeStatusSchema = z.enum(["active", "inactive"]);

export const nfcWriteEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  codeId: z.string().min(1).max(128),
  writtenBy: z.string().min(1).max(128),
  writtenByName: z.string().max(200).nullable().optional(),
  devicePlatform: z.enum(["ios", "android"]),
  writeMethod: z.literal("native_nfc"),
  bytesWritten: z.number().int().nonnegative(),
  tagType: z.string().max(128).nullable().optional(),
  writtenAt: z.string().datetime(),
});

export const rcCodeMetricsSchema = z.object({
  nfcTaps: z.number().int().nonnegative(),
  qrScans: z.number().int().nonnegative(),
  lastNfcTap: z.string().datetime().nullable().optional(),
  lastQrScan: z.string().datetime().nullable().optional(),
});

export const rcCodeSchema = z.object({
  codeId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  zone: z.string().min(1).max(200),
  reportType: rcCodeReportTypeSchema,
  vertical: codeVerticalSchema,
  smsNumber: z.string().max(32).nullable().optional(),
  reportUrl: z.string().url(),
  nfcUrl: z.string().url(),
  status: codeStatusSchema,
  nfcWriteLog: z.array(nfcWriteEventSchema),
  metrics: rcCodeMetricsSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ssDeviceTypeSchema = z.enum(["home", "guardian"]);
export const ssDeviceStatusSchema = z.enum(["online", "offline", "lost"]);

export const ssDeviceSchema = z.object({
  deviceId: z.string().min(1).max(128),
  ownerId: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  type: ssDeviceTypeSchema,
  mountType: z.string().min(1).max(128),
  bleAddress: z.string().max(64).nullable().optional(),
  serialNumber: z.string().max(128).nullable().optional(),
  status: ssDeviceStatusSchema,
  lostModeActive: z.boolean(),
  lastSeenAt: z.string().datetime().nullable().optional(),
  batteryPct: z.number().min(0).max(100).nullable().optional(),
  rcCoreConsent: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const locationSourceSchema = z.enum([
  "gps",
  "cellular",
  "bluetooth",
  "community",
  "phone_gps",
]);

export const locationSnapshotSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  altitude: z.number().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  source: locationSourceSchema,
  timestamp: z.string().datetime(),
});

export const ssLocationEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  deviceId: z.string().min(1).max(128),
  location: locationSnapshotSchema,
  recordedAt: z.string().datetime(),
});

export const geofenceShapeSchema = z.enum(["circle", "polygon"]);

export const ssGeofenceScheduleSchema = z.object({
  enabled: z.boolean(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().min(1).max(64),
});

export const ssGeofenceSchema = z.object({
  geofenceId: z.string().min(1).max(128),
  deviceId: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  shape: geofenceShapeSchema,
  centerLat: z.number().min(-90).max(90).nullable().optional(),
  centerLng: z.number().min(-180).max(180).nullable().optional(),
  radiusMeters: z.number().positive().nullable().optional(),
  polygonCoordinates: z
    .array(z.object({ lat: z.number(), lng: z.number() }))
    .nullable()
    .optional(),
  alertOnEnter: z.boolean(),
  alertOnExit: z.boolean(),
  schedule: ssGeofenceScheduleSchema.nullable().optional(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const emergencyContactSchema = z.object({
  contactId: z.string().min(1).max(128),
  ownerId: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  phone: z.string().min(7).max(32),
  relationship: z.string().min(1).max(128),
  notifyViaPush: z.boolean(),
  notifyViaSMS: z.boolean(),
  notifyViaCall: z.boolean(),
  canCancelAlert: z.boolean(),
  preferredLanguage: z.string().max(16).nullable(),
  preferredLanguageName: z.string().max(128).nullable(),
  preferredLanguageRTL: z.boolean(),
});

export const guardianDetectionTypeSchema = z.enum([
  "fall",
  "immobility",
  "cardiac_distress",
  "sos",
]);

export const emergencyStatusSchema = z.enum([
  "DETECTED",
  "COUNTDOWN_ACTIVE",
  "CANCELLED",
  "CONTACTS_NOTIFIED",
  "INCIDENT_CREATED",
  "ESCALATION_INITIATED",
  "ESCALATION_CONNECTED",
]);

export const statusTransitionSchema = z.object({
  status: emergencyStatusSchema,
  transitionedAt: z.string().datetime(),
  detail: z.string().max(500).nullable().optional(),
});

export const sensorSnapshotSchema = z.object({
  heartRateBpm: z.number().positive().nullable().optional(),
  motionDetected: z.boolean().nullable().optional(),
  fallConfidence: z.number().min(0).max(1).nullable().optional(),
  immobilityMinutes: z.number().nonnegative().nullable().optional(),
});

export const wearerLanguageSourceSchema = z
  .enum(["user_preference", "device_locale"])
  .nullable();

export const guardianEmergencyEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  deviceId: z.string().min(1).max(128),
  ownerId: z.string().min(1).max(128),
  detectionType: guardianDetectionTypeSchema,
  detectionConfidence: z.number().min(0).max(1),
  detectedAt: z.string().datetime(),
  cancelWindowExpiresAt: z.string().datetime(),
  status: emergencyStatusSchema,
  statusHistory: z.array(statusTransitionSchema),
  location: locationSnapshotSchema,
  sensorSnapshot: sensorSnapshotSchema,
  batteryPct: z.number().min(0).max(100),
  wearerLanguage: z.string().max(16).nullable(),
  wearerLanguageName: z.string().max(128).nullable(),
  wearerLanguageRTL: z.boolean(),
  wearerLanguageSource: wearerLanguageSourceSchema,
  cancelledAt: z.string().datetime().optional(),
  cancelledBy: z.string().max(64).optional(),
  incidentId: z.string().max(128).optional(),
  auditHash: z.string().min(1).max(128),
});

export const ssSubscriptionStatusSchema = z.enum([
  "active",
  "past_due",
  "canceled",
  "trialing",
  "incomplete",
]);

export const ssSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1).max(128),
  deviceId: z.string().min(1).max(128),
  deviceSerial: z.string().min(1).max(128),
  status: ssSubscriptionStatusSchema,
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  interval: z.literal("month"),
  currentPeriodEnd: z.string().datetime(),
  cancelAtPeriodEnd: z.boolean(),
  stripeCustomerId: z.string().min(1).max(128),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

// ── Request bodies ────────────────────────────────────────────────────────────

export const createCodePayloadSchema = z.object({
  agencyId: z.string().min(1).max(128),
  name: z.string().min(1).max(200),
  zone: z.string().min(1).max(200),
  reportType: rcCodeReportTypeSchema,
  vertical: codeVerticalSchema,
  smsNumber: z.string().max(32).nullable().optional(),
});

export const updateCodePayloadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  zone: z.string().min(1).max(200).optional(),
  reportType: rcCodeReportTypeSchema.optional(),
  vertical: codeVerticalSchema.optional(),
  smsNumber: z.string().max(32).nullable().optional(),
  status: codeStatusSchema.optional(),
});

export const logNfcWritePayloadSchema = z.object({
  writtenBy: z.string().min(1).max(128),
  devicePlatform: z.enum(["ios", "android"]),
  writeMethod: z.literal("native_nfc"),
  bytesWritten: z.number().int().nonnegative(),
  tagType: z.string().max(128).optional(),
});

export const registerDevicePayloadSchema = z.object({
  deviceId: z.string().min(1).max(128),
  type: ssDeviceTypeSchema,
  bleAddress: z.string().max(64).optional(),
  name: z.string().min(1).max(200),
  mountType: z.string().min(1).max(128),
  serialNumber: z.string().max(128).optional(),
});

export const patchDevicePayloadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  mountType: z.string().min(1).max(128).optional(),
  bleAddress: z.string().max(64).nullable().optional(),
  serialNumber: z.string().max(128).nullable().optional(),
  status: ssDeviceStatusSchema.optional(),
  batteryPct: z.number().min(0).max(100).nullable().optional(),
});

export const postDeviceLocationPayloadSchema = locationSnapshotSchema.omit({ address: true });

export const lostModePayloadSchema = z.object({
  active: z.boolean(),
});

export const rcCoreConsentPayloadSchema = z.object({
  consent: z.boolean(),
});

export const createGeofencePayloadSchema = z.object({
  name: z.string().min(1).max(200),
  shape: geofenceShapeSchema,
  centerLat: z.number().min(-90).max(90).optional(),
  centerLng: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().positive().optional(),
  polygonCoordinates: z.array(z.object({ lat: z.number(), lng: z.number() })).optional(),
  alertOnEnter: z.boolean(),
  alertOnExit: z.boolean(),
  schedule: ssGeofenceScheduleSchema.nullable().optional(),
});

export const saveEmergencyContactsPayloadSchema = z.object({
  contacts: z.array(
    emergencyContactSchema.omit({ ownerId: true }).extend({
      contactId: z.string().min(1).max(128).optional(),
    }),
  ),
});

export const guardianCancelPayloadSchema = z.object({
  cancelledBy: z.enum(["wearer_app", "contact_app", "operator"]),
});

export const createSubscriptionPayloadSchema = z.object({
  deviceSerial: z.string().min(1).max(128),
  paymentMethodId: z.string().min(1).max(128),
});

export const profileLanguagePayloadSchema = z.object({
  languageCode: z.string().min(2).max(16),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type ApiEnvelope = z.infer<typeof apiEnvelopeSchema>;
export type NFCWriteEvent = z.infer<typeof nfcWriteEventSchema>;
export type RCCodeMetrics = z.infer<typeof rcCodeMetricsSchema>;
export type RCCode = z.infer<typeof rcCodeSchema>;
export type SSDevice = z.infer<typeof ssDeviceSchema>;
export type LocationSnapshot = z.infer<typeof locationSnapshotSchema>;
export type SSLocationEvent = z.infer<typeof ssLocationEventSchema>;
export type SSGeofence = z.infer<typeof ssGeofenceSchema>;
export type EmergencyContact = z.infer<typeof emergencyContactSchema>;
export type GuardianEmergencyEvent = z.infer<typeof guardianEmergencyEventSchema>;
export type SSSubscription = z.infer<typeof ssSubscriptionSchema>;
export type RegisterDevicePayload = z.infer<typeof registerDevicePayloadSchema>;
export type CreateGeofencePayload = z.infer<typeof createGeofencePayloadSchema>;
export type CreateCodePayload = z.infer<typeof createCodePayloadSchema>;
