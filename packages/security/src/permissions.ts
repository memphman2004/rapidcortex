import type { UserRole } from "rapid-cortex-shared/types";
import {
  RCSUPERADMIN_ONLY_PERMISSIONS,
  ROLE_ACCESS_MATRIX_V2,
  type MatrixRole,
} from "./role-access-matrix-v2.js";

/**
 * Fine-grained permissions aligned with Rapid Cortex Role Access Matrix v2.0.
 * `rcsuperadmin` rows are immutable at the API layer.
 */
export const ALL_PERMISSIONS = [
  "agency.api_keys",
  "agency.notices",
  "agency.onboard",
  "analysis.delete",
  "analysis.export",
  "analysis.override",
  "analysis.request",
  "analysis.view",
  "audit.access_reports",
  "audit.cad_writeback",
  "audit.export",
  "audit.view",
  "billing.addons",
  "billing.export",
  "billing.manage",
  "billing.revenue_view",
  "billing.usage_view",
  "campus.analytics.view",
  "campus.buildings.manage",
  "campus.buildings.view",
  "campus.cameras.view",
  "campus.clery.manage",
  "campus.clery.view",
  "campus.dashboard.view",
  "campus.incidents.assign",
  "campus.incidents.create",
  "campus.incidents.escalate",
  "campus.incidents.refer",
  "campus.incidents.resolve",
  "campus.incidents.update",
  "campus.incidents.view",
  "locations.qrcodes.manage",
  "locations.qrcodes.view",
  "campus.reports.export",
  "campus.reports.view",
  "campus.settings.manage",
  "campus.settings.view",
  "campus.staff.manage",
  "campus.wellness.create",
  "campus.wellness.view",
  "cad.approve",
  "cad.audit_view",
  "cad.queue_view",
  "cad.reject",
  "cad.submit",
  "command.pir_create",
  "command.pir_view",
  "command.status_pages",
  "command.timeline_view",
  "emergency_connect.manage",
  "emergency_connect.view",
  "emergency_connect.hospital_manage",
  "emergency_connect.prealert_acknowledge",
  "emergency_connect.prealert_create",
  "emergency_connect.prealert_send",
  "hospital_routing.manage",
  "hospital_routing.view",
  "hospital_routing.capacity_manage",
  "hospital_routing.mci_plan",
  "hospital_routing.analytics_view",
  "hospital_portal.capacity_update",
  "hospital_portal.view",
  "hospital_portal.users_manage",
  "hospital_portal.analytics_view",
  "command.war_room_create",
  "command.war_room_join",
  "grants.issue",
  "grants.revoke",
  "grants.view",
  "incidents.close",
  "incidents.create",
  "incidents.delete",
  "incidents.escalate",
  "incidents.reassign",
  "incidents.update",
  "incidents.view",
  "incidents.view_all",
  "integrations.api_keys",
  "integrations.manage",
  "integrations.test",
  "integrations.view",
  "integrations.webhooks",
  "qa.coaching_create",
  "qa.coaching_view",
  "qa.scorecards_ack",
  "qa.scorecards_create",
  "qa.scorecards_view",
  "qa.trends",
  "reports.create",
  "reports.export",
  "reports.schedule",
  "reports.sla_config",
  "reports.view",
  "system.agreements",
  "system.compliance",
  "system.dev_portal",
  "system.feature_flags",
  "system.impersonate",
  "system.infra_diagnostics",
  "system.mfa_policy",
  "system.platform_health",
  "system.retention",
  "system.settings_edit",
  "system.settings_view",
  "system.tenant_mgmt",
  "transcripts.delete",
  "transcripts.download",
  "transcripts.redact",
  "transcripts.view",
  "users.create",
  "users.deactivate",
  "users.deactivate_emergency",
  "users.manage_permissions",
  "users.manage_roles",
  "users.provision_dispatcher",
  "users.reset_mfa",
  "users.reset_password",
  "users.resend_invite",
  "users.unlock",
  "users.update",
  "users.view",
  "users.view_activity",
  "workspace.caller_media",
  "workspace.live_call",
  "workspace.live_video",
  "workspace.silent_monitor",
  "workspace.supervisor_assist",
  "workspace.transcription",
  "workspace.translation",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

const F = false;
const T = true;

function fullTrue(): Record<Permission, boolean> {
  return Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, true])) as Record<Permission, boolean>;
}

function maskFromList(allowed: readonly Permission[]): Record<Permission, boolean> {
  const base = Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, F])) as Record<Permission, boolean>;
  for (const p of allowed) {
    if ((ALL_PERMISSIONS as readonly string[]).includes(p)) {
      base[p] = T;
    }
  }
  return base;
}

/** Hospital portal grants (outside PDF matrix — unchanged). */
const HOSPITAL_ADMIN_PERMISSIONS: Permission[] = [
  "hospital_portal.view",
  "hospital_portal.capacity_update",
  "hospital_portal.analytics_view",
  "hospital_portal.users_manage",
];

const HOSPITAL_STAFF_PERMISSIONS: Permission[] = [
  "hospital_portal.view",
  "hospital_portal.capacity_update",
];

function buildMatrixRolePermissions(role: MatrixRole): Record<Permission, boolean> {
  return maskFromList(ROLE_ACCESS_MATRIX_V2[role]);
}

/** Role Access Matrix v2.0 — default grants per canonical role. */
export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, Record<Permission, boolean>> = {
  rcsuperadmin: fullTrue(),
  rcadmin: buildMatrixRolePermissions("rcadmin"),
  rcitadmin: buildMatrixRolePermissions("rcitadmin"),
  agencyadmin: buildMatrixRolePermissions("agencyadmin"),
  agencyit: buildMatrixRolePermissions("agencyit"),
  supervisor: buildMatrixRolePermissions("supervisor"),
  dispatcher: buildMatrixRolePermissions("dispatcher"),
  analyst: buildMatrixRolePermissions("analyst"),
  auditor: buildMatrixRolePermissions("auditor"),
  hospitaladmin: maskFromList(HOSPITAL_ADMIN_PERMISSIONS),
  hospitalstaff: maskFromList(HOSPITAL_STAFF_PERMISSIONS),
  campus_admin: buildMatrixRolePermissions("campus_admin"),
  campus_supervisor: buildMatrixRolePermissions("campus_supervisor"),
  campus_security: buildMatrixRolePermissions("campus_security"),
  campus_counselor: buildMatrixRolePermissions("campus_counselor"),
  campus_faculty: buildMatrixRolePermissions("campus_faculty"),
  venue_admin: buildMatrixRolePermissions("venue_admin"),
  venue_supervisor: buildMatrixRolePermissions("venue_supervisor"),
  venue_security: buildMatrixRolePermissions("venue_security"),
  venue_operator: buildMatrixRolePermissions("venue_operator"),
  venue_guest: buildMatrixRolePermissions("venue_guest"),
  hospital_admin: buildMatrixRolePermissions("hospital_admin"),
  hospital_supervisor: buildMatrixRolePermissions("hospital_supervisor"),
  hospital_staff: buildMatrixRolePermissions("hospital_staff"),
  hospital_coord: buildMatrixRolePermissions("hospital_coord"),
  transit_admin: buildMatrixRolePermissions("transit_admin"),
  transit_supervisor: buildMatrixRolePermissions("transit_supervisor"),
  transit_security: buildMatrixRolePermissions("transit_security"),
  transit_operator: buildMatrixRolePermissions("transit_operator"),
};

export function defaultPermissionForRole(role: UserRole, permission: Permission): boolean {
  return DEFAULT_ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export function roleMayDeleteTranscripts(role: UserRole): boolean {
  return role === "rcsuperadmin";
}

export function isImmutableRolePermissionRole(role: UserRole): boolean {
  return role === "rcsuperadmin";
}

export function isRcsuperadminOnlyPermission(permission: Permission): boolean {
  return (RCSUPERADMIN_ONLY_PERMISSIONS as readonly string[]).includes(permission);
}

export const RCITADMIN_CROSS_TENANT_PERMISSIONS: readonly Permission[] = [
  "users.reset_password",
  "users.unlock",
  "users.reset_mfa",
  "users.resend_invite",
  "users.view_activity",
  "users.deactivate_emergency",
  "users.view",
  "users.create",
  "users.update",
  "users.deactivate",
  "users.manage_roles",
  "users.manage_permissions",
  "users.provision_dispatcher",
  "integrations.view",
  "integrations.manage",
  "integrations.test",
  "system.settings_view",
  "system.mfa_policy",
  "audit.view",
  "audit.export",
  "transcripts.redact",
  "locations.qrcodes.view",
  "locations.qrcodes.manage",
] as const;

export function isRcitadminCrossTenantPermission(permission: Permission): boolean {
  return (RCITADMIN_CROSS_TENANT_PERMISSIONS as readonly string[]).includes(permission);
}
