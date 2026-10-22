import { z } from "zod";
import {
  campusRoleFamily,
  resolveCampusInstitutionType as resolveCampusInstitutionTypeFromRole,
} from "../auth/rapid-cortex-roles.js";
import type { CampusInstitutionType } from "./institution-type.js";

/** Who may press Silent Panic. Supervisors acknowledge and close; they do not activate. */
const ACTIVATE_FAMILIES = new Set(["admin", "security", "dispatch"]);
const OPERATE_FAMILIES = new Set(["admin", "security", "dispatch", "supervisor"]);

export const silentPanicActivationSchema = z.object({
  mode: z.enum(["live", "drill"]),
  schoolName: z.string().trim().min(1).max(160),
  buildingName: z.string().trim().min(1).max(160),
  activatedByName: z.string().trim().min(1).max(160),
});

export type SilentPanicActivation = z.infer<typeof silentPanicActivationSchema>;

export type SilentPanicRecord = SilentPanicActivation & {
  activatedById: string;
  /** Always false. This control does not page law enforcement. */
  lawEnforcementPaged: false;
  /** Always false. No siren and no public announcement. */
  audibleAlarm: false;
  acknowledgedAt?: string;
  acknowledgedById?: string;
  acknowledgedByName?: string;
  closedAt?: string;
  closedById?: string;
  closedByName?: string;
};

export function canActivateSilentPanic(role: string | undefined | null): boolean {
  const family = campusRoleFamily(role);
  return family != null && ACTIVATE_FAMILIES.has(family);
}

/** Acknowledge and close. Includes the campus supervisor who owns the console. */
export function canOperateSilentPanic(role: string | undefined | null): boolean {
  const family = campusRoleFamily(role);
  return family != null && OPERATE_FAMILIES.has(family);
}

/**
 * Seat suffix and agency institution must both resolve to K-12.
 * An explicit higher-ed seat stays higher-ed even on a K-12 agency record.
 */
export function isSilentPanicCampus(
  role: string | undefined | null,
  agencyInstitutionType: CampusInstitutionType,
): boolean {
  return resolveCampusInstitutionTypeFromRole(role, agencyInstitutionType) === "k12";
}

export function silentPanicIncidentDescription(input: SilentPanicActivation): string {
  const modeLine =
    input.mode === "drill"
      ? "DRILL — test only. Stays on the campus console. Not a law-enforcement page."
      : "LIVE silent panic. Campus console only. Not a law-enforcement page.";
  return [
    modeLine,
    `School: ${input.schoolName}`,
    `Building: ${input.buildingName}`,
    `Activated by: ${input.activatedByName}`,
    "No siren. No public announcement.",
  ].join("\n");
}

export const SILENT_PANIC_PRODUCT_DOES = [
  "Campus admin, security, and dispatch can press a silent panic control on this console.",
  "Each activation records the school, the building, and who pressed it.",
  "It opens an Active Threat on this campus console. There is no siren and no public announcement.",
  "Drill mode marks the event as a test. It stays on this console.",
  "Activation, acknowledgement, and close are written to the audit log.",
] as const;

export const SILENT_PANIC_DISTRICT_OWNS = [
  "A written agreement with law enforcement and the PSAP. This control does not place a 911 call.",
  "Coverage in every building the district's policy requires, including wall hardware if required.",
  "Staff training and a drill schedule the district runs and records.",
  "Any state filing or approval the district's counsel says is still open.",
] as const;
