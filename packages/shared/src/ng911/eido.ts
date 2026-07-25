import { z } from "zod";

/**
 * Practical EIDO-compatible envelope for Rapid Cortex ↔ NG9-1-1 / CAD partners.
 * Subset of NENA-STA-021 concepts (not a claim of full schema compliance).
 * Authoritative OpenAPI lives on NENA GitHub; we map RC incidents to this shape.
 */
export const eidoAgencySchema = z.object({
  agencyId: z.string().min(1).max(128),
  agencyName: z.string().max(200).optional(),
  agencyType: z.string().max(64).optional(),
});

export const eidoLocationSchema = z.object({
  locationType: z.enum(["civic", "geodetic", "unknown"]).default("unknown"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  civicAddress: z.string().max(500).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(64).optional(),
  postalCode: z.string().max(32).optional(),
  country: z.string().max(64).optional(),
  locationDescription: z.string().max(1000).optional(),
});

export const eidoCallSchema = z.object({
  callId: z.string().max(128).optional(),
  callStartTime: z.string().min(20).optional(),
  callEndTime: z.string().min(20).optional(),
  callerPhoneE164: z.string().max(32).optional(),
  callLanguage: z.string().max(32).optional(),
  mediaTypes: z.array(z.enum(["voice", "text", "video", "data"])).optional(),
});

export const eidoIncidentStatusSchema = z.enum([
  "created",
  "active",
  "closed",
  "cancelled",
  "unknown",
]);

export const eidoDocumentSchema = z.object({
  /** NENA-style type hint */
  eidoType: z.literal("EmergencyIncidentDataObject").default("EmergencyIncidentDataObject"),
  eidoVersion: z.string().default("RC-1.0"),
  incidentId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  incidentNumber: z.string().max(128).optional(),
  status: eidoIncidentStatusSchema.default("active"),
  createdAt: z.string().min(20),
  updatedAt: z.string().min(20),
  closedAt: z.string().min(20).optional(),
  priority: z.string().max(32).optional(),
  incidentType: z.string().max(120).optional(),
  incidentSubtype: z.string().max(120).optional(),
  summary: z.string().max(4000).optional(),
  notes: z.string().max(8000).optional(),
  agency: eidoAgencySchema.optional(),
  location: eidoLocationSchema.optional(),
  call: eidoCallSchema.optional(),
  /** Opaque extension bag for partner-specific fields */
  extensions: z.record(z.string(), z.unknown()).optional(),
  /** RC provenance */
  sourceSystem: z.literal("rapid-cortex").default("rapid-cortex"),
  sourceIncidentId: z.string().max(128).optional(),
});
export type EidoDocument = z.infer<typeof eidoDocumentSchema>;

export const eidoImportBodySchema = z.object({
  eido: eidoDocumentSchema,
  /** When true, create a new RC incident if sourceIncidentId missing */
  createIncidentIfMissing: z.boolean().optional().default(false),
});
export type EidoImportBody = z.infer<typeof eidoImportBodySchema>;

export const eidoExportQuerySchema = z.object({
  includeAdditionalData: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});
