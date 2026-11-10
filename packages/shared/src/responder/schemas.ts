import { z } from "zod";

/** Cognito custom:responder_role values for the field-responder vertical. */
export const RESPONDER_ROLES = ["officer", "firefighter", "ems", "unit_commander"] as const;
export type ResponderRole = (typeof RESPONDER_ROLES)[number];

export const responderRoleSchema = z.enum(RESPONDER_ROLES);

/** Parse Cognito `custom:responder_role` (or JWT claim) into a typed role. */
export function parseResponderRole(value: string | undefined | null): ResponderRole | null {
  const raw = String(value ?? "").trim().toLowerCase().replace(/-/g, "_");
  const parsed = responderRoleSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function isResponderRole(value: string | undefined | null): boolean {
  return parseResponderRole(value) != null;
}

/** Canonical JWT custom:role for iQ Responder dashboard users. */
export const FIELD_RESPONDER_ROLE = "field_responder" as const;

export const responderSubscribeBodySchema = z
  .object({
    action: z.literal("responder-subscribe"),
    incidentId: z.string().min(1).max(128),
  })
  .strict();
export type ResponderSubscribeBody = z.infer<typeof responderSubscribeBodySchema>;

export const audioAuthorizeBodySchema = z
  .object({
    version: z.number().int().nonnegative().optional(),
  })
  .strict()
  .optional();
export type AudioAuthorizeBody = z.infer<typeof audioAuthorizeBodySchema>;

export const responderConnectionSchema = z.object({
  connectionId: z.string().min(1),
  incidentId: z.string().min(1),
  userId: z.string().min(1),
  userRole: responderRoleSchema.or(z.literal(FIELD_RESPONDER_ROLE)),
  agencyId: z.string().min(1),
  displayName: z.string().optional(),
  audioAuthorized: z.boolean(),
  audioAuthorizedAt: z.string().optional(),
  connectedAt: z.string().min(1),
  ttl: z.number().int(),
});
export type ResponderConnection = z.infer<typeof responderConnectionSchema>;

export const responderIncidentUpdatePayloadSchema = z.object({
  type: z.literal("incident_update"),
  incidentId: z.string(),
  priority: z.string().optional(),
  incidentType: z.string().optional(),
  address: z.string().optional(),
  unitAssignments: z.array(z.unknown()).optional(),
  updatedAt: z.string().optional(),
});
export type ResponderIncidentUpdatePayload = z.infer<typeof responderIncidentUpdatePayloadSchema>;
