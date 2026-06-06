import { z } from "zod";

export const cadVendorSchema = z.enum([
  "motorola_premier_one",
  "tyler_new_world",
  "central_square",
  "hexagon",
  "console_one",
  "generic_webhook",
]);

export const cadIntegrationStatusSchema = z.enum(["active", "inactive", "error", "testing"]);

export const cadConnectionTypeSchema = z.enum(["webhook_inbound", "api_poll", "tcp_feed"]);

export const cadIncidentStatusSchema = z.enum(["active", "pending", "resolved", "cancelled"]);

export const cadPrioritySchema = z.enum(["P1", "P2", "P3", "P4"]);

export const postCadIntegrationBodySchema = z.object({
  vendor: cadVendorSchema,
  connectionType: cadConnectionTypeSchema,
  name: z.string().min(1).max(200),
  config: z.record(z.unknown()).default({}),
});

export const patchCadIntegrationBodySchema = z
  .object({
    status: cadIntegrationStatusSchema.optional(),
    name: z.string().min(1).max(200).optional(),
    config: z.record(z.unknown()).optional(),
    errorMessage: z.string().max(2000).optional(),
    /** When true, issues a new webhook secret; response includes `webhookSecret` once. */
    regenerateToken: z.boolean().optional(),
  })
  .strict();

export const cadIncidentsQuerySchema = z
  .object({
    integrationId: z.string().min(1).max(128).optional(),
    status: cadIncidentStatusSchema.optional(),
    priority: cadPrioritySchema.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    since: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .transform((d) => ({ ...d, from: d.from ?? d.since }));

export type CadVendor = z.infer<typeof cadVendorSchema>;
export type CadIntegrationStatus = z.infer<typeof cadIntegrationStatusSchema>;
export type CadConnectionType = z.infer<typeof cadConnectionTypeSchema>;
export type CadIncidentStatus = z.infer<typeof cadIncidentStatusSchema>;
export type CadPriority = z.infer<typeof cadPrioritySchema>;
export type PostCadIntegrationBody = z.infer<typeof postCadIntegrationBodySchema>;
export type PatchCadIntegrationBody = z.infer<typeof patchCadIntegrationBodySchema>;
export type CadIncidentsQuery = z.infer<typeof cadIncidentsQuerySchema>;

export const cadWritebackBodySchema = z.object({
  narrative: z.string().min(1).max(2000),
  cadNatureCode: z.string().max(50).optional(),
  priority: z.enum(["P1", "P2", "P3", "P4"]).optional(),
  units: z.array(z.string().max(20)).max(20).optional(),
  notes: z.string().max(500).optional(),
});

export type CadWritebackBody = z.infer<typeof cadWritebackBodySchema>;

export const cadWritebackApprovalBodySchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CadWritebackApprovalBody = z.infer<typeof cadWritebackApprovalBodySchema>;

export type CadWritebackAuditRecord = {
  id: string;
  incidentId: string;
  agencyId: string;
  userId: string;
  userEmail: string;
  cadSystem: string;
  integrationId: string;
  action: "created" | "updated" | "cancelled";
  /** Sanitized JSON string (no PII). */
  payload: string;
  /** Response from CAD vendor API (truncated in storage if needed). */
  cadResponse?: string;
  status: "success" | "failed" | "pending_approval" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  errorMessage?: string;
  createdAt: string;
  ttl: number;
};
