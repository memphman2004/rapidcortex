import { z } from "zod";
import { alertVerticalSchema } from "../alerts/schemas.js";

export const PHYSICAL_SECURITY_COMMANDS_NOT_IMPLEMENTED =
  "Physical security commands are not implemented. ENABLE_PHYSICAL_SECURITY_COMMANDS defaults off; lock/unlock/grant/revoke/acknowledge write-back is blocked.";

export const physicalSecurityProviderIdSchema = z.enum([
  "mock",
  "genetec-security-center",
  "honeywell-prowatch",
  "generic-webhook",
]);
export type PhysicalSecurityProviderId = z.infer<typeof physicalSecurityProviderIdSchema>;

export const physicalSecurityEventTypeSchema = z.enum([
  "door_forced",
  "door_held",
  "access_denied",
  "panel_alarm",
  "fire_alarm",
]);
export type PhysicalSecurityEventType = z.infer<typeof physicalSecurityEventTypeSchema>;

export const physicalSecurityMapBadgeSchema = z.enum([
  "FIRE_ALARM",
  "DOOR_FORCED",
  "DOOR_HELD",
  "ACCESS_DENIED",
  "PANEL_ALARM",
]);
export type PhysicalSecurityMapBadge = z.infer<typeof physicalSecurityMapBadgeSchema>;

export const PHYSICAL_EVENT_TO_BADGE: Record<PhysicalSecurityEventType, PhysicalSecurityMapBadge> = {
  door_forced: "DOOR_FORCED",
  door_held: "DOOR_HELD",
  access_denied: "ACCESS_DENIED",
  panel_alarm: "PANEL_ALARM",
  fire_alarm: "FIRE_ALARM",
};

export const physicalSecurityEventSchema = z.object({
  eventId: z.string().min(1).max(128),
  agencyId: z.string().min(1).max(128),
  vertical: alertVerticalSchema,
  siteCode: z.string().min(1).max(32),
  providerId: physicalSecurityProviderIdSchema,
  eventType: physicalSecurityEventTypeSchema,
  mapBadge: physicalSecurityMapBadgeSchema,
  zoneCode: z.string().min(1).max(64),
  buildingCode: z.string().max(64).optional(),
  description: z.string().max(2000),
  occurredAt: z.string(),
  vendorEventId: z.string().max(128).optional(),
  incidentId: z.string().max(128).optional(),
  correlatedIncidentIds: z.array(z.string().min(1).max(128)).max(32).default([]),
  createdAt: z.string(),
});
export type PhysicalSecurityEvent = z.infer<typeof physicalSecurityEventSchema>;

export const physicalSecurityIngestBodySchema = z
  .object({
    vertical: alertVerticalSchema,
    agencySlug: z.string().trim().min(2).max(64),
    eventType: physicalSecurityEventTypeSchema,
    zoneCode: z.string().trim().min(1).max(64),
    buildingCode: z.string().trim().max(64).optional(),
    description: z.string().trim().max(2000).optional(),
    occurredAt: z.string().optional(),
    vendorEventId: z.string().trim().max(128).optional(),
    providerId: physicalSecurityProviderIdSchema.optional().default("generic-webhook"),
  })
  .strict();
export type PhysicalSecurityIngestBody = z.infer<typeof physicalSecurityIngestBodySchema>;

export const physicalSecurityCommandActionSchema = z.enum([
  "LOCK_DOORS",
  "UNLOCK_DOORS",
  "GRANT_TEMP",
  "REVOKE",
  "ACK_FIRE",
]);
export type PhysicalSecurityCommandAction = z.infer<typeof physicalSecurityCommandActionSchema>;

export const physicalSecurityCommandBodySchema = z
  .object({
    action: physicalSecurityCommandActionSchema,
    targetIds: z.array(z.string().min(1).max(128)).min(1).max(64),
    approvalToken: z.string().min(1).max(256),
    durationMinutes: z.number().int().positive().max(24 * 60).optional(),
    credentialId: z.string().max(128).optional(),
    resolution: z.string().max(200).optional(),
  })
  .strict();

export type OpenIncidentForCorrelation = {
  incidentId: string;
  zoneCode?: string;
  buildingCode?: string;
  status: string;
  createdAt: string;
};

const OPEN_STATUSES = new Set(["open", "assigned", "responding", "DISPATCHED", "EN ROUTE"]);

export function correlateOpenIncidentsInZone(
  incidents: readonly OpenIncidentForCorrelation[],
  zoneCode: string,
  at: Date,
  windowMinutes = 10,
): string[] {
  const zone = zoneCode.trim().toUpperCase();
  const windowMs = windowMinutes * 60 * 1000;
  const t = at.getTime();
  return incidents
    .filter((row) => {
      if (!OPEN_STATUSES.has(row.status)) return false;
      const loc = (row.zoneCode ?? row.buildingCode ?? "").trim().toUpperCase();
      if (!loc || loc !== zone) return false;
      const created = Date.parse(row.createdAt);
      if (Number.isNaN(created)) return false;
      return t - created >= 0 && t - created <= windowMs;
    })
    .map((row) => row.incidentId);
}
