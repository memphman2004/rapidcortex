import { z } from "zod";
import { campusIncidentTypeKeySchema } from "./eap-schemas.js";
import { campusSecurityEventSeveritySchema } from "./security-event-schemas.js";

export const campusAutomationSeveritySchema = campusSecurityEventSeveritySchema.exclude(["info"]);

export const campusAutomationRuleMatchSchema = z.object({
  incidentTypes: z.array(campusIncidentTypeKeySchema).max(12).optional(),
  zoneCode: z.string().trim().max(16).optional(),
  minSeverity: campusAutomationSeveritySchema.optional(),
});

export const campusAutomationRuleActionsSchema = z.object({
  /** Canonical JWT role, e.g. `campus_counselor` or `campus_security`. */
  assignRole: z.string().trim().max(64).optional(),
  attachEap: z.boolean().optional(),
  openWarRoom: z.boolean().optional(),
});

export const campusAutomationRuleSchema = z.object({
  ruleId: z.string().min(1).max(64),
  agencyId: z.string().min(1),
  campusCode: z.string().min(2).max(32),
  name: z.string().trim().min(1).max(120),
  active: z.boolean(),
  match: campusAutomationRuleMatchSchema,
  actions: campusAutomationRuleActionsSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const campusAutomationRuleUpsertBodySchema = z.object({
  campusCode: z.string().min(2).max(32),
  rules: z
    .array(
      z.object({
        ruleId: z.string().min(1).max(64).optional(),
        name: z.string().trim().min(1).max(120),
        active: z.boolean().optional().default(true),
        match: campusAutomationRuleMatchSchema,
        actions: campusAutomationRuleActionsSchema,
      }),
    )
    .max(40),
});

export type CampusAutomationRule = z.infer<typeof campusAutomationRuleSchema>;
export type CampusAutomationRuleUpsertBody = z.infer<typeof campusAutomationRuleUpsertBodySchema>;

const SEVERITY_ORDER: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function campusIncidentSeverityFromType(
  type: string,
): "low" | "medium" | "high" | "critical" {
  if (type === "active_threat") return "critical";
  if (type === "medical" || type === "suspicious_activity") return "high";
  if (type === "security" || type === "mental_health") return "medium";
  return "low";
}

export function campusAutomationRuleMatches(
  rule: Pick<CampusAutomationRule, "active" | "match">,
  incident: { type: string; zoneCode?: string | null },
): boolean {
  if (!rule.active) return false;
  const types = rule.match.incidentTypes;
  if (types?.length && !types.includes(incident.type as never)) return false;
  if (rule.match.zoneCode?.trim()) {
    if (norm(rule.match.zoneCode) !== norm(incident.zoneCode)) return false;
  }
  if (rule.match.minSeverity) {
    const have = SEVERITY_ORDER[campusIncidentSeverityFromType(incident.type)] ?? 0;
    const need = SEVERITY_ORDER[rule.match.minSeverity] ?? 0;
    if (have < need) return false;
  }
  return true;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}
