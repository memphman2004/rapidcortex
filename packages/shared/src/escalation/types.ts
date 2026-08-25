import { z } from "zod";

export const ESCALATION_STATUSES = [
  "pending",
  "acknowledged",
  "active",
  "resolved",
  "cancelled",
] as const;
export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

export const EscalationIncidentLocationSchema = z.object({
  section: z.string().max(200).optional(),
  zone: z.string().max(200).optional(),
  building: z.string().max(200).optional(),
  floor: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  gps: z
    .object({
      lat: z.number().gte(-90).lte(90),
      lng: z.number().gte(-180).lte(180),
    })
    .optional(),
  description: z.string().min(1).max(2000),
});
export type EscalationIncidentLocation = z.infer<typeof EscalationIncidentLocationSchema>;

export const EscalationTimelineEntrySchema = z.object({
  at: z.string().min(1).max(64),
  event: z.string().min(1).max(2000),
});
export type EscalationTimelineEntry = z.infer<typeof EscalationTimelineEntrySchema>;

export const EscalationAuditEntrySchema = z.object({
  eventId: z.string().min(1),
  escalationId: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.string().min(1),
  actor: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type EscalationAuditEntry = z.infer<typeof EscalationAuditEntrySchema>;

export interface EscalationRecord {
  escalationId: string;
  sourceAgencyId: string;
  sourceAgencyName: string;
  sourceVertical: "venue" | "campus";
  targetAgencyId: string;
  targetPsapName: string;
  targetPsapPhone: string;
  psapType: "rc-core" | "external";
  incidentId: string;
  incidentType: string;
  incidentLocation: EscalationIncidentLocation;
  incidentDescription: string;
  incidentTimeline: EscalationTimelineEntry[];
  reporterContact?: { phone?: string; anonymous: boolean };
  mediaUrls: string[];
  cameraFeedUrl?: string;
  escalatedAt: string;
  escalatedBy: string;
  status: EscalationStatus;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
  liveLocationSent: boolean;
  liveLocationSentAt?: string;
  liveLocationToken?: string;
  viewerToken: string;
  viewerTokenExpiresAt: string;
  viewerAccessCount: number;
  viewerLastAccessedAt?: string;
  viewerLastAccessedIp?: string;
  voiceCallSid?: string;
  voiceCallStatus?: string;
  voiceCallDurationSeconds?: number;
  smsSid?: string;
  smsStatus?: string;
  retentionExpiresAt: string;
  legalHold: boolean;
  legalHoldPlacedAt?: string;
  legalHoldPlacedBy?: string;
  archivedAt?: string;
  archivedS3Key?: string;
}

export const AgencyRelationshipSchema = z.object({
  sourceAgencyId: z.string().min(1),
  targetAgencyId: z.string().min(1),
  targetPsapName: z.string().min(1).max(200),
  targetPsapPhone: z.string().min(1).max(40),
  psapType: z.enum(["rc-core", "external"]),
  jurisdiction: z.string().max(200).optional().default(""),
  active: z.boolean(),
  createdAt: z.string().min(1),
  createdBy: z.string().min(1),
  updatedAt: z.string().optional(),
});
export type AgencyRelationship = z.infer<typeof AgencyRelationshipSchema>;

export const CreateEscalationBodySchema = z
  .object({
    incidentId: z.string().min(1).max(200),
    incidentType: z.string().min(1).max(200),
    incidentLocation: EscalationIncidentLocationSchema,
    incidentDescription: z.string().min(1).max(8000),
    incidentTimeline: z.array(EscalationTimelineEntrySchema).max(100).optional().default([]),
    reporterContact: z
      .object({
        phone: z.string().max(40).optional(),
        anonymous: z.boolean(),
      })
      .optional(),
    mediaUrls: z.array(z.string().min(1).max(2000)).max(25).optional().default([]),
    cameraFeedUrl: z.string().min(1).max(2000).optional(),
  })
  .strict();
export type CreateEscalationBody = z.infer<typeof CreateEscalationBodySchema>;

export const PatchEscalationBodySchema = z
  .object({
    status: z.enum(ESCALATION_STATUSES),
    notes: z.string().max(4000).optional(),
  })
  .strict();
export type PatchEscalationBody = z.infer<typeof PatchEscalationBodySchema>;

export const PutEscalationRelationshipBodySchema = z
  .object({
    targetAgencyId: z.string().min(1).max(200),
    targetPsapName: z.string().min(1).max(200),
    targetPsapPhone: z.string().min(1).max(40),
    psapType: z.enum(["rc-core", "external"]).optional().default("rc-core"),
    jurisdiction: z.string().max(200).optional().default(""),
    active: z.boolean().optional().default(true),
  })
  .strict();
export type PutEscalationRelationshipBody = z.infer<typeof PutEscalationRelationshipBodySchema>;

export const PushSubscriptionKeysSchema = z.object({
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
});

export const UpsertPushSubscriptionBodySchema = z
  .object({
    endpoint: z.string().url().max(2000).optional(),
    keys: PushSubscriptionKeysSchema.optional(),
    enabled: z.boolean().optional(),
    userAgent: z.string().max(512).optional(),
  })
  .strict()
  .refine((d) => Boolean(d.endpoint) || d.enabled === true, {
    message: "endpoint or enabled=true is required",
  });
export type UpsertPushSubscriptionBody = z.infer<typeof UpsertPushSubscriptionBodySchema>;

export const DeletePushSubscriptionBodySchema = z
  .object({
    endpoint: z.string().url().max(2000).optional(),
    subscriptionId: z.string().min(1).max(200).optional(),
  })
  .strict()
  .refine((d) => Boolean(d.endpoint) || Boolean(d.subscriptionId), {
    message: "endpoint or subscriptionId is required",
  });
export type DeletePushSubscriptionBody = z.infer<typeof DeletePushSubscriptionBodySchema>;
