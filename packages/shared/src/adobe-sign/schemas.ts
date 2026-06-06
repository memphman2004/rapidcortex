import { z } from "zod";
import type { RcLiteKeyTier } from "../rc-lite/programmatic-key.js";

export const adobeSignAgreementTypeSchema = z.enum(["rc_lite", "platform"]);
export type AdobeSignAgreementType = z.infer<typeof adobeSignAgreementTypeSchema>;

export const rcLiteServiceTierSchema = z.enum([
  "dev",
  "small",
  "medium",
  "large",
  "enterprise",
]);
export type RcLiteServiceTier = z.infer<typeof rcLiteServiceTierSchema>;

export function parseRcLiteServiceTier(raw: string | undefined): RcLiteKeyTier {
  const t = rcLiteServiceTierSchema.safeParse(raw?.trim().toLowerCase());
  return t.success ? t.data : "small";
}

/** Parsed Adobe Sign agreement form fields (template field names must match). */
export const adobeSignAgreementFieldsSchema = z.object({
  agreement_type: adobeSignAgreementTypeSchema,
  customer_legal_name: z.string().min(1).max(300),
  technical_contact_name: z.string().min(1).max(200).optional(),
  technical_contact_email: z.string().email(),
  signer_email: z.string().email().optional(),
  service_tier: rcLiteServiceTierSchema.optional(),
  use_case_description: z.string().max(4000).optional(),
  agency_jurisdiction: z.string().max(200).optional(),
  cad_vendor: z.string().max(200).optional(),
  purchase_order_number: z.string().max(120).optional(),
});

export type AdobeSignAgreementFields = z.infer<typeof adobeSignAgreementFieldsSchema>;

export const rcAdminProvisioningInvokeSchema = z.object({
  source: z.literal("adobe_sign_webhook"),
  action: z.enum(["auto_provision", "platform_notify"]),
  agreementId: z.string().min(1).max(200),
  agencyId: z.string().min(1).max(120),
  agreementType: adobeSignAgreementTypeSchema,
  customerName: z.string().min(1).max(300),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email(),
  tier: rcLiteServiceTierSchema.optional(),
  useCaseDesc: z.string().max(4000).optional(),
});

export type RcAdminProvisioningInvoke = z.infer<typeof rcAdminProvisioningInvokeSchema>;

export const pendingProvisionStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "failed",
]);
export type PendingProvisionStatus = z.infer<typeof pendingProvisionStatusSchema>;
