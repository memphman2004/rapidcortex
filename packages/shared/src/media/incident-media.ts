import { z } from "zod";

/** Lifecycle for a caller media upload request (Dynamo + API). */
export const incidentMediaStatusSchema = z.enum([
  "link_sent",
  "sms_failed",
  "upload_url_issued",
  "uploaded",
  "expired",
  "canceled",
  "deleted",
  "pending",
]);

export type IncidentMediaStatus = z.infer<typeof incidentMediaStatusSchema>;

export const incidentMediaTypeSchema = z.enum(["photo", "video_clip"]);
export type IncidentMediaType = z.infer<typeof incidentMediaTypeSchema>;

export const incidentMediaConsentSchema = z.object({
  acceptTerms: z.literal(true),
  /** Version string shown on the public upload page (e.g. v1). */
  consentVersion: z.string().min(1).max(32),
});

export type IncidentMediaConsent = z.infer<typeof incidentMediaConsentSchema>;

export const requestIncidentMediaBodySchema = z.object({
  callerPhoneE164: z
    .string()
    .min(8)
    .max(24)
    .regex(/^\+[1-9]\d{6,22}$/, "Use E.164 format with leading +"),
  /** Optional override for the public site root (otherwise server env). */
  publicAppBaseUrl: z.string().url().max(500).optional(),
  ttlMinutes: z.number().int().min(15).max(2880).optional(),
  mediaType: incidentMediaTypeSchema.optional(),
});

export type RequestIncidentMediaInput = z.infer<typeof requestIncidentMediaBodySchema>;

export const incidentMediaUploadUrlBodySchema = z
  .object({
    fileName: z.string().min(1).max(240),
    contentType: z.string().min(3).max(120),
    byteSize: z.number().int().min(1).max(200_000_000),
    consent: incidentMediaConsentSchema,
  })
  .strict();

export type IncidentMediaUploadUrlInput = z.infer<typeof incidentMediaUploadUrlBodySchema>;

export const incidentMediaConfirmBodySchema = z
  .object({
    s3Key: z.string().min(8).max(500),
    byteSize: z.number().int().min(1).max(200_000_000),
    contentType: z.string().min(3).max(120),
  })
  .strict();

export type IncidentMediaConfirmInput = z.infer<typeof incidentMediaConfirmBodySchema>;

/** Stored row (agency-scoped PK). tokenHash is never returned to clients. */
export const incidentMediaRecordSchema = z.object({
  agencyId: z.string().min(2).max(64),
  mediaId: z.string().min(4).max(80),
  incidentId: z.string().min(4).max(120),
  tokenHash: z.string().min(32).max(128),
  status: incidentMediaStatusSchema,
  callerPhoneE164: z.string().min(8).max(24),
  requestedByUserId: z.string().min(1).max(120),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  expiresAt: z.string().min(1),
  /** DynamoDB TTL (Unix seconds). */
  ttl: z.number().int().positive(),
  smsSentAt: z.string().min(1).nullable().optional(),
  smsProviderRef: z.string().max(200).nullable().optional(),
  consentAt: z.string().min(1).nullable().optional(),
  consentVersion: z.string().max(32).nullable().optional(),
  uploadUrlIssuedAt: z.string().min(1).nullable().optional(),
  s3Key: z.string().max(500).nullable().optional(),
  originalFileName: z.string().max(240).nullable().optional(),
  contentType: z.string().max(120).nullable().optional(),
  byteSize: z.number().int().nullable().optional(),
  lastError: z.string().max(2000).nullable().optional(),
  /** What the dispatcher asked the caller to upload (defaults server-side if omitted). */
  mediaType: incidentMediaTypeSchema.nullable().optional(),
  /** Future: server-side blur pipeline flag; reserved for policy. */
  blurApplied: z.boolean().optional(),
  /** Last successful / attempted outbound SMS channel. */
  smsProvider: z.enum(["aws", "twilio", "mock", "log-only"]).nullable().optional(),
  /** Provider message id when available (SNS MessageId, Twilio SID). */
  smsMessageId: z.string().max(128).nullable().optional(),
  /** Last SMS attempt outcome for ops (`queued` used for simulator / deferred). */
  smsDispatchStatus: z.enum(["queued", "sent", "failed"]).nullable().optional(),
  /** Mirror of last dispatch result (`sent` = delivered to provider). */
  smsStatus: z.enum(["queued", "sent", "failed"]).nullable().optional(),
  smsErrorCode: z.string().max(64).nullable().optional(),
  /** True if `auto` mode succeeded on the second concrete provider. */
  smsFailoverUsed: z.boolean().optional(),
  retentionPolicyId: z.string().min(1).max(120).optional(),
  retentionExpiresAt: z.string().min(1).optional(),
  legalHold: z.boolean().optional(),
  legalHoldReason: z.string().max(2000).nullable().optional(),
  legalHoldSetBy: z.string().max(120).nullable().optional(),
  legalHoldSetAt: z.string().min(1).nullable().optional(),
  retGsiPk: z.string().min(1).max(32).optional(),
  retGsiSk: z.string().min(1).max(400).optional(),
});

export type IncidentMediaRecord = z.infer<typeof incidentMediaRecordSchema>;

/** Dispatcher / supervisor list item (no secrets). */
export const incidentMediaListItemSchema = incidentMediaRecordSchema.omit({ tokenHash: true }).extend({
  /** Short-lived presigned GET when status is uploaded. */
  downloadUrl: z.string().url().max(4000).optional(),
});

export type IncidentMediaListItem = z.infer<typeof incidentMediaListItemSchema>;

/** Public token metadata (minimal). */
export const incidentMediaPublicMetaSchema = z.object({
  status: incidentMediaStatusSchema,
  expiresAt: z.string(),
  consentVersion: z.string().max(32),
});

export type IncidentMediaPublicMeta = z.infer<typeof incidentMediaPublicMetaSchema>;
