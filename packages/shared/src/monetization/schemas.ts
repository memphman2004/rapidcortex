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

export const publicPricingConfigSchema = z.object({
  showExactPricing: z.boolean().default(false),
});

export type PublicPricingConfig = z.infer<typeof publicPricingConfigSchema>;
