import { z } from "zod";

/** OAuth-style scopes granted to agency API credentials. */
export const externalApiScopeSchema = z.enum([
  "incidents:read",
  "incidents:write",
  "transcript:write",
  "ai:summary",
  "translation:write",
  "media:write",
  "cad:export",
  "reports:read",
  "audit:read",
  "webhooks:manage",
]);

export type ExternalApiScope = z.infer<typeof externalApiScopeSchema>;

export const externalApiClientEnvironmentSchema = z.enum(["sandbox", "production"]);
export type ExternalApiClientEnvironment = z.infer<typeof externalApiClientEnvironmentSchema>;

export const apiClientStatusSchema = z.enum(["active", "disabled", "rotated", "revoked"]);

export type ApiClientStatus = z.infer<typeof apiClientStatusSchema>;

export const oauthClientCredentialsTokenSchema = z.object({
  grant_type: z.literal("client_credentials"),
  client_id: z.string().min(8),
  client_secret: z.string().min(8),
  scope: z.string().optional(),
});

/** Create incident payload for `/api/v1/incidents` (validated before agencyId merge). */
export const externalCreateIncidentBodySchema = z.object({
  title: z.string().min(2).max(500),
  source: z.enum(["manual", "stream", "demo", "cad"]).default("manual"),
  callerAddressLine: z.string().max(500).optional().nullable(),
});

/** Patch incident subset for integrations. */
export const externalPatchIncidentBodySchema = z
  .object({
    title: z.string().min(2).max(500).optional(),
    status: z.enum(["active", "in_progress", "completed", "archived"]).optional(),
    category: z
      .enum([
        "medical",
        "fire",
        "police",
        "welfare_check",
        "domestic_disturbance",
        "unknown",
      ])
      .optional(),
    urgency: z.enum(["critical", "high", "moderate", "low"]).optional(),
    summary: z.string().max(20000).optional(),
    escalationFlag: z.boolean().optional(),
    callerAddressLine: z.string().max(500).optional().nullable(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "At least one field is required" });

export const externalTranslateBodySchema = z.object({
  targetLanguage: z
    .string()
    .min(2)
    .max(20)
    .describe("BCP-47 language tag such as es-US"),
});

export const externalCadExportBodySchema = z.object({
  format: z.enum(["nist_xml", "json"]).optional().default("json"),
});

export const webhookEventTypeSchema = z.enum([
  "incident.created",
  "incident.updated",
  "transcript.received",
  "ai_summary.ready",
  "translation.complete",
  "media.uploaded",
  "cad_export.ready",
  "supervisor.review_requested",
]);
