import { z } from "zod";

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
  })
  .strict();

export type ContactSalesLeadBody = z.infer<typeof contactSalesLeadBodySchema>;

/** CRM pipeline status for RC Admin Leads inbox. */
export const salesLeadStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
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
  rc_core: "RC Core (911)",
  rc_campus: "RC Campus",
  rc_venue: "RC Venue",
  rc_lite: "RC Lite",
  none: "None",
};

export const patchSalesLeadBodySchema = z
  .object({
    status: salesLeadStatusSchema.optional(),
    packageSold: salesLeadPackageSoldSchema.optional(),
    notes: z.string().max(8000).optional(),
    assignee: z.string().max(320).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.status !== undefined ||
      v.packageSold !== undefined ||
      v.notes !== undefined ||
      v.assignee !== undefined,
    {
      message: "At least one of status, packageSold, notes, or assignee is required",
    },
  );
export type PatchSalesLeadBody = z.infer<typeof patchSalesLeadBodySchema>;

export const publicPricingConfigSchema = z.object({
  showExactPricing: z.boolean().default(false),
});

export type PublicPricingConfig = z.infer<typeof publicPricingConfigSchema>;
