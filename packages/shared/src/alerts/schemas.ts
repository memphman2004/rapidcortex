import { z } from "zod";

export const alertVerticalSchema = z.enum(["campus", "venue", "transit"]);
export type AlertVertical = z.infer<typeof alertVerticalSchema>;

export const alertChannelSchema = z.enum(["SMS", "EMAIL", "WEB_DASHBOARD", "WEB_PUSH"]);
export type AlertChannel = z.infer<typeof alertChannelSchema>;

export const alertSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
export type AlertSeverity = z.infer<typeof alertSeveritySchema>;

export const alertTemplateTypeSchema = z.enum([
  "ACTIVE_THREAT",
  "SHELTER_IN_PLACE",
  "EVACUATION",
  "LOCKDOWN",
  "WEATHER_EMERGENCY",
  "HEALTH_ALERT",
  "INFRASTRUCTURE",
  "ALL_CLEAR",
  "TIMELY_WARNING",
  "CUSTOM",
]);
export type AlertTemplateType = z.infer<typeof alertTemplateTypeSchema>;

export const alertJobStatusSchema = z.enum(["DISPATCHING", "PARTIAL", "COMPLETED", "FAILED"]);
export type AlertJobStatus = z.infer<typeof alertJobStatusSchema>;

export const alertDeliveryStatusSchema = z.enum([
  "queued",
  "sent",
  "delivered",
  "failed",
  "skipped",
  "pending",
]);
export type AlertDeliveryStatus = z.infer<typeof alertDeliveryStatusSchema>;

export const alertOptInMethodSchema = z.enum([
  "sis_import",
  "web_form",
  "paper",
  "verbal_recorded",
  "existing_ens",
  "other",
]);
export type AlertOptInMethod = z.infer<typeof alertOptInMethodSchema>;

export const CONFIRM_DISPATCH_TOKEN = "CONFIRM";

/** Server and client must accept case-insensitive CONFIRM only. */
export function isConfirmDispatchToken(value: string | undefined | null): boolean {
  return String(value ?? "").trim().toUpperCase() === CONFIRM_DISPATCH_TOKEN;
}

export const alertOrganizationSchema = z.object({
  organizationId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  name: z.string().trim().min(1).max(200),
  memberAgencyIds: z.array(z.string().min(1).max(128)).min(1).max(32),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AlertOrganization = z.infer<typeof alertOrganizationSchema>;

export const alertRecipientGroupSchema = z.object({
  groupId: z.string().min(1).max(128),
  organizationId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  slug: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  system: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AlertRecipientGroup = z.infer<typeof alertRecipientGroupSchema>;

export const alertRecipientSchema = z.object({
  recipientId: z.string().min(1).max(128),
  organizationId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  email: z.string().email().max(320).optional(),
  phoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  displayName: z.string().trim().max(200).optional(),
  groupIds: z.array(z.string().min(1).max(128)).max(32),
  smsOptIn: z.boolean(),
  smsOptedOut: z.boolean(),
  optInDate: z.string().optional(),
  optInMethod: alertOptInMethodSchema.optional(),
  optInConsentText: z.string().max(2000).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AlertRecipient = z.infer<typeof alertRecipientSchema>;

export const alertTemplateSchema = z.object({
  templateId: z.string().min(1).max(128),
  organizationId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  type: alertTemplateTypeSchema,
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  smsBody: z.string().trim().min(1).max(160),
  severity: alertSeveritySchema,
  system: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AlertTemplate = z.infer<typeof alertTemplateSchema>;

export const alertChannelSummarySchema = z.object({
  channel: alertChannelSchema,
  queued: z.number().int().nonnegative(),
  sent: z.number().int().nonnegative(),
  delivered: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  skipReason: z.string().max(200).optional(),
});
export type AlertChannelSummary = z.infer<typeof alertChannelSummarySchema>;

export const alertDispatchJobSchema = z.object({
  jobId: z.string().min(1).max(128),
  organizationId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  templateId: z.string().min(1).max(128),
  templateType: alertTemplateTypeSchema,
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  severity: alertSeveritySchema,
  groupIds: z.array(z.string().min(1).max(128)).min(1).max(32),
  channels: z.array(alertChannelSchema).min(1).max(4),
  status: alertJobStatusSchema,
  initiatedAt: z.string(),
  completedAt: z.string().optional(),
  actorId: z.string().min(1).max(128),
  estimatedRecipients: z.number().int().nonnegative(),
  channelSummary: z.array(alertChannelSummarySchema),
});
export type AlertDispatchJob = z.infer<typeof alertDispatchJobSchema>;

export const verticalAlertWsPayloadSchema = z.object({
  jobId: z.string().min(1),
  vertical: alertVerticalSchema,
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  severity: alertSeveritySchema,
  type: alertTemplateTypeSchema,
  sentAt: z.string(),
});
export type VerticalAlertWsPayload = z.infer<typeof verticalAlertWsPayloadSchema>;

export const VERTICAL_ALERT_WS_TYPE = "VERTICAL_ALERT" as const;

export const VERTICAL_ALERT_WS_TYPES = {
  campus: "CAMPUS_ALERT",
  venue: "VENUE_ALERT",
  transit: "TRANSIT_ALERT",
} as const;

export type VerticalAlertWsBroadcastType =
  | typeof VERTICAL_ALERT_WS_TYPE
  | (typeof VERTICAL_ALERT_WS_TYPES)[AlertVertical];

export function verticalAlertWsType(vertical: AlertVertical): VerticalAlertWsBroadcastType {
  return VERTICAL_ALERT_WS_TYPES[vertical];
}

export function isVerticalAlertWsType(type: string | undefined | null): boolean {
  return (
    type === VERTICAL_ALERT_WS_TYPE ||
    type === VERTICAL_ALERT_WS_TYPES.campus ||
    type === VERTICAL_ALERT_WS_TYPES.venue ||
    type === VERTICAL_ALERT_WS_TYPES.transit
  );
}

export const alertDispatchBodySchema = z
  .object({
    organizationId: z.string().min(1).max(128).optional(),
    vertical: alertVerticalSchema,
    templateId: z.string().min(1).max(128),
    bodyOverride: z.string().trim().min(1).max(2000).optional(),
    groupIds: z.array(z.string().min(1).max(128)).min(1).max(32),
    channels: z.array(alertChannelSchema).min(1).max(4),
    confirmation: z.string().min(1).max(32).optional(),
    confirmationToken: z.string().min(1).max(32).optional(),
  })
  .strict()
  .refine((v) => isConfirmDispatchToken(v.confirmation ?? v.confirmationToken), {
    message: "Type CONFIRM to send an occupant alert",
    path: ["confirmation"],
  });
export type AlertDispatchBody = z.infer<typeof alertDispatchBodySchema>;

export const alertRecipientImportBodySchema = z
  .object({
    organizationId: z.string().min(1).max(128).optional(),
    vertical: alertVerticalSchema,
    csv: z.string().min(1).max(4_000_000),
  })
  .strict();
export type AlertRecipientImportBody = z.infer<typeof alertRecipientImportBodySchema>;

export const alertGroupUpsertBodySchema = z
  .object({
    organizationId: z.string().min(1).max(128).optional(),
    vertical: alertVerticalSchema,
    slug: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(120),
  })
  .strict();

export const alertTemplateUpsertBodySchema = z
  .object({
    organizationId: z.string().min(1).max(128).optional(),
    vertical: alertVerticalSchema,
    type: alertTemplateTypeSchema,
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(2000),
    smsBody: z.string().trim().min(1).max(160),
    severity: alertSeveritySchema,
  })
  .strict();

export const alertOrganizationUpsertBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    vertical: alertVerticalSchema,
    memberAgencyIds: z.array(z.string().min(1).max(128)).min(1).max(32).optional(),
  })
  .strict();

export const alertSmsOptoutBodySchema = z
  .object({
    From: z.string().min(5).max(32).optional(),
    Body: z.string().max(160).optional(),
    phoneE164: z.string().min(8).max(20).optional(),
    action: z.enum(["STOP", "START"]).optional(),
  })
  .strict();

export const alertAcknowledgeBodySchema = z
  .object({
    jobId: z.string().min(1).max(128).optional(),
  })
  .strict();

export type AlertSkipReason =
  | "NO_SHORT_CODE"
  | "NO_SMS_CONSENT"
  | "SMS_OPTED_OUT"
  | "DNC"
  | "CHANNEL_NOT_ENABLED"
  | "NO_EMAIL"
  | "NO_PUSH_SUBSCRIPTION"
  | "MISSING_PHONE";

export const ALERT_SMS_CARRIER_CAVEAT =
  "SMS delivery varies by carrier. Messages are queued to the provider within 3 seconds; receipt on 50,000 phones typically takes 8–15 minutes on a dedicated short code.";

export const ALERT_INITIATED_COPY = "Delivery initiated within 3 seconds.";
