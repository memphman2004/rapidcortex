import { z } from "zod";
import { PSAP_OUTREACH_STATUSES } from "./types.js";

export const psapOutreachStatusSchema = z.enum(PSAP_OUTREACH_STATUSES);

export const psapMailingAddressSchema = z
  .object({
    streetAddress: z.string().trim().max(200).optional(),
    city: z.string().trim().min(1).max(100),
    county: z.string().trim().min(1).max(100),
    state: z.string().trim().length(2),
    zip: z.string().trim().max(20).optional(),
    verified: z.boolean(),
    enrichedAt: z.string().min(1).optional(),
    source: z.enum(["aws_location", "nominatim", "manual", "import"]).optional(),
    formattedAddress: z.string().trim().max(400).optional(),
    confidence: z.enum(["high", "medium", "low"]).optional(),
  })
  .strict();

export const patchPsapProspectBodySchema = z
  .object({
    outreachStatus: psapOutreachStatusSchema.optional(),
    assignedToUserId: z.string().trim().min(1).max(128).optional(),
    assignedToName: z.string().trim().max(128).optional(),
    primaryContactName: z.string().trim().max(128).optional(),
    primaryContactTitle: z.string().trim().max(128).optional(),
    primaryContactEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
    primaryContactPhone: z.string().trim().max(32).optional(),
    mailingAddress: psapMailingAddressSchema.partial().optional(),
    website: z.string().trim().url().max(400).optional().or(z.literal("")),
    notes: z.string().trim().max(8000).optional(),
    nextActionDate: z.string().trim().max(40).optional(),
    nextActionNote: z.string().trim().max(500).optional(),
    estimatedValue: z.number().int().min(0).max(100_000_000_00).optional(),
  })
  .strict();

export const addPsapActivityRequestSchema = z
  .object({
    type: z.enum(["call", "email", "mail", "note", "demo", "stage_change"]),
    description: z.string().trim().min(1).max(4000),
    metadata: z.record(z.string(), z.string().max(500)).optional(),
  })
  .strict();

export const psapProspectListQuerySchema = z.object({
  state: z.string().trim().length(2).optional(),
  outreachStatus: psapOutreachStatusSchema.optional(),
  assignedToUserId: z.string().trim().min(1).max(128).optional(),
  search: z.string().trim().max(200).optional(),
  hasAddress: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true" || v === "1";
    }),
  hasContact: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true" || v === "1";
    }),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z
    .enum(["psapName", "state", "outreachStatus", "lastContactedAt", "updatedAt"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  verifiedOnly: z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (typeof v === "boolean") return v;
      return v === "true" || v === "1";
    }),
});
