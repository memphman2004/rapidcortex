import { z } from "zod";

export const cadVendorSchema = z.enum([
  "motorola_premier_one",
  "tyler_new_world",
  "central_square",
  "hexagon",
  "console_one",
  "generic_webhook",
]);

export const cadIntegrationStatusSchema = z.enum([
  "active",
  "inactive",
  "error",
  "testing",
  "auth_error",
]);

export const cadCircuitBreakerStateSchema = z.object({
  state: z.enum(["CLOSED", "OPEN", "HALF_OPEN"]),
  failureCount: z.number().int().min(0),
  openedAt: z.string().optional(),
  cooldownUntil: z.string().optional(),
});

export const cadConnectionTypeSchema = z.enum([
  "webhook_inbound",
  "api_poll",
  "tcp_feed",
  "cap_inbound",
]);

export const cadIncidentStatusSchema = z.enum(["active", "pending", "resolved", "cancelled"]);

export const cadPrioritySchema = z.enum(["P1", "P2", "P3", "P4"]);

export const cadLocationSourceSchema = z.enum(["cad", "e911", "ali", "manual"]);
export type CadLocationSource = z.infer<typeof cadLocationSourceSchema>;

export const cadAniAliSourceSchema = z.enum(["e911", "cad", "manual"]);
export type CadAniAliSource = z.infer<typeof cadAniAliSourceSchema>;

/** Assigned unit as received from CAD (read-only intelligence — Rapid Cortex does not dispatch units). */
export const cadUnitAssignmentSchema = z.object({
  unitId: z.string().min(1).max(64),
  unitType: z.string().max(40).optional(),
  status: z.string().max(40).optional(),
  etaSeconds: z.number().int().min(0).max(86_400).optional(),
  beat: z.string().max(40).optional(),
  callSign: z.string().max(40).optional(),
});
export type CadUnitAssignment = z.infer<typeof cadUnitAssignmentSchema>;

export const cadAlertSchema = z.object({
  type: z.string().min(1).max(80),
  text: z.string().min(1).max(500),
});
export type CadAlert = z.infer<typeof cadAlertSchema>;

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
    circuitBreaker: cadCircuitBreakerStateSchema.optional(),
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

export const capIngestStatusSchema = z.enum([
  "received",
  "routed",
  "no_agency",
  "duplicate",
  "skipped",
  "parse_error",
]);

export const cadCapIncidentsQuerySchema = z.object({
  status: capIngestStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type CapIngestStatus = z.infer<typeof capIngestStatusSchema>;
export type CadCapIncidentsQuery = z.infer<typeof cadCapIncidentsQuerySchema>;

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
