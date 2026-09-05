import { z } from "zod";

export const campusIncidentTypeKeySchema = z.enum([
  "medical",
  "security",
  "mental_health",
  "suspicious_activity",
  "wellness_check",
  "property_crime",
  "maintenance",
  "active_threat",
  "other",
]);

export const campusEapSchema = z.object({
  eapId: z.string().min(1).max(64),
  agencyId: z.string().min(1),
  campusCode: z.string().min(2).max(32),
  title: z.string().trim().min(1).max(200),
  /** Building code, or `*` for every building. */
  buildingCode: z.string().trim().min(1).max(50),
  incidentTypes: z.array(campusIncidentTypeKeySchema).min(1).max(12),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(40),
  documentUrl: z.string().url().max(2000).optional().or(z.literal("")),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const campusEapUpsertBodySchema = z.object({
  eapId: z.string().min(1).max(64).optional(),
  campusCode: z.string().min(2).max(32),
  title: z.string().trim().min(1).max(200),
  buildingCode: z.string().trim().min(1).max(50),
  incidentTypes: z.array(campusIncidentTypeKeySchema).min(1).max(12),
  steps: z.array(z.string().trim().min(1).max(500)).min(1).max(40),
  documentUrl: z.string().url().max(2000).optional().or(z.literal("")),
  active: z.boolean().optional().default(true),
});

export const campusEapListQuerySchema = z.object({
  campusCode: z.string().trim().min(2).max(32),
});

export const campusEapMatchQuerySchema = z.object({
  campusCode: z.string().trim().min(2).max(32),
  buildingCode: z.string().trim().min(1).max(50),
  type: campusIncidentTypeKeySchema,
});

export const campusEapChecklistSchema = z.object({
  eapId: z.string(),
  title: z.string(),
  steps: z.array(z.string()),
  documentUrl: z.string().optional(),
});

export type CampusEap = z.infer<typeof campusEapSchema>;
export type CampusEapUpsertBody = z.infer<typeof campusEapUpsertBodySchema>;
export type CampusEapChecklist = z.infer<typeof campusEapChecklistSchema>;

export function matchCampusEap<
  T extends { buildingCode: string; incidentTypes: readonly string[]; active: boolean },
>(eaps: T[], buildingCode: string, incidentType: string): T | null {
  const building = buildingCode.trim().toUpperCase();
  const type = incidentType.trim().toLowerCase();
  const active = eaps.filter(
    (eap) => eap.active && eap.incidentTypes.some((t) => t.toLowerCase() === type),
  );
  return (
    active.find((eap) => eap.buildingCode.trim().toUpperCase() === building) ??
    active.find((eap) => eap.buildingCode.trim() === "*") ??
    null
  );
}
