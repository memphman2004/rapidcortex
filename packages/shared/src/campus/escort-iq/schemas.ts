import { z } from "zod";

export const ESCORT_IQ_PRODUCT_NAME = "Escort iQ™ from NexCort iQ" as const;
export const ESCORT_IQ_TAGLINE =
  "One Scan. Four Ways to Stay Connected. One More Layer of Protection." as const;
export const ESCORT_IQ_SUPPORTING = "Your Journey. Your Safety. Your Choice." as const;

export const escortStatusSchema = z.enum([
  "REQUESTED",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "ACTIVE",
  "ARRIVED_PENDING_CONFIRMATION",
  "COMPLETED",
  "CANCELED",
  "UNAVAILABLE",
  "ESCALATED",
]);
export type EscortStatus = z.infer<typeof escortStatusSchema>;

export const escortMethodSchema = z.enum(["GPS", "PHYSICAL", "VIDEO", "VOICE"]);
export type EscortMethod = z.infer<typeof escortMethodSchema>;

export const escortOversightStatusSchema = z.enum([
  "PENDING",
  "ACKNOWLEDGED",
  "ACTIVE",
  "OVERDUE",
  "ESCALATED",
  "CLOSED",
  "UNAVAILABLE",
]);
export type EscortOversightStatus = z.infer<typeof escortOversightStatusSchema>;

export const escortLocationSnapshotSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  building: z.string().max(120).optional(),
  floor: z.string().max(32).optional(),
  zone: z.string().max(120).optional(),
  /** registered_qr | device_gps | manual — never conflate QR install with live GPS */
  verificationStatus: z.enum(["registered_qr", "device_gps", "manual", "unknown"]).optional(),
});

export const escortDestinationSchema = z.object({
  description: z.string().trim().min(1).max(400),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  building: z.string().max(120).optional(),
  floor: z.string().max(32).optional(),
  zone: z.string().max(120).optional(),
});

/** Tenant Escort iQ settings (stored on CampusAgencyConfig). Default off. */
export const campusEscortIqConfigSchema = z.object({
  enabled: z.boolean().default(false),
  campusSafetyPhone: z.string().max(32).optional(),
  studentInstructions: z.string().max(2000).optional(),
  methods: z
    .object({
      gps: z.boolean().default(true),
      physical: z.boolean().default(true),
      video: z.boolean().default(false),
      voice: z.boolean().default(true),
    })
    .optional(),
  physical: z
    .object({
      independentSupervisorRequired: z.boolean().default(true),
      defaultPickupEtaMinutes: z.number().int().min(1).max(180).default(15),
      destinationGraceMinutes: z.number().int().min(1).max(180).default(20),
      studentConfirmationRequired: z.boolean().default(true),
    })
    .optional(),
  checkIns: z
    .object({
      enabled: z.boolean().default(true),
      intervalMinutes: z.number().int().min(2).max(60).default(10),
    })
    .optional(),
});
export type CampusEscortIqConfig = z.infer<typeof campusEscortIqConfigSchema>;

export const createEscortSessionBodySchema = z.object({
  qrId: z.string().min(1).max(64),
  medium: z.enum(["qr", "nfc", "direct", "url"]).default("qr"),
  methods: z.array(escortMethodSchema).min(1).max(4),
  destination: escortDestinationSchema,
  startingLocationNote: z.string().max(400).optional(),
  callbackPhoneE164: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/)
    .optional(),
  /** Explicit GPS consent — required when GPS is among methods. */
  gpsConsent: z.boolean().optional(),
});
export type CreateEscortSessionBody = z.infer<typeof createEscortSessionBodySchema>;

export const studentEscortCheckInBodySchema = z.object({
  response: z.enum(["ok", "need_assistance", "contact_supervisor", "request_different_escort"]),
  privateNote: z.string().max(1000).optional(),
});

export const studentArrivalConfirmBodySchema = z.object({
  confirmed: z.literal(true),
});

export const staffEscortPatchBodySchema = z.object({
  status: escortStatusSchema.optional(),
  assignedEscortDisplayName: z.string().max(120).optional(),
  assignedEscortEmployeeRef: z.string().max(64).optional(),
  assignedEscortUnit: z.string().max(120).optional(),
  independentSupervisorId: z.string().max(128).optional(),
  pickupEtaAt: z.string().datetime().optional(),
  destinationEtaAt: z.string().datetime().optional(),
  officerCompleted: z.boolean().optional(),
  administrativeCloseReason: z.string().max(500).optional(),
});

export type EscortSessionPublic = {
  escortId: string;
  referenceCode: string;
  status: EscortStatus;
  methods: EscortMethod[];
  destination: z.infer<typeof escortDestinationSchema>;
  startingLocationSnapshot?: z.infer<typeof escortLocationSnapshotSchema>;
  requestedAt: string;
  pickupEtaAt?: string;
  destinationEtaAt?: string;
  assignedEscortDisplayName?: string;
  assignedEscortUnit?: string;
  oversightStatus: EscortOversightStatus;
  locationSharingActive?: boolean;
  expiresAt?: string;
};

export type EscortSessionStaff = EscortSessionPublic & {
  agencyId: string;
  campusCode: string;
  siteCode?: string;
  qrId?: string;
  safetyPointName?: string;
  acknowledgedAt?: string;
  startedAt?: string;
  completedAt?: string;
  studentConfirmedAt?: string;
  officerCompletedAt?: string;
  lastStudentCheckInAt?: string;
  nextStudentCheckInDueAt?: string;
  /** Pinpoint link id only — never the bearer token. */
  pinpointLinkId?: string;
  callbackPhoneLast4?: string;
  closureKind?: "student_confirmed" | "administrative" | "canceled";
};
