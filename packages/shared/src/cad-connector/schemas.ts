import { z } from "zod";
import {
  CAD_AUTH_TYPES,
  CAD_CONNECTION_MODES,
  CAD_DEPARTMENT_TYPES,
  CAD_VENDOR_IDS,
  CAD_WRITE_BACK_STATUSES,
  UNIFIED_CAD_STATUSES,
} from "./types.js";

export const cadVendorIdSchema = z.enum(CAD_VENDOR_IDS);
export const cadDepartmentTypeSchema = z.enum(CAD_DEPARTMENT_TYPES);
export const cadConnectionModeSchema = z.enum(CAD_CONNECTION_MODES);
export const cadAuthTypeSchema = z.enum(CAD_AUTH_TYPES);
export const unifiedCadStatusSchema = z.enum(UNIFIED_CAD_STATUSES);
export const cadWriteBackStatusSchema = z.enum(CAD_WRITE_BACK_STATUSES);

export const cadFieldTransformSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("uppercase") }),
  z.object({ type: z.literal("lowercase") }),
  z.object({ type: z.literal("trim") }),
  z.object({ type: z.literal("date_iso"), sourceFormat: z.string().min(1).max(64) }),
  z.object({ type: z.literal("code_lookup"), table: z.record(z.string(), z.string()) }),
  z.object({
    type: z.literal("static_value"),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.object({
    type: z.literal("regex_extract"),
    pattern: z.string().min(1).max(256),
    group: z.number().int().min(0).max(20),
  }),
]);

export const cadFieldMappingSchema = z.object({
  mappingId: z.string().min(1).max(64).optional(),
  vendorField: z.string().trim().min(1).max(256),
  rcField: z.string().trim().min(1).max(128),
  transform: cadFieldTransformSchema.optional(),
  required: z.boolean().default(false),
  direction: z.enum(["inbound", "outbound", "both"]).default("both"),
});

export const cadRoutingConditionSchema = z.union([
  z.object({
    field: z.literal("department"),
    operator: z.literal("eq"),
    value: cadDepartmentTypeSchema,
  }),
  z.object({
    field: z.literal("incidentType"),
    operator: z.enum(["eq", "in"]),
    value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  }),
  z.object({
    field: z.literal("zone"),
    operator: z.enum(["eq", "in"]),
    value: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  }),
  z.object({
    field: z.literal("priority"),
    operator: z.enum(["gte", "lte", "eq"]),
    value: z.number().int().min(1).max(5),
  }),
  z.object({
    field: z.literal("callerLocation"),
    operator: z.literal("within_zone"),
    zoneId: z.string().min(1).max(64),
  }),
]);

export const cadRoutingRuleSchema = z.object({
  ruleId: z.string().min(1).max(64).optional(),
  priority: z.number().int().min(1).max(999),
  description: z.string().trim().min(1).max(240),
  conditions: z.array(cadRoutingConditionSchema).max(20),
  targetConnectorId: z.string().min(1).max(64),
  requireSupervisorApproval: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

const pollingIntervalSchema = z.number().int().min(30).max(300);

export const cadConnectorCreateBodySchema = z
  .object({
    vendorId: cadVendorIdSchema,
    displayName: z.string().trim().min(1).max(80),
    department: cadDepartmentTypeSchema,
    connectionMode: cadConnectionModeSchema,
    pollingIntervalSeconds: pollingIntervalSchema.optional(),
    baseUrl: z.string().trim().url().max(512),
    authType: cadAuthTypeSchema,
    apiKey: z.string().min(1).max(4096).optional(),
    username: z.string().min(1).max(256).optional(),
    password: z.string().min(1).max(256).optional(),
    accessToken: z.string().min(1).max(8192).optional(),
    clientCert: z.string().min(1).max(16384).optional(),
    clientKey: z.string().min(1).max(16384).optional(),
    fieldMappings: z.array(cadFieldMappingSchema).max(200).optional(),
    routingRules: z.array(cadRoutingRuleSchema).max(50).optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.connectionMode === "polling" && value.pollingIntervalSeconds == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "pollingIntervalSeconds is required when connectionMode is polling (min 30s)",
        path: ["pollingIntervalSeconds"],
      });
    }
  });

export const cadConnectorUpdateBodySchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  department: cadDepartmentTypeSchema.optional(),
  connectionMode: cadConnectionModeSchema.optional(),
  pollingIntervalSeconds: pollingIntervalSchema.optional(),
  baseUrl: z.string().trim().url().max(512).optional(),
  authType: cadAuthTypeSchema.optional(),
  apiKey: z.string().min(1).max(4096).optional(),
  username: z.string().min(1).max(256).optional(),
  password: z.string().min(1).max(256).optional(),
  accessToken: z.string().min(1).max(8192).optional(),
  clientCert: z.string().min(1).max(16384).optional(),
  clientKey: z.string().min(1).max(16384).optional(),
  enabled: z.boolean().optional(),
});

export const cadFieldMappingsPutBodySchema = z.object({
  mappings: z.array(cadFieldMappingSchema).max(200),
});

export const cadRoutingRulesPutBodySchema = z.object({
  rules: z.array(cadRoutingRuleSchema).max(50),
});

export const cadWriteBackSubmitBodySchema = z.object({
  unifiedId: z.string().trim().min(1).max(64),
  payload: z.object({
    action: z.enum(["update_status", "add_narrative", "assign_unit", "close_incident", "custom"]),
    fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    narrative: z.string().trim().max(4000).optional(),
  }),
});

export const cadWriteBackRejectBodySchema = z.object({
  reason: z.string().trim().min(20).max(2000),
});

export const cadWriteBackApproveBodySchema = z.object({
  overrideUnhealthy: z.boolean().optional(),
  justification: z.string().trim().min(20).max(2000).optional(),
});

export const cadIncidentListQuerySchema = z.object({
  status: unifiedCadStatusSchema.optional(),
  department: cadDepartmentTypeSchema.optional(),
  connectorId: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(512).optional(),
  activeOnly: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export const cadWriteBackListQuerySchema = z.object({
  status: cadWriteBackStatusSchema.optional(),
  unifiedId: z.string().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(512).optional(),
});

export const cadAuditListQuerySchema = z.object({
  connectorId: z.string().min(1).max(64).optional(),
  type: z.string().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).max(512).optional(),
});

export type CadConnectorCreateBody = z.infer<typeof cadConnectorCreateBodySchema>;
export type CadConnectorUpdateBody = z.infer<typeof cadConnectorUpdateBodySchema>;
