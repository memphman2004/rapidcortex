/**
 * Canonical Rapid Cortex RBAC values (JWT `custom:role`, Dynamo user records, audits).
 *
 * Nine official roles — platform (`rc*`) and agency-scoped. Legacy Cognito values
 * normalize via {@link migrateLegacyRapidCortexRoleTokenValue} at token parse only.
 */

export const RAPID_CORTEX_ROLES = [
  "rcsuperadmin",
  "rcadmin",
  "rcitadmin",
  "agencyadmin",
  "agencyit",
  "supervisor",
  "dispatcher",
  "analyst",
  "auditor",
  "hospitaladmin",
  "hospitalstaff",
  "campus_admin",
  "campus_supervisor",
  "campus_security",
  "campus_counselor",
  "campus_faculty",
  "venue_admin",
  "venue_supervisor",
  "venue_security",
  "venue_operator",
  "venue_guest",
  "hospital_admin",
  "hospital_supervisor",
  "hospital_staff",
  "hospital_coord",
  "transit_admin",
  "transit_supervisor",
  "transit_security",
  "transit_operator",
] as const;

export type RapidCortexRole = (typeof RAPID_CORTEX_ROLES)[number];

/** @deprecated Use {@link RAPID_CORTEX_ROLES} */
export const ROLES = RAPID_CORTEX_ROLES;

/** Roles an agency administrator may assign (never RC-internal roles). */
export const AGENCY_ASSIGNABLE_ROLES = [
  "dispatcher",
  "supervisor",
  "agencyadmin",
  "agencyit",
  "analyst",
  "auditor",
] as const;

/** Hospital portal roles assignable by agency or hospital administrators. */
export const HOSPITAL_ASSIGNABLE_ROLES = ["hospitaladmin", "hospitalstaff"] as const;

/** Campus safety roles assignable by CAMPUS_ADMIN (and RC internal operators). */
export const CAMPUS_ASSIGNABLE_ROLES = [
  "CAMPUS_ADMIN",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_SECURITY",
  "CAMPUS_DISPATCH",
] as const;

export type CampusAssignableRole = (typeof CAMPUS_ASSIGNABLE_ROLES)[number];

export type HospitalAssignableRole = (typeof HOSPITAL_ASSIGNABLE_ROLES)[number];

export type AgencyAssignableRole = (typeof AGENCY_ASSIGNABLE_ROLES)[number];

/** Human-readable labels — UI displays */
export const ROLE_LABELS: Record<string, string> = {
  rcsuperadmin: "Platform Owner",
  rcadmin: "RC Operations",
  rcitadmin: "RC IT Admin",
  agencyadmin: "Agency Admin",
  agencyit: "Agency IT",
  supervisor: "Supervisor",
  dispatcher: "Dispatcher",
  analyst: "Analyst",
  auditor: "Auditor",
  hospitaladmin: "Hospital Admin",
  hospitalstaff: "Hospital Staff",
  campus_admin: "Campus Admin",
  campus_supervisor: "Campus Supervisor",
  campus_security: "Campus Security",
  campus_counselor: "Campus Counselor",
  campus_faculty: "Campus Faculty",
  venue_admin: "Venue Admin",
  venue_supervisor: "Venue Supervisor",
  venue_security: "Venue Security",
  venue_operator: "Venue Operator",
  venue_guest: "Venue Guest",
  hospital_admin: "Hospital Admin",
  hospital_supervisor: "Hospital Supervisor",
  hospital_staff: "Hospital Staff",
  hospital_coord: "Hospital Coordinator",
  transit_admin: "Transit Admin",
  transit_supervisor: "Transit Supervisor",
  transit_security: "Transit Security",
  transit_operator: "Transit Operator",
  platform_superadmin: "Platform Owner",
  rc_admin: "RC Operations",
  admin: "Agency Admin",
  it_admin: "Agency IT",
  readonly_auditor: "Auditor",
  commsupervisor: "Supervisor",
};

/** Single-line descriptions — user management UI tooltips */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  rcsuperadmin:
    "Rapid Cortex platform owner. Unrestricted cross-tenant access to all features, agencies, and financial data.",
  rcadmin:
    "Rapid Cortex operations staff. Cross-tenant visibility for support. No financial revenue totals or destructive actions.",
  rcitadmin:
    "Rapid Cortex IT team. Infrastructure diagnostics, platform health, and technical integration management.",
  agencyadmin:
    "Communications center manager. Full agency configuration, user management, billing, QA, and compliance.",
  agencyit:
    "Agency IT director. CAD integration, API keys, security settings, and technical documentation. No live ops.",
  supervisor:
    "Shift supervisor and QA lead. Live team monitoring, CAD approval, scorecards, coaching, and escalation.",
  dispatcher:
    "Frontline telecommunicator. Live call workspace, AI-assisted triage, CAD entry, translation, and caller media.",
  analyst:
    "Quality improvement staff. Read-only analytics, QA trends, compliance reports, and data exports. No live ops.",
  auditor:
    "Compliance auditor. Read-only audit logs, incident records, and compliance exports only. No operational access.",
  hospitaladmin:
    "Hospital administrator. Updates live ER capacity for their facility and may invite hospital staff.",
  hospitalstaff:
    "Hospital staff. Updates live ER capacity and diversion status for their assigned facility.",
  campus_admin:
    "Campus administrator. User management, Clery documentation, zone configuration, and reporting.",
  campus_supervisor:
    "Campus supervisor. Live incident map, active reports, camera feeds, and escalations.",
  campus_security:
    "Campus security officer. QR/SMS reports, two-way chat, evidence intake, and dispatch.",
  campus_counselor:
    "Campus counselor. Welfare check queue, anonymous tip inbox, and chat-only workflows.",
  campus_faculty:
    "Campus faculty. Submit-only portal for reports and status on their own submissions.",
  venue_admin:
    "Venue administrator. Zone setup, staff management, event configuration, and reporting.",
  venue_supervisor:
    "Venue supervisor. Live event dashboard, all zones, camera overview, and escalations.",
  venue_security:
    "Venue security. Fan reports, section/gate view, two-way chat, and camera feeds.",
  venue_operator:
    "Venue operator. Read-only ops view — incident status and unit locations without dispatch.",
  venue_guest:
    "Venue guest. Read-only view of their own submitted report status.",
  hospital_admin:
    "Hospital administrator. Staff management, capacity configuration, and MCI planning.",
  hospital_supervisor:
    "Hospital supervisor. Capacity board, pre-alert queue, and MCI coordination.",
  hospital_staff:
    "Hospital staff. Incoming pre-alerts, patient tracking, and EMS coordination.",
  hospital_coord:
    "Hospital coordinator. EMS liaison — outbound alerts, hospital capacity, and routing.",
  transit_admin:
    "Transit administrator. Route/zone setup, staff management, and reporting.",
  transit_supervisor:
    "Transit supervisor. Live route map, incident overlay, and escalations.",
  transit_security:
    "Transit security. Passenger reports, vehicle/station incidents, and two-way chat.",
  transit_operator:
    "Transit operator. Read-only vehicle status and active incidents on their route.",
};

export const ROLE_DISPLAY_LABELS: Record<RapidCortexRole, string> = {
  dispatcher: ROLE_LABELS.dispatcher,
  supervisor: ROLE_LABELS.supervisor,
  agencyadmin: ROLE_LABELS.agencyadmin,
  agencyit: ROLE_LABELS.agencyit,
  analyst: ROLE_LABELS.analyst,
  auditor: ROLE_LABELS.auditor,
  hospitaladmin: ROLE_LABELS.hospitaladmin,
  hospitalstaff: ROLE_LABELS.hospitalstaff,
  rcsuperadmin: ROLE_LABELS.rcsuperadmin,
  rcadmin: ROLE_LABELS.rcadmin,
  rcitadmin: ROLE_LABELS.rcitadmin,
  campus_admin: ROLE_LABELS.campus_admin,
  campus_supervisor: ROLE_LABELS.campus_supervisor,
  campus_security: ROLE_LABELS.campus_security,
  campus_counselor: ROLE_LABELS.campus_counselor,
  campus_faculty: ROLE_LABELS.campus_faculty,
  venue_admin: ROLE_LABELS.venue_admin,
  venue_supervisor: ROLE_LABELS.venue_supervisor,
  venue_security: ROLE_LABELS.venue_security,
  venue_operator: ROLE_LABELS.venue_operator,
  venue_guest: ROLE_LABELS.venue_guest,
  hospital_admin: ROLE_LABELS.hospital_admin,
  hospital_supervisor: ROLE_LABELS.hospital_supervisor,
  hospital_staff: ROLE_LABELS.hospital_staff,
  hospital_coord: ROLE_LABELS.hospital_coord,
  transit_admin: ROLE_LABELS.transit_admin,
  transit_supervisor: ROLE_LABELS.transit_supervisor,
  transit_security: ROLE_LABELS.transit_security,
  transit_operator: ROLE_LABELS.transit_operator,
};

export function isHospitalPortalRole(role: string): role is HospitalAssignableRole {
  const e = migrateLegacyRapidCortexRoleTokenValue(role) ?? role;
  return e === "hospitaladmin" || e === "hospitalstaff";
}

/** Canonical or product-token hospital admin (facility configuration). */
export function isHospitalAdminPortalRole(role: string | undefined | null): boolean {
  const raw = (role ?? "").trim();
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (raw === "hospitaladmin") return true;
  if (upper === "HOSPITAL_ADMIN") return true;
  if (upper.startsWith("HOSPITAL_") && !upper.includes("STAFF")) return true;
  return (migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw) === "hospitaladmin";
}

/** Canonical or product-token hospital staff (capacity updates). */
export function isHospitalStaffPortalRole(role: string | undefined | null): boolean {
  const raw = (role ?? "").trim();
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (raw === "hospitalstaff") return true;
  if (upper === "HOSPITAL_STAFF") return true;
  if (upper.startsWith("HOSPITAL_") && upper.includes("STAFF")) return true;
  return (migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw) === "hospitalstaff";
}

/** Any hospital portal operator — not a PSAP dispatcher/supervisor role. */
export function isHospitalOperatorRole(role: string | undefined | null): boolean {
  const raw = (role ?? "").trim().toLowerCase();
  if (
    raw === "hospital_admin" ||
    raw === "hospital_supervisor" ||
    raw === "hospital_staff" ||
    raw === "hospital_coord"
  ) {
    return true;
  }
  return isHospitalAdminPortalRole(role) || isHospitalStaffPortalRole(role);
}

/** Role-aware hospital portal home (`/hospital-admin/dashboard` or staff equivalent). */
export function resolveHospitalPortalDashboardHref(role: string | undefined | null): string | null {
  if (isHospitalStaffPortalRole(role)) return "/hospital-staff/dashboard";
  if (isHospitalAdminPortalRole(role)) return "/hospital-admin/dashboard";
  return null;
}

/** Product vertical roles (venue, campus, hospital portal, transit) — not PSAP dispatcher RBAC. */
export function isProductVerticalRoleToken(raw: string | undefined | null): boolean {
  const token = (raw ?? "").trim();
  if (!token) return false;
  const lower = token.toLowerCase();
  const upper = token.toUpperCase();
  return (
    lower.startsWith("venue_") ||
    lower.startsWith("campus_") ||
    lower.startsWith("hospital_") ||
    lower.startsWith("transit_") ||
    upper.startsWith("VENUE_") ||
    upper.startsWith("CAMPUS_") ||
    upper.startsWith("HOSPITAL_") ||
    upper.startsWith("TRANSIT_")
  );
}

/**
 * Session role for JWT → {@link UserContext}. Preserves product vertical tokens before legacy
 * PSAP migration so post-login routing can send venue/campus users to the correct dashboard.
 */
export function normalizeSessionRole(value: string | undefined): RapidCortexRole | string {
  const raw = value?.trim() ?? "";
  if (raw.toLowerCase() === "staff") return "staff";
  const migrated = migrateLegacyRapidCortexRoleTokenValue(raw) ?? "";
  if (migrated && isRapidCortexRole(migrated)) return migrated;
  if (isProductVerticalRoleToken(migrated)) return migrated;
  if (isProductVerticalRoleToken(raw)) return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw.toLowerCase();
  return "dispatcher";
}

/**
 * JWT / Cognito may still emit legacy role strings until user pools are fully migrated.
 * Normalize at token parse boundaries only — do **not** write new assigns with legacy values.
 */
export function migrateLegacyRapidCortexRoleTokenValue(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = raw.trim();
  // Campus / venue / hospital / transit product roles (Cognito may emit SCREAMING_SNAKE).
  if (t === "CAMPUS_ADMIN") return "campus_admin";
  if (t === "CAMPUS_SUPERVISOR") return "campus_supervisor";
  if (t === "CAMPUS_SECURITY" || t === "CAMPUS_DISPATCH") return "campus_security";
  if (t === "CAMPUS_COUNSELOR") return "campus_counselor";
  if (t === "CAMPUS_FACULTY") return "campus_faculty";
  if (t === "VENUE_ADMIN") return "venue_admin";
  if (t === "VENUE_SUPERVISOR") return "venue_supervisor";
  if (t === "VENUE_SECURITY") return "venue_security";
  if (t === "VENUE_OPERATOR") return "venue_operator";
  if (t === "VENUE_GUEST") return "venue_guest";
  if (t === "HOSPITAL_ADMIN") return "hospital_admin";
  if (t === "HOSPITAL_SUPERVISOR") return "hospital_supervisor";
  if (t === "HOSPITAL_STAFF") return "hospital_staff";
  if (t === "HOSPITAL_COORD") return "hospital_coord";
  if (t === "TRANSIT_ADMIN") return "transit_admin";
  if (t === "TRANSIT_SUPERVISOR") return "transit_supervisor";
  if (t === "TRANSIT_SECURITY") return "transit_security";
  if (t === "TRANSIT_OPERATOR") return "transit_operator";
  if (
    t === "platform_superadmin" ||
    t === "superadmin" ||
    t === "rc_admin" ||
    t === "rc_superadmin"
  )
    return "rcsuperadmin";
  if (t === "admin") return "agencyadmin";
  if (t === "it_admin") return "agencyit";
  if (t === "commsupervisor") return "supervisor";
  if (t === "readonly_auditor") return "auditor";
  if (t === "staff") return "staff";
  if (t === "hospital_admin") return "hospitaladmin";
  if (t === "hospital_staff") return "hospitalstaff";
  return t;
}

/** @deprecated Use {@link migrateLegacyRapidCortexRoleTokenValue} */
export const normalizeLegacyRole = migrateLegacyRapidCortexRoleTokenValue;

export function isRapidCortexRole(value: string): value is RapidCortexRole {
  const e = migrateLegacyRapidCortexRoleTokenValue(value) ?? value;
  return (RAPID_CORTEX_ROLES as readonly string[]).includes(e);
}
