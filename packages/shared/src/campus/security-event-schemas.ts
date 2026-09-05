import { z } from "zod";
import { campusIncidentTypeKeySchema } from "./eap-schemas.js";

export const campusSecurityEventSourceSchema = z.enum([
  "vms",
  "alpr",
  "alarm",
  "sensor",
  "webhook",
]);

export const campusSecurityEventSeveritySchema = z.enum([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export const campusSecurityEventLocationSchema = z.object({
  buildingCode: z.string().trim().max(50).optional(),
  floor: z.number().int().min(0).max(100).optional(),
  zoneCode: z.string().trim().max(16).optional(),
  qrRcli: z.string().trim().max(32).optional(),
  siteCode: z.string().trim().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const campusSecurityEventBodySchema = z.object({
  campusCode: z.string().trim().min(2).max(20).transform((s) => s.toUpperCase()),
  source: campusSecurityEventSourceSchema,
  type: z.string().trim().min(1).max(64),
  severity: campusSecurityEventSeveritySchema.optional().default("medium"),
  description: z.string().trim().max(2000).optional(),
  location: campusSecurityEventLocationSchema.optional(),
  occurredAt: z.string().datetime().optional(),
  payload: z.record(z.unknown()).optional(),
});

export type CampusSecurityEventSource = z.infer<typeof campusSecurityEventSourceSchema>;
export type CampusSecurityEventBody = z.infer<typeof campusSecurityEventBodySchema>;

const INCIDENT_TYPES = new Set(campusIncidentTypeKeySchema.options);

export function mapSecurityEventTypeToIncidentType(
  raw: string,
): z.infer<typeof campusIncidentTypeKeySchema> {
  const lower = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (INCIDENT_TYPES.has(lower as never)) {
    return lower as z.infer<typeof campusIncidentTypeKeySchema>;
  }
  if (lower.includes("alpr") || lower.includes("lpr") || lower.includes("plate")) return "security";
  if (lower.includes("alarm") || lower.includes("intrusion")) return "security";
  if (lower.includes("gun") || lower.includes("active_threat") || lower.includes("assault")) {
    return "active_threat";
  }
  if (lower.includes("medical") || lower.includes("aed")) return "medical";
  return "other";
}
