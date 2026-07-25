import { z } from "zod";

/**
 * NG9-1-1 Additional Data packaging (NENA-STA-012 concepts) for Rapid Cortex.
 * Packages call / caller / location / agency-side enrichments for CAD or EIDO attach.
 */
export const additionalDataProviderSchema = z.enum([
  "rapid_cortex",
  "ring",
  "video_assist",
  "qr_nfc",
  "premise_notes",
  "ai_analysis",
  "silent_text",
  "pinpoint",
  "telematics",
  "iot",
  "other",
]);
export type AdditionalDataProvider = z.infer<typeof additionalDataProviderSchema>;

export const additionalDataItemSchema = z.object({
  itemId: z.string().min(1).max(64),
  provider: additionalDataProviderSchema,
  label: z.string().min(1).max(200),
  contentType: z.enum(["text", "json", "url", "image_ref", "video_ref"]).default("text"),
  /** Text summary or JSON stringified payload (no secrets). */
  value: z.string().max(16000),
  url: z.string().url().max(2000).optional(),
  collectedAt: z.string().min(20),
  expiresAt: z.string().min(20).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});
export type AdditionalDataItem = z.infer<typeof additionalDataItemSchema>;

export const additionalDataPackageSchema = z.object({
  agencyId: z.string().min(1).max(128),
  incidentId: z.string().min(1).max(128),
  packageId: z.string().min(1).max(64),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
  items: z.array(additionalDataItemSchema).max(100),
  /** Flattened CAD-friendly note block */
  cadNoteText: z.string().max(16000).optional(),
});
export type AdditionalDataPackage = z.infer<typeof additionalDataPackageSchema>;

export const additionalDataUpsertBodySchema = z.object({
  items: z.array(additionalDataItemSchema.omit({ itemId: true }).extend({
    itemId: z.string().min(1).max(64).optional(),
  })).min(1).max(100),
  replaceAll: z.boolean().optional().default(false),
});
export type AdditionalDataUpsertBody = z.infer<typeof additionalDataUpsertBodySchema>;

export const additionalDataAutoBuildBodySchema = z.object({
  includeAi: z.boolean().optional().default(true),
  includePremise: z.boolean().optional().default(true),
  includeMediaHints: z.boolean().optional().default(true),
});
export type AdditionalDataAutoBuildBody = z.infer<typeof additionalDataAutoBuildBodySchema>;
