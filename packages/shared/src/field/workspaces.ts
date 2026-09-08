/**
 * Field app destinations. Keep in lockstep with `apps/ios-mobile/.../RCRouter.swift`.
 * JWT `custom:role` plus `custom:agencyVertical` (agencyadmin) — never a user picker.
 */

import { migrateLegacyRapidCortexRoleTokenValue } from "../auth/rapid-cortex-roles.js";

export const FIELD_WORKSPACE_IDS = ["campus", "venue", "911-dispatch", "transit"] as const;
export type FieldWorkspaceId = (typeof FIELD_WORKSPACE_IDS)[number];

export const FIELD_ACCESS_TOOL_IDS = ["qr_nfc", "dispatch_ops"] as const;
export type FieldAccessToolId = (typeof FIELD_ACCESS_TOOL_IDS)[number];

export type FieldDestination = "qr_nfc" | "dispatch" | "agency_select" | "no_access";

function normalizeRole(role: string): string {
  const migrated = migrateLegacyRapidCortexRoleTokenValue(role) ?? role.trim();
  return migrated.toLowerCase().replace(/-/g, "_");
}

export function fieldDestinationForAgencyVertical(vertical: string | null | undefined): Exclude<
  FieldDestination,
  "agency_select" | "no_access"
> {
  const v = String(vertical ?? "")
    .trim()
    .toLowerCase();
  if (
    v === "911" ||
    v === "psap" ||
    v === "city" ||
    v === "county" ||
    v === "municipality" ||
    v === "regional_center" ||
    v === "pilot" ||
    v === "state_agency"
  ) {
    return "dispatch";
  }
  return "qr_nfc";
}

/**
 * Post-login Field destination. `director` is not a role. Leftover `commsupervisor` JWTs
 * canonicalize to supervisor via `migrateLegacyRapidCortexRoleTokenValue`.
 */
export function fieldDestinationForRole(
  role: string,
  agencyVertical?: string | null,
): FieldDestination {
  switch (normalizeRole(role)) {
    case "campus_admin":
    case "campus_supervisor":
    case "campus_security":
    case "campus_dispatch":
    case "venue_admin":
    case "venue_supervisor":
    case "venue_operator":
    case "venue_security":
    case "venue_guest_services":
    case "transit_admin":
    case "transit_supervisor":
    case "transit_security":
    case "transit_operator":
      return "qr_nfc";
    case "supervisor":
    case "dispatcher":
    case "analyst":
    case "auditor":
    case "agencyit":
      return "dispatch";
    case "agencyadmin":
      return fieldDestinationForAgencyVertical(agencyVertical);
    case "rcsuperadmin":
    case "rcadmin":
    case "rcitadmin":
      return "agency_select";
    default:
      return "no_access";
  }
}

export function normalizeFieldAccessToolId(raw: string): FieldAccessToolId | null {
  const v = raw.trim().toLowerCase();
  if (v === "qr_nfc" || v === "campus" || v === "venue" || v === "transit") return "qr_nfc";
  if (v === "dispatch_ops" || v === "911-dispatch") return "dispatch_ops";
  return null;
}

export function fieldAccessToolsRequestable(
  role: string,
  agencyVertical?: string | null,
): FieldAccessToolId[] {
  const dest = fieldDestinationForRole(role, agencyVertical);
  if (dest === "agency_select" || dest === "no_access") return [];
  const tools: FieldAccessToolId[] = [];
  if (dest !== "qr_nfc") tools.push("qr_nfc");
  if (dest !== "dispatch") tools.push("dispatch_ops");
  return tools;
}

/**
 * Workspaces granted to a Cognito role for Command API checks.
 * Agency admins keep Command API access; iOS routes them by agencyVertical instead.
 */
export function fieldWorkspacesForRole(role: string): FieldWorkspaceId[] {
  switch (normalizeRole(role)) {
    case "campus_admin":
    case "campus_supervisor":
      return ["campus"];
    case "venue_admin":
    case "venue_supervisor":
    case "venue_operator":
      return ["venue"];
    case "transit_admin":
    case "transit_supervisor":
      return ["transit"];
    case "supervisor":
    case "dispatcher":
    case "analyst":
    case "auditor":
    case "agencyit":
      return ["911-dispatch"];
    case "agencyadmin":
      return ["campus", "venue", "911-dispatch"];
    case "rcsuperadmin":
    case "rcadmin":
    case "rcitadmin":
      return ["campus", "venue", "911-dispatch", "transit"];
    default:
      return [];
  }
}

export function fieldWorkspaceSingle(role: string): FieldWorkspaceId | null {
  const all = fieldWorkspacesForRole(role);
  return all.length === 1 ? (all[0] ?? null) : null;
}

/** @deprecated Prefer {@link fieldAccessToolsRequestable} — tools are described by function, not vertical. */
export function fieldWorkspacesRequestable(role: string, agencyVertical?: string | null): FieldWorkspaceId[] {
  return fieldAccessToolsRequestable(role, agencyVertical).map((tool) =>
    tool === "dispatch_ops" ? "911-dispatch" : "campus",
  );
}

export function isFieldWorkspaceId(value: string): value is FieldWorkspaceId {
  return (FIELD_WORKSPACE_IDS as readonly string[]).includes(value);
}

/** True when the Cognito role is granted the operational (dispatch) Field Command APIs. */
export function fieldRoleHasDispatch911(role: string): boolean {
  return fieldWorkspacesForRole(role).includes("911-dispatch");
}
