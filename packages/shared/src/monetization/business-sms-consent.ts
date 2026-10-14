/**
 * NexCort iQ Business Communications SMS — website disclosure version.
 * Bump when the public checkbox /sms-consent language for this program changes.
 */
export const BUSINESS_SMS_DISCLOSURE_VERSION = "business-sms-2026-10-13" as const;

export const BUSINESS_SMS_PROGRAM_NAME = "NexCort iQ Business Communications SMS" as const;

/** Checkbox label used on sms-consent, contact-sales, and demo request forms. */
export const BUSINESS_SMS_CONSENT_CHECKBOX_LABEL =
  "I agree to receive one-to-one SMS messages from NexCort iQ regarding my inquiry, requested demonstrations, appointment confirmations, and customer support. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for assistance. Consent is not a condition of purchase." as const;

/** Shown under the SMS checkbox for carrier / Microsoft CTA review. */
export const BUSINESS_SMS_NO_SHARE_STATEMENT =
  "Mobile phone numbers and SMS opt-in consent information will not be shared with third parties or affiliates for marketing or promotional purposes." as const;

export type BusinessSmsFormSource = "contact-sales" | "demo" | "sms-consent";

/** CRM / advisor-facing SMS authorization status for a sales lead. */
export const LEAD_SMS_CONSENT_STATUSES = ["pending", "opted_in", "opted_out"] as const;
export type LeadSmsConsentStatus = (typeof LEAD_SMS_CONSENT_STATUSES)[number];

export const LEAD_SMS_CONSENT_STATUS_LABELS: Record<LeadSmsConsentStatus, string> = {
  pending: "Pending",
  opted_in: "Opted in",
  opted_out: "Opted out",
};

/** Public URL advisors share over email / Teams (non-SMS) for opt-in. */
export const BUSINESS_SMS_OPT_IN_FORM_URL =
  "https://www.nexcortiq.us/sms-consent/#opt-in-form" as const;

/** Resolve display status from stored CRM fields (opted_out wins; then explicit/opt-in flag). */
export function resolveLeadSmsConsentStatus(lead: {
  smsConsentStatus?: LeadSmsConsentStatus | null;
  smsConsentOptedIn?: boolean | null;
}): LeadSmsConsentStatus {
  if (lead.smsConsentStatus === "opted_out") return "opted_out";
  if (lead.smsConsentStatus === "opted_in" || lead.smsConsentOptedIn === true) return "opted_in";
  return "pending";
}
