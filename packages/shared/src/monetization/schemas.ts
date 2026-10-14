import { z } from "zod";
import { BUSINESS_SMS_DISCLOSURE_VERSION } from "./business-sms-consent.js";

export const contactSalesLeadBodySchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().email().max(320),
    phone: z.string().max(40).optional(),
    agencyCompany: z.string().min(1).max(300),
    role: z.string().max(200).optional(),
    customerType: z.enum(["agency", "city", "county", "state", "venue", "campus", "vendor", "other"]),
    interestedIn: z
      .array(
        z.enum([
          "dashboard_platform",
          "api_access",
          "cad_integration",
          "pilot_program",
          "enterprise_statewide",
        ]),
      )
      .min(1),
    estimatedAgencySize: z.string().max(200).optional(),
    message: z.string().max(5000).optional(),
    /** Anti-bot honeypot — omit or empty for legitimate submissions */
    website: z.string().optional(),
    /**
     * Explicit Business Communications SMS opt-in from the website checkbox.
     * Unchecked by default; never treat phone presence alone as consent.
     * Omitted/undefined means not opted in (legacy CRM writers may omit the field).
     */
    smsConsentOptedIn: z.boolean().optional(),
    /** Must match {@link BUSINESS_SMS_DISCLOSURE_VERSION} when opting in. */
    smsConsentDisclosureVersion: z.string().max(64).optional(),
    /** Which public form collected the SMS consent decision. */
    formSource: z.enum(["contact-sales", "demo", "sms-consent"]).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.smsConsentOptedIn !== true) return;
    if (!(v.phone?.trim().length ?? 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A mobile phone number is required when opting in to SMS",
        path: ["phone"],
      });
    }
    const version = v.smsConsentDisclosureVersion?.trim();
    if (!version) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMS disclosure version is required when opting in",
        path: ["smsConsentDisclosureVersion"],
      });
    } else if (version !== BUSINESS_SMS_DISCLOSURE_VERSION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SMS disclosure version is out of date — refresh the page and try again",
        path: ["smsConsentDisclosureVersion"],
      });
    }
  });

export type ContactSalesLeadBody = z.infer<typeof contactSalesLeadBodySchema>;

/**
 * Legacy lowercase CRM status (still written alongside pipelineStage).
 * Expanded to cover all 9 pipeline stages [CR-2][CR-3].
 */
export const salesLeadStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "discovery",
  "proposal",
  "negotiation",
  "pilot",
  "won",
  "lost",
]);
export type SalesLeadStatus = z.infer<typeof salesLeadStatusSchema>;

/** Product package sold / committed for a lead. */
export const salesLeadPackageSoldSchema = z.enum([
  "rc_core",
  "rc_campus",
  "rc_venue",
  "rc_lite",
  "none",
]);
export type SalesLeadPackageSold = z.infer<typeof salesLeadPackageSoldSchema>;

export const SALES_LEAD_PACKAGE_SOLD_LABELS: Record<SalesLeadPackageSold, string> = {
  rc_core: "911 Centers/PSAPs (911)",
  rc_campus: "Campus",
  rc_venue: "Venue",
  rc_lite: "NexCort Lite",
  none: "None",
};

/** @deprecated Prefer patchSalesLeadCrmBodySchema — kept for back-compat. */
export const patchSalesLeadBodySchema = z
  .object({
    status: salesLeadStatusSchema.optional(),
    packageSold: salesLeadPackageSoldSchema.optional(),
    /** Legacy flat notes string — CRM now uses notes[] via POST /notes. */
    notes: z.string().max(8000).optional(),
    assignee: z.string().max(320).optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    phone: z.string().max(40).optional(),
    title: z.string().max(200).optional(),
    agencyName: z.string().max(300).optional(),
    agencyType: z.string().max(100).optional(),
    vertical: z.enum(["rc911", "campus", "venue", "hospital", "transit", "unknown"]).optional(),
    estimatedValue: z.number().min(0).max(100_000_000).optional(),
    probability: z.number().min(0).max(100).optional(),
    assignedTo: z.string().max(320).optional(),
    assignedToName: z.string().max(200).optional(),
    nextAction: z.string().max(500).optional(),
    nextActionDate: z.string().max(64).optional(),
    lostReason: z.string().max(200).optional(),
    selectedFeatureIds: z.array(z.string().min(1).max(80)).max(100).optional(),
    freeOfferings: z.array(z.string().min(1).max(80)).max(50).optional(),
    smsConsentStatus: z.enum(["pending", "opted_in", "opted_out"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });
export type PatchSalesLeadBody = z.infer<typeof patchSalesLeadBodySchema>;

export const publicPricingConfigSchema = z.object({
  showExactPricing: z.boolean().default(false),
});

export type PublicPricingConfig = z.infer<typeof publicPricingConfigSchema>;
