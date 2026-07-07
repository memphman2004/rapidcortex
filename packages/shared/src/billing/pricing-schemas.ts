import { z } from "zod";
import { PRICING_KEYS } from "./pricing-defaults.js";

const pricingKeySchema = z.enum(PRICING_KEYS as [string, ...string[]]);

export const pricingOverridesSchema = z.record(pricingKeySchema, z.number().finite());

export const putGlobalPricingBodySchema = z.object({
  overrides: pricingOverridesSchema,
  reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
});

export const putTenantPricingBodySchema = z.object({
  overrides: pricingOverridesSchema,
  reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
});

export const deleteTenantPricingBodySchema = z.object({
  reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
});
