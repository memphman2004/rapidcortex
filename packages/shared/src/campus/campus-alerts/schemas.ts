import { z } from "zod";

export const CAMPUS_ALERTS_PRODUCT_NAME = "NexCort iQ Campus Alerts" as const;
export const CAMPUS_ALERTS_CONSENT_VERSION = "campus-alerts-sms-v1" as const;

export const campusAlertSubscriptionStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "SUBSCRIBED",
  "RENEWAL_DUE",
  "EXPIRED",
  "UNSUBSCRIBED",
  "SUPPRESSED",
]);
export type CampusAlertSubscriptionStatus = z.infer<typeof campusAlertSubscriptionStatusSchema>;

/**
 * Broadcast classification. Only EMERGENCY / EMERGENCY_UPDATE / ALL_CLEAR
 * may initiate production mass SMS (subject to university policy).
 * ANNUAL_RENEWAL / ROUTINE / SAFETY_ADVISORY / TEST must not trigger mass SMS.
 */
export const campusAlertBroadcastClassificationSchema = z.enum([
  "EMERGENCY",
  "EMERGENCY_UPDATE",
  "ALL_CLEAR",
  "SAFETY_ADVISORY",
  "ROUTINE",
  "ANNUAL_RENEWAL",
  "TEST",
]);
export type CampusAlertBroadcastClassification = z.infer<
  typeof campusAlertBroadcastClassificationSchema
>;

/** Classifications that may use production mass SMS under emergency-only policy. */
export const CAMPUS_ALERTS_MASS_SMS_CLASSIFICATIONS: CampusAlertBroadcastClassification[] = [
  "EMERGENCY",
  "EMERGENCY_UPDATE",
  "ALL_CLEAR",
];

export function isCampusAlertsMassSmsClassification(
  classification: CampusAlertBroadcastClassification,
): boolean {
  return CAMPUS_ALERTS_MASS_SMS_CLASSIFICATIONS.includes(classification);
}

export const campusAlertsBillingModeSchema = z.enum([
  "nexcort_managed",
  "university_managed_provider",
]);
export type CampusAlertsBillingMode = z.infer<typeof campusAlertsBillingModeSchema>;

/** Tenant Campus Alerts settings (CampusAgencyConfig). Default off. */
export const campusAlertsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  selfRegistrationEnabled: z.boolean().default(true),
  registrationValidityDays: z.number().int().min(30).max(730).default(365),
  /**
   * Non-SMS renewal outreach (email templates, newsletter copy, admin banners).
   * Mass SMS renewal campaigns are forbidden under emergency-only policy.
   */
  renewalOutreachEnabled: z.boolean().default(true),
  /** @deprecated Mass SMS renewals removed — kept for config parse compatibility; ignored. */
  remindersEnabled: z.boolean().default(false),
  /** @deprecated Ignored — do not schedule SMS at these offsets. */
  reminderDaysBeforeExpiration: z.array(z.number().int().min(1).max(90)).max(5).default([]),
  /** @deprecated Campus-wide SMS renewal campaigns are not allowed. */
  campusWideRenewalCampaignEnabled: z.boolean().default(false),
  /** Emergency mass SMS channel (OTP remains separately authorized). */
  emergencyMassSmsEnabled: z.boolean().default(true),
  smsNotificationsEnabled: z.boolean().default(true),
  retentionDaysAfterExpiration: z.number().int().min(0).max(3650).default(90),
  subscriberExportEnabled: z.boolean().default(false),
  consentTextVersion: z.string().max(64).default(CAMPUS_ALERTS_CONSENT_VERSION),
  notificationContactName: z.string().max(120).optional(),
  campusSafetyPhone: z.string().max(32).optional(),
  publicActiveAlertBannerEnabled: z.boolean().default(true),
  /** When true, confirm requires a second distinct approver. */
  requireDualAuthorization: z.boolean().default(false),
  /** ALL_CLEAR may use mass SMS only when university enables it (default true). */
  allClearMassSmsEnabled: z.boolean().default(true),
  contractualBillingMode: campusAlertsBillingModeSchema.default("nexcort_managed"),
  /**
   * Illustrative / contractual rate used for pre-send estimates (USD per SMS segment).
   * Not a universal fixed price — operators must set from the service agreement.
   */
  estimatedRatePerSegmentUsd: z.number().min(0).max(5).default(0.01),
  billingCostDisclaimer: z
    .string()
    .max(500)
    .default(
      "Estimates are illustrative. Actual charges depend on carrier fees, message length, encoding, and your service agreement.",
    ),
});
export type CampusAlertsConfig = z.infer<typeof campusAlertsConfigSchema>;

export const startCampusAlertsVerifyBodySchema = z.object({
  qrId: z.string().min(1).max(64),
  phone: z.string().min(7).max(32),
  smsConsent: z.literal(true),
  medium: z.enum(["qr", "nfc", "direct", "url"]).default("qr"),
});
export type StartCampusAlertsVerifyBody = z.infer<typeof startCampusAlertsVerifyBodySchema>;

export const confirmCampusAlertsOtpBodySchema = z.object({
  challengeId: z.string().min(8).max(128),
  code: z.string().regex(/^\d{6}$/),
});
export type ConfirmCampusAlertsOtpBody = z.infer<typeof confirmCampusAlertsOtpBodySchema>;

export const renewCampusAlertsBodySchema = z.object({
  challengeId: z.string().min(8).max(128),
  renew: z.literal(true),
});

export const registerCampusAlertsBodySchema = z.object({
  challengeId: z.string().min(8).max(128),
  path: z.enum(["first_registration", "changed_number"]),
  previousPhone: z.string().min(7).max(32).optional(),
  previousPhoneAccessible: z.boolean().optional(),
  previousChallengeId: z.string().min(8).max(128).optional(),
  previousCode: z.string().regex(/^\d{6}$/).optional(),
});

export const previewEmergencyBroadcastBodySchema = z.object({
  classification: campusAlertBroadcastClassificationSchema,
  messageBody: z.string().trim().min(1).max(1000),
  targetSiteCodes: z.array(z.string().min(1).max(32)).max(50).optional(),
  affectedAreasLabel: z.string().trim().max(200).optional(),
});
export type PreviewEmergencyBroadcastBody = z.infer<typeof previewEmergencyBroadcastBodySchema>;

export const confirmEmergencyBroadcastBodySchema = z.object({
  previewId: z.string().min(8).max(128),
  classification: campusAlertBroadcastClassificationSchema,
  messageBody: z.string().trim().min(1).max(1000),
  /** Must match preview recipient count — material drift requires a new preview. */
  expectedRecipientCount: z.number().int().min(0).max(5_000_000),
  /** Must match preview estimated segments within tolerance. */
  expectedEstimatedSegments: z.number().int().min(0).max(50_000_000),
  billingAcknowledgment: z.literal(true),
  emergencyConfirmation: z.literal(true),
  /** Required when tenant.requireDualAuthorization is true. */
  approvedByUserId: z.string().min(1).max(128).optional(),
});
export type ConfirmEmergencyBroadcastBody = z.infer<typeof confirmEmergencyBroadcastBodySchema>;

export type CampusAlertSubscriptionPublic = {
  status: CampusAlertSubscriptionStatus;
  maskedPhone: string;
  universityName: string;
  renewalDueAt?: string;
  subscriptionExpiresAt?: string;
  alreadyRegistered: boolean;
};

export type CampusAlertSubscriptionStaff = {
  subscriptionId: string;
  agencyId: string;
  siteCodes?: string[];
  status: CampusAlertSubscriptionStatus;
  maskedPhone: string;
  registrationCreatedAt: string;
  lastVerifiedAt?: string;
  lastRenewedAt?: string;
  renewalDueAt?: string;
  subscriptionExpiresAt?: string;
  consentGrantedAt?: string;
  consentVersion?: string;
  sourceSafetyPointId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CampusAlertsEmergencyCostEstimate = {
  recipientCount: number;
  segmentsPerMessage: number;
  estimatedSegments: number;
  estimatedRatePerSegmentUsd: number;
  estimatedTotalCostUsd: number;
  encoding: "gsm7" | "ucs2";
  isEstimate: true;
  costAssumptions: string;
  contractualBillingMode: CampusAlertsBillingMode;
};

export type CampusAlertsEmergencyPreview = {
  previewId: string;
  universityName: string;
  authorizedSender: string;
  classification: CampusAlertBroadcastClassification;
  affectedAreasLabel: string;
  messagePreview: string;
  expiresAt: string;
  cost: CampusAlertsEmergencyCostEstimate;
  requireDualAuthorization: boolean;
};

export type CampusAlertsUsageRecordStaff = {
  campaignId: string;
  agencyId: string;
  emergencyClassification: CampusAlertBroadcastClassification;
  initiatedBy: string;
  approvedBy?: string;
  recipientCount: number;
  estimatedSegments: number;
  submittedSegments: number;
  estimatedCostUsd: number;
  reconciledCostUsd?: number;
  billingPeriod: string;
  contractualBillingMode: CampusAlertsBillingMode;
  status: "queued" | "submitted" | "partial" | "failed" | "canceled";
  createdAt: string;
  confirmedAt?: string;
};
