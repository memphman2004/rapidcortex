import type { UserRole } from "rapid-cortex-shared/types";
import type { Permission } from "./permissions.js";

/**
 * Canonical grants from Rapid Cortex Role Access Matrix v2.0 (PDF).
 * `o` (immutable) rows resolve to rcsuperadmin-only at enforcement time.
 * Hospital roles are maintained separately — not defined in the PDF matrix.
 */
export type MatrixRole = Exclude<
  UserRole,
  "hospitaladmin" | "hospitalstaff" | "rcsuperadmin"
>;

export const CAMPUS_ROLE_BASE_MAP = {
  CAMPUS_ADMIN: "agencyadmin",
  CAMPUS_SUPERVISOR: "supervisor",
  CAMPUS_SECURITY: "dispatcher",
  CAMPUS_DISPATCH: "dispatcher",
  CAMPUS_COUNSELOR: "analyst",
  CAMPUS_FACULTY: "auditor",
} as const satisfies Record<string, MatrixRole>;

export type CampusRoleAlias = keyof typeof CAMPUS_ROLE_BASE_MAP;

// ── CAMPUS ROLES ──────────────────────────────────────────────────────────
// Campus safety staff for universities, colleges, and K-12 campuses.
// These roles are scoped to a single campus (campusCode).
// They do NOT have access to Core (911) dispatch workflows.
export const CAMPUS_ROLES = [
  "CAMPUS_ADMIN",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_SECURITY",
  "CAMPUS_DISPATCH",
  "CAMPUS_COUNSELOR",
  "CAMPUS_FACULTY",
] as const;

export type CampusRole = (typeof CAMPUS_ROLES)[number];

export function isCampusRole(role: string): role is CampusRole {
  return (CAMPUS_ROLES as readonly string[]).includes(role);
}

export const CAMPUS_ROLE_PERMISSIONS: Record<CampusRole, string[]> = {
  CAMPUS_ADMIN: [
    "campus.dashboard.view",
    "campus.incidents.view",
    "campus.incidents.create",
    "campus.incidents.update",
    "campus.incidents.assign",
    "campus.incidents.resolve",
    "campus.incidents.escalate",
    "campus.incidents.refer",
    "campus.reports.view",
    "campus.reports.export",
    "campus.wellness.view",
    "campus.wellness.create",
    "campus.analytics.view",
    "campus.buildings.view",
    "campus.buildings.manage",
    "locations.qrcodes.view",
    "locations.qrcodes.manage",
    "campus.cameras.view",
    "campus.settings.view",
    "campus.settings.manage",
    "campus.clery.view",
    "campus.clery.manage",
    "campus.staff.manage",
  ],
  CAMPUS_SUPERVISOR: [
    "campus.dashboard.view",
    "campus.incidents.view",
    "campus.incidents.create",
    "campus.incidents.update",
    "campus.incidents.assign",
    "campus.incidents.resolve",
    "campus.incidents.escalate",
    "campus.incidents.refer",
    "campus.reports.view",
    "campus.reports.export",
    "campus.wellness.view",
    "campus.wellness.create",
    "campus.analytics.view",
    "campus.buildings.view",
    "locations.qrcodes.view",
    "campus.cameras.view",
    "campus.settings.view",
    "campus.clery.view",
  ],
  CAMPUS_SECURITY: [
    "campus.dashboard.view",
    "campus.incidents.view",
    "campus.incidents.create",
    "campus.incidents.update",
    "campus.incidents.assign",
    "campus.incidents.resolve",
    "campus.reports.view",
    "campus.buildings.view",
    "locations.qrcodes.view",
    "campus.cameras.view",
  ],
  CAMPUS_DISPATCH: [
    "campus.dashboard.view",
    "campus.incidents.view",
    "campus.incidents.create",
    "campus.incidents.update",
    "campus.reports.view",
    "campus.buildings.view",
  ],
  CAMPUS_COUNSELOR: [
    "campus.dashboard.view",
    "campus.wellness.view",
    "campus.wellness.create",
    "campus.reports.view",
  ],
  CAMPUS_FACULTY: ["campus.dashboard.view", "campus.reports.view"],
};

export function canCampusRolePerform(role: CampusRole, permission: string): boolean {
  return CAMPUS_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ── VENUE ROLES ───────────────────────────────────────────────────────────
export const VENUE_ROLES = [
  "VENUE_ADMIN",
  "VENUE_SUPERVISOR",
  "VENUE_SECURITY",
  "VENUE_OPERATOR",
  "VENUE_GUEST_SERVICES",
] as const;

export type VenueRole = (typeof VENUE_ROLES)[number];

export function isVenueRole(role: string): role is VenueRole {
  return (VENUE_ROLES as readonly string[]).includes(role);
}

export const VENUE_ROLE_PERMISSIONS: Record<VenueRole, string[]> = {
  VENUE_ADMIN: ["locations.qrcodes.manage", "locations.qrcodes.view"],
  VENUE_SUPERVISOR: ["locations.qrcodes.view"],
  VENUE_SECURITY: [],
  VENUE_OPERATOR: [],
  VENUE_GUEST_SERVICES: [],
};

export function canVenueRolePerform(role: VenueRole, permission: string): boolean {
  return VENUE_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Hospital + emergency-connect grants (product modules outside the PDF matrix). */
const EMERGENCY_CONNECT_VIEW: readonly Permission[] = ["emergency_connect.view"] as const;

const EMERGENCY_CONNECT_MANAGE: readonly Permission[] = [
  "emergency_connect.manage",
  "emergency_connect.hospital_manage",
  "emergency_connect.prealert_acknowledge",
  "emergency_connect.prealert_create",
  "emergency_connect.prealert_send",
] as const;

const EMERGENCY_CONNECT_OPERATIONS: readonly Permission[] = [
  "emergency_connect.prealert_acknowledge",
  "emergency_connect.prealert_create",
  "emergency_connect.prealert_send",
] as const;

const HOSPITAL_ROUTING_VIEW: readonly Permission[] = ["hospital_routing.view"] as const;

const HOSPITAL_ROUTING_MANAGE: readonly Permission[] = [
  "hospital_routing.manage",
  "hospital_routing.capacity_manage",
  "hospital_routing.mci_plan",
] as const;

const HOSPITAL_ROUTING_FULL: readonly Permission[] = [
  ...HOSPITAL_ROUTING_VIEW,
  ...HOSPITAL_ROUTING_MANAGE,
  "hospital_routing.analytics_view",
] as const;

const HOSPITAL_ROUTING_VIEW_ANALYTICS: readonly Permission[] = [
  ...HOSPITAL_ROUTING_VIEW,
  "hospital_routing.analytics_view",
] as const;

/** Core PSAP matrix roles from the v2.0 PDF (vertical product roles inherit below). */
const CORE_ROLE_ACCESS_MATRIX_V2 = {
  rcadmin: [
    "system.tenant_mgmt",
    "system.platform_health",
    "system.agreements",
    "system.dev_portal",
    "billing.manage",
    "billing.addons",
    "billing.usage_view",
    "agency.onboard",
    "agency.notices",
    "agency.api_keys",
    "locations.qrcodes.view",
    "locations.qrcodes.manage",
    "audit.view",
    "audit.export",
    "audit.access_reports",
    "grants.view",
    "users.view_activity",
    ...HOSPITAL_ROUTING_VIEW_ANALYTICS,
  ],
  rcitadmin: [
    "system.tenant_mgmt",
    "system.infra_diagnostics",
    "system.platform_health",
    "system.settings_view",
    "system.mfa_policy",
    "agency.onboard",
    "billing.usage_view",
    "locations.qrcodes.view",
    "locations.qrcodes.manage",
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
    "audit.view",
    "audit.export",
    "transcripts.redact",
  ],
  agencyadmin: [
    "users.view",
    "users.create",
    "users.update",
    "users.deactivate",
    "users.manage_roles",
    "users.manage_permissions",
    "users.provision_dispatcher",
    "users.view_activity",
    "incidents.view",
    "incidents.view_all",
    "incidents.create",
    "incidents.update",
    "incidents.close",
    "incidents.reassign",
    "incidents.escalate",
    "incidents.delete",
    "analysis.view",
    "analysis.request",
    "analysis.export",
    "analysis.delete",
    "analysis.override",
    "cad.submit",
    "cad.approve",
    "cad.reject",
    "cad.queue_view",
    "cad.audit_view",
    "reports.create",
    "reports.export",
    "reports.schedule",
    "reports.sla_config",
    "integrations.view",
    "integrations.manage",
    "integrations.test",
    "integrations.api_keys",
    "integrations.webhooks",
    "system.settings_view",
    "system.settings_edit",
    "system.compliance",
    "system.retention",
    "audit.view",
    "audit.cad_writeback",
    "audit.access_reports",
    ...EMERGENCY_CONNECT_MANAGE,
    ...EMERGENCY_CONNECT_VIEW,
    ...HOSPITAL_ROUTING_FULL,
  ],
  agencyit: [
    "users.view",
    "users.view_activity",
    "integrations.view",
    "integrations.manage",
    "integrations.test",
    "integrations.api_keys",
    "integrations.webhooks",
    "system.settings_view",
    "system.mfa_policy",
    "reports.view",
    "audit.view",
    "audit.access_reports",
    ...HOSPITAL_ROUTING_VIEW_ANALYTICS,
    ...EMERGENCY_CONNECT_VIEW,
  ],
  supervisor: [
    "users.view",
    "users.create",
    "users.update",
    "users.deactivate",
    "incidents.view",
    "incidents.view_all",
    "incidents.create",
    "incidents.update",
    "incidents.close",
    "incidents.reassign",
    "incidents.escalate",
    "analysis.view",
    "analysis.request",
    "analysis.export",
    "analysis.override",
    "transcripts.view",
    "transcripts.download",
    "cad.submit",
    "cad.approve",
    "cad.reject",
    "cad.queue_view",
    "cad.audit_view",
    "workspace.live_call",
    "workspace.silent_monitor",
    "workspace.supervisor_assist",
    "workspace.transcription",
    "workspace.translation",
    "workspace.caller_media",
    "workspace.live_video",
    "qa.scorecards_view",
    "qa.scorecards_create",
    "qa.coaching_create",
    "qa.coaching_view",
    "qa.trends",
    "command.war_room_create",
    "command.war_room_join",
    "command.status_pages",
    "command.pir_create",
    "command.pir_view",
    "command.timeline_view",
    "reports.view",
    "reports.create",
    "reports.export",
    "reports.schedule",
    "audit.view",
    "audit.cad_writeback",
    ...EMERGENCY_CONNECT_MANAGE,
    ...EMERGENCY_CONNECT_VIEW,
    ...EMERGENCY_CONNECT_OPERATIONS,
    ...HOSPITAL_ROUTING_VIEW_ANALYTICS,
  ],
  dispatcher: [
    "incidents.view",
    "incidents.create",
    "incidents.update",
    "incidents.close",
    "incidents.reassign",
    "incidents.escalate",
    "analysis.view",
    "analysis.request",
    "analysis.override",
    "transcripts.view",
    "transcripts.download",
    "cad.submit",
    "workspace.live_call",
    "workspace.transcription",
    "workspace.translation",
    "workspace.caller_media",
    "workspace.live_video",
    "qa.scorecards_ack",
    "command.war_room_join",
    "command.timeline_view",
    "reports.view",
    ...EMERGENCY_CONNECT_VIEW,
    ...EMERGENCY_CONNECT_OPERATIONS,
    ...HOSPITAL_ROUTING_VIEW,
  ],
  analyst: [
    "incidents.view",
    "incidents.view_all",
    "analysis.view",
    "analysis.export",
    "transcripts.view",
    "transcripts.download",
    "qa.trends",
    "command.pir_view",
    "command.timeline_view",
    "reports.view",
    "reports.create",
    "reports.export",
    "reports.schedule",
    "audit.view",
    ...HOSPITAL_ROUTING_VIEW_ANALYTICS,
  ],
  auditor: [
    "users.view",
    "users.view_activity",
    "incidents.view",
    "incidents.view_all",
    "transcripts.view",
    "transcripts.download",
    "command.pir_view",
    "command.timeline_view",
    "reports.view",
    "audit.view",
    "audit.export",
    "audit.cad_writeback",
    "audit.access_reports",
    ...HOSPITAL_ROUTING_VIEW_ANALYTICS,
  ],
} as const satisfies Record<
  "rcadmin" | "rcitadmin" | "agencyadmin" | "agencyit" | "supervisor" | "dispatcher" | "analyst" | "auditor",
  readonly Permission[]
>;

type CoreMatrixRole = keyof typeof CORE_ROLE_ACCESS_MATRIX_V2;

/** Vertical product roles inherit grants from the closest core matrix role. */
const VERTICAL_ROLE_MATRIX_BASE: Record<Exclude<MatrixRole, CoreMatrixRole>, CoreMatrixRole> = {
  campus_admin: "agencyadmin",
  campus_supervisor: "supervisor",
  campus_security: "dispatcher",
  campus_counselor: "analyst",
  campus_faculty: "auditor",
  venue_admin: "agencyadmin",
  venue_supervisor: "supervisor",
  venue_security: "dispatcher",
  venue_operator: "dispatcher",
  venue_guest: "auditor",
  hospital_admin: "agencyadmin",
  hospital_supervisor: "supervisor",
  hospital_staff: "auditor",
  hospital_coord: "analyst",
  transit_admin: "agencyadmin",
  transit_supervisor: "supervisor",
  transit_security: "dispatcher",
  transit_operator: "dispatcher",
};

function inheritVerticalMatrix(
  core: typeof CORE_ROLE_ACCESS_MATRIX_V2,
  bases: typeof VERTICAL_ROLE_MATRIX_BASE,
): Record<MatrixRole, readonly Permission[]> {
  const vertical = {} as Record<Exclude<MatrixRole, CoreMatrixRole>, readonly Permission[]>;
  for (const role of Object.keys(bases) as Exclude<MatrixRole, CoreMatrixRole>[]) {
    vertical[role] = core[bases[role]];
  }
  return { ...core, ...vertical };
}

/** Permissions explicitly granted per role in the v2.0 matrix (excluding hospital portal roles). */
export const ROLE_ACCESS_MATRIX_V2: Record<MatrixRole, readonly Permission[]> =
  inheritVerticalMatrix(CORE_ROLE_ACCESS_MATRIX_V2, VERTICAL_ROLE_MATRIX_BASE);

/** rcsuperadmin-only immutable permissions (matrix `o` column). */
export const RCSUPERADMIN_ONLY_PERMISSIONS: readonly Permission[] = [
  "system.feature_flags",
  "system.impersonate",
  "billing.revenue_view",
  "billing.export",
  "grants.issue",
  "grants.revoke",
  "transcripts.delete",
];
