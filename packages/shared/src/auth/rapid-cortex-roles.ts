/**
 * Canonical NexCort iQ RBAC values (JWT `custom:role`, Dynamo user records, audits).
 *
 * Platform (`rc*`), PSAP, and product verticals. Legacy Cognito values normalize via
 * {@link migrateLegacyRapidCortexRoleTokenValue} at token parse only.
 *
 * Campus roles are product-suffixed: `*_k12` (school district) vs `*_highered` (university).
 * Unsuffixed legacy tokens (`CAMPUS_ADMIN`, `campus_admin`) alias to the K-12 variant.
 */

import type { CampusInstitutionType } from "../campus/institution-type.js";

export const RAPID_CORTEX_ROLES = [
  "rcsuperadmin",
  "rcadmin",
  "rcitadmin",
  "salescontractor",
  "agencyadmin",
  "agencyit",
  "supervisor",
  "dispatcher",
  "analyst",
  "auditor",
  "hospitaladmin",
  "hospitalstaff",
  "campus_admin_k12",
  "campus_admin_highered",
  "campus_supervisor_k12",
  "campus_supervisor_highered",
  "campus_security_k12",
  "campus_security_highered",
  "campus_dispatch_k12",
  "campus_dispatch_highered",
  "campus_counselor_k12",
  "campus_counselor_highered",
  "campus_faculty_k12",
  "campus_faculty_highered",
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
  "call_assist_admin",
  "call_assist_supervisor",
  "call_assist_operator",
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

/** Campus safety roles assignable by campus admins (and RC internal operators). */
export const CAMPUS_ASSIGNABLE_ROLES = [
  "CAMPUS_ADMIN_K12",
  "CAMPUS_SUPERVISOR_K12",
  "CAMPUS_SECURITY_K12",
  "CAMPUS_DISPATCH_K12",
  "CAMPUS_ADMIN_HIGHERED",
  "CAMPUS_SUPERVISOR_HIGHERED",
  "CAMPUS_SECURITY_HIGHERED",
  "CAMPUS_DISPATCH_HIGHERED",
] as const;

export type CampusAssignableRole = (typeof CAMPUS_ASSIGNABLE_ROLES)[number];

/** Cognito / matrix family (product suffix stripped). */
export const CAMPUS_ROLE_FAMILIES = [
  "admin",
  "supervisor",
  "security",
  "dispatch",
  "counselor",
  "faculty",
] as const;

export type CampusRoleFamily = (typeof CAMPUS_ROLE_FAMILIES)[number];

/** Matrix / Cognito-family keys used by AuthorizationService (product-agnostic). */
export const CAMPUS_MATRIX_ROLE_FAMILIES = [
  "CAMPUS_ADMIN",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_SECURITY",
  "CAMPUS_DISPATCH",
  "CAMPUS_COUNSELOR",
  "CAMPUS_FACULTY",
] as const;

export type CampusMatrixRoleFamily = (typeof CAMPUS_MATRIX_ROLE_FAMILIES)[number];

const CAMPUS_FAMILY_TO_MATRIX: Record<CampusRoleFamily, CampusMatrixRoleFamily> = {
  admin: "CAMPUS_ADMIN",
  supervisor: "CAMPUS_SUPERVISOR",
  security: "CAMPUS_SECURITY",
  dispatch: "CAMPUS_DISPATCH",
  counselor: "CAMPUS_COUNSELOR",
  faculty: "CAMPUS_FACULTY",
};

/** True when role is any campus product token (suffixed, legacy, or Cognito SCREAMING). */
export function isCampusRoleToken(role: string | undefined | null): boolean {
  const raw = (role ?? "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase().replace(/-/g, "_");
  const upper = raw.toUpperCase().replace(/-/g, "_");
  if (lower.startsWith("campus_")) return true;
  if (upper.startsWith("CAMPUS_")) return true;
  if (
    lower === "campusadmin" ||
    lower === "campussecurity" ||
    lower === "campussupervisor" ||
    lower === "campusfaculty" ||
    lower === "campuscounselor" ||
    lower === "campusdispatch"
  ) {
    return true;
  }
  return false;
}

/**
 * Dashboard product from role suffix.
 * Unsuffixed legacy campus roles → `k12` (Camden-compatible).
 * Non-campus roles → `null`.
 */
export function campusProductFromRole(
  role: string | undefined | null,
): CampusInstitutionType | null {
  if (!isCampusRoleToken(role)) return null;
  const normalized = (migrateLegacyRapidCortexRoleTokenValue(role ?? "") ?? role ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (normalized.endsWith("_highered") || normalized.includes("_highered_")) return "higher_ed";
  if (normalized.endsWith("_k12") || normalized.includes("_k12_")) return "k12";
  // Legacy unsuffixed → k12
  if (normalized.startsWith("campus_")) return "k12";
  return "k12";
}

/** Family segment: admin | supervisor | security | dispatch | counselor | faculty. */
export function campusRoleFamily(role: string | undefined | null): CampusRoleFamily | null {
  if (!isCampusRoleToken(role)) return null;
  const normalized = (migrateLegacyRapidCortexRoleTokenValue(role ?? "") ?? role ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  // Strip product suffix
  const base = normalized
    .replace(/_highered$/, "")
    .replace(/_k12$/, "")
    .replace(/^campus_/, "");
  if ((CAMPUS_ROLE_FAMILIES as readonly string[]).includes(base)) {
    return base as CampusRoleFamily;
  }
  return null;
}

/** Map any campus token to matrix family key (`CAMPUS_ADMIN`, …). */
export function campusMatrixRoleFromRole(
  role: string | undefined | null,
): CampusMatrixRoleFamily | null {
  const family = campusRoleFamily(role);
  if (!family) return null;
  return CAMPUS_FAMILY_TO_MATRIX[family];
}

/** Cognito assignable roles for a campus agency product. */
export function campusAssignableRolesForProduct(
  product: CampusInstitutionType,
): CampusAssignableRole[] {
  const suffix = product === "k12" ? "_K12" : "_HIGHERED";
  return CAMPUS_ASSIGNABLE_ROLES.filter((r) => r.endsWith(suffix));
}

/** True when actor is CAMPUS_ADMIN for either product (or legacy unsuffixed). */
export function isCampusAdminRole(role: string | undefined | null): boolean {
  return campusRoleFamily(role) === "admin";
}

/** Transit ops roles assignable by TRANSIT_ADMIN (and RC internal operators). */
export const TRANSIT_ASSIGNABLE_ROLES = [
  "TRANSIT_ADMIN",
  "TRANSIT_SUPERVISOR",
  "TRANSIT_SECURITY",
  "TRANSIT_OPERATOR",
] as const;

export type TransitAssignableRole = (typeof TRANSIT_ASSIGNABLE_ROLES)[number];

/** Cognito group / picker token or snake_case JWT for a transit-assignable role. */
export function isTransitAssignableRole(role: string): boolean {
  const upper = role.trim().toUpperCase().replace(/-/g, "_");
  return (TRANSIT_ASSIGNABLE_ROLES as readonly string[]).includes(upper);
}

/** Call Assist–only tenant roles (no 911 dispatcher workspace). */
export const CALL_ASSIST_ASSIGNABLE_ROLES = [
  "CALL_ASSIST_ADMIN",
  "CALL_ASSIST_SUPERVISOR",
  "CALL_ASSIST_OPERATOR",
] as const;

export type CallAssistAssignableRole = (typeof CALL_ASSIST_ASSIGNABLE_ROLES)[number];

export function isCallAssistAssignableRole(role: string): boolean {
  const upper = role.trim().toUpperCase().replace(/-/g, "_");
  return (CALL_ASSIST_ASSIGNABLE_ROLES as readonly string[]).includes(upper);
}

export type HospitalAssignableRole = (typeof HOSPITAL_ASSIGNABLE_ROLES)[number];

export type AgencyAssignableRole = (typeof AGENCY_ASSIGNABLE_ROLES)[number];

/** Human-readable labels — UI displays */
export const ROLE_LABELS: Record<string, string> = {
  rcsuperadmin: "Platform Owner",
  rcadmin: "NexCort Operations",
  rcitadmin: "NexCort IT Admin",
  salescontractor: "Sales Contractor",
  agencyadmin: "Agency Admin",
  agencyit: "Agency IT",
  supervisor: "Supervisor",
  dispatcher: "Dispatcher",
  analyst: "Analyst",
  auditor: "Auditor",
  hospitaladmin: "Hospital Admin",
  hospitalstaff: "Hospital Staff",
  campus_admin_k12: "Campus Admin (K-12)",
  campus_admin_highered: "Campus Admin (Higher-ed)",
  campus_supervisor_k12: "Campus Supervisor (K-12)",
  campus_supervisor_highered: "Campus Supervisor (Higher-ed)",
  campus_security_k12: "Campus Security (K-12)",
  campus_security_highered: "Campus Security (Higher-ed)",
  campus_dispatch_k12: "Campus Dispatch (K-12)",
  campus_dispatch_highered: "Campus Dispatch (Higher-ed)",
  campus_counselor_k12: "Campus Counselor (K-12)",
  campus_counselor_highered: "Campus Counselor (Higher-ed)",
  campus_faculty_k12: "Campus Faculty (K-12)",
  campus_faculty_highered: "Campus Faculty (Higher-ed)",
  // Legacy unsuffixed labels (pre-product split)
  campus_admin: "Campus Admin (K-12)",
  campus_supervisor: "Campus Supervisor (K-12)",
  campus_security: "Campus Security (K-12)",
  campus_dispatch: "Campus Dispatch (K-12)",
  campus_counselor: "Campus Counselor (K-12)",
  campus_faculty: "Campus Faculty (K-12)",
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
  call_assist_admin: "Call Assist Admin",
  call_assist_supervisor: "Call Assist Supervisor",
  call_assist_operator: "Call Assist Operator",
  platform_superadmin: "Platform Owner",
  rc_admin: "NexCort Operations",
  admin: "Agency Admin",
  it_admin: "Agency IT",
  readonly_auditor: "Auditor",
  commsupervisor: "Supervisor",
};

/** Single-line descriptions — user management UI tooltips */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  rcsuperadmin:
    "NexCort iQ platform owner. Unrestricted cross-tenant access to all features, agencies, and financial data.",
  rcadmin:
    "NexCort iQ operations staff. Cross-tenant visibility for support. No financial revenue totals or destructive actions.",
  rcitadmin:
    "NexCort iQ IT team. Infrastructure diagnostics, platform health, and technical integration management.",
  salescontractor:
    "Commission sales contractor. Sales portal only — pipeline, quotes, campaigns, and enablement tools. No agency ops access.",
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
  campus_admin_k12:
    "K-12 campus administrator. User management, school safety, visitor/pickup, and district reporting.",
  campus_admin_highered:
    "Higher-ed campus administrator. User management, Clery documentation, zone configuration, and reporting.",
  campus_supervisor_k12:
    "K-12 campus supervisor. Live incident map, school safety reports, camera feeds, and escalations.",
  campus_supervisor_highered:
    "Higher-ed campus supervisor. Live incident map, active reports, camera feeds, and escalations.",
  campus_security_k12:
    "K-12 campus security officer. QR/SMS reports, visitor verification, and dispatch.",
  campus_security_highered:
    "Higher-ed campus security officer. QR/SMS reports, two-way chat, evidence intake, and dispatch.",
  campus_dispatch_k12:
    "K-12 campus dispatch / communications. Incident intake and radio coordination.",
  campus_dispatch_highered:
    "Higher-ed campus dispatch / communications. Incident intake and radio coordination.",
  campus_counselor_k12:
    "K-12 campus counselor. Welfare check queue, anonymous tip inbox, and chat-only workflows.",
  campus_counselor_highered:
    "Higher-ed campus counselor. Welfare check queue, anonymous tip inbox, and chat-only workflows.",
  campus_faculty_k12:
    "K-12 campus faculty. Submit-only portal for reports and pickup authorization status.",
  campus_faculty_highered:
    "Higher-ed campus faculty. Submit-only portal for reports and status on their own submissions.",
  campus_admin:
    "Campus administrator (legacy K-12). User management, school safety, and reporting.",
  campus_supervisor:
    "Campus supervisor (legacy K-12). Live incident map, active reports, and escalations.",
  campus_security:
    "Campus security officer (legacy K-12). QR/SMS reports and dispatch.",
  campus_counselor:
    "Campus counselor (legacy K-12). Welfare check queue and tip inbox.",
  campus_faculty:
    "Campus faculty (legacy K-12). Submit-only portal for reports.",
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
  call_assist_admin:
    "Call Assist administrator. Non-emergency AI config, greeting, knowledge, records, and demo — no 911 dispatcher workspace.",
  call_assist_supervisor:
    "Call Assist supervisor. Live non-emergency sessions, QA, analytics, and human takeover — no CAD queue or dispatcher dashboard.",
  call_assist_operator:
    "Call Assist operator. Live non-emergency monitor, session intake, and transfer — not a 911 telecommunicator console.",
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
  salescontractor: ROLE_LABELS.salescontractor,
  campus_admin_k12: ROLE_LABELS.campus_admin_k12,
  campus_admin_highered: ROLE_LABELS.campus_admin_highered,
  campus_supervisor_k12: ROLE_LABELS.campus_supervisor_k12,
  campus_supervisor_highered: ROLE_LABELS.campus_supervisor_highered,
  campus_security_k12: ROLE_LABELS.campus_security_k12,
  campus_security_highered: ROLE_LABELS.campus_security_highered,
  campus_dispatch_k12: ROLE_LABELS.campus_dispatch_k12,
  campus_dispatch_highered: ROLE_LABELS.campus_dispatch_highered,
  campus_counselor_k12: ROLE_LABELS.campus_counselor_k12,
  campus_counselor_highered: ROLE_LABELS.campus_counselor_highered,
  campus_faculty_k12: ROLE_LABELS.campus_faculty_k12,
  campus_faculty_highered: ROLE_LABELS.campus_faculty_highered,
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
  call_assist_admin: ROLE_LABELS.call_assist_admin,
  call_assist_supervisor: ROLE_LABELS.call_assist_supervisor,
  call_assist_operator: ROLE_LABELS.call_assist_operator,
};

/** UI label for JWT snake_case or Cognito-group tokens (`CALL_ASSIST_ADMIN`, `CAMPUS_ADMIN`, …). */
export function roleDisplayLabel(role: string | undefined | null): string {
  const raw = (role ?? "").trim();
  if (!raw) return "";
  const snake = raw.toLowerCase().replace(/-/g, "_");
  return ROLE_LABELS[snake] ?? ROLE_LABELS[raw] ?? raw;
}

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

/** Product vertical roles (venue, campus, hospital portal, transit, Call Assist) — not PSAP dispatcher RBAC. */
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
    lower.startsWith("call_assist_") ||
    upper.startsWith("VENUE_") ||
    upper.startsWith("CAMPUS_") ||
    upper.startsWith("HOSPITAL_") ||
    upper.startsWith("TRANSIT_") ||
    upper.startsWith("CALL_ASSIST_")
  );
}

/**
 * Cognito test / seed users may use compact (`campusadmin`) or hyphenated (`venue-admin`) tokens.
 * Normalize at JWT parse boundaries before PSAP fallback logic runs.
 */
export const VERTICAL_ROLE_TOKEN_ALIASES: Record<string, RapidCortexRole> = {
  // Compact / hyphenated → K-12 (legacy unsuffixed seats)
  campusadmin: "campus_admin_k12",
  campussecurity: "campus_security_k12",
  campussupervisor: "campus_supervisor_k12",
  campusfaculty: "campus_faculty_k12",
  campuscounselor: "campus_counselor_k12",
  campusdispatch: "campus_dispatch_k12",
  "campus-admin": "campus_admin_k12",
  "campus-security": "campus_security_k12",
  "campus-supervisor": "campus_supervisor_k12",
  "campus-faculty": "campus_faculty_k12",
  "campus-counselor": "campus_counselor_k12",
  "campus-dispatch": "campus_dispatch_k12",
  venueadmin: "venue_admin",
  venuesecurity: "venue_security",
  venuesupervisor: "venue_supervisor",
  venueoperator: "venue_operator",
  venueguest: "venue_guest",
  "venue-admin": "venue_admin",
  "venue-security": "venue_security",
  "venue-supervisor": "venue_supervisor",
  "venue-operator": "venue_operator",
  "venue-guest": "venue_guest",
  "venue-guest-services": "venue_guest",
  "hospital-admin": "hospitaladmin",
  "hospital-staff": "hospitalstaff",
  "hospital-coordinator": "hospital_coord",
  hospitalcoordinator: "hospital_coord",
  hospitalcoord: "hospital_coord",
  "hospital-supervisor": "hospital_supervisor",
  hospitalsupervisor: "hospital_supervisor",
  transitadmin: "transit_admin",
  transitsupervisor: "transit_supervisor",
  transitsecurity: "transit_security",
  transitoperator: "transit_operator",
  "transit-admin": "transit_admin",
  "transit-supervisor": "transit_supervisor",
  "transit-security": "transit_security",
  "transit-operator": "transit_operator",
  callassistadmin: "call_assist_admin",
  callassistsupervisor: "call_assist_supervisor",
  callassistoperator: "call_assist_operator",
  "call-assist-admin": "call_assist_admin",
  "call-assist-supervisor": "call_assist_supervisor",
  "call-assist-operator": "call_assist_operator",
};

export function resolveVerticalRoleTokenAlias(raw: string | undefined | null): RapidCortexRole | undefined {
  const token = (raw ?? "").trim();
  if (!token) return undefined;
  return VERTICAL_ROLE_TOKEN_ALIASES[token.toLowerCase()];
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
  const aliased = resolveVerticalRoleTokenAlias(t);
  if (aliased) return aliased;
  // Campus product-suffixed Cognito groups (K-12 vs Higher-ed).
  if (t === "CAMPUS_ADMIN_K12") return "campus_admin_k12";
  if (t === "CAMPUS_ADMIN_HIGHERED") return "campus_admin_highered";
  if (t === "CAMPUS_SUPERVISOR_K12") return "campus_supervisor_k12";
  if (t === "CAMPUS_SUPERVISOR_HIGHERED") return "campus_supervisor_highered";
  if (t === "CAMPUS_SECURITY_K12") return "campus_security_k12";
  if (t === "CAMPUS_SECURITY_HIGHERED") return "campus_security_highered";
  if (t === "CAMPUS_DISPATCH_K12") return "campus_dispatch_k12";
  if (t === "CAMPUS_DISPATCH_HIGHERED") return "campus_dispatch_highered";
  if (t === "CAMPUS_COUNSELOR_K12") return "campus_counselor_k12";
  if (t === "CAMPUS_COUNSELOR_HIGHERED") return "campus_counselor_highered";
  if (t === "CAMPUS_FACULTY_K12") return "campus_faculty_k12";
  if (t === "CAMPUS_FACULTY_HIGHERED") return "campus_faculty_highered";
  // Legacy unsuffixed campus Cognito groups → K-12 (Camden-compatible).
  if (t === "CAMPUS_ADMIN") return "campus_admin_k12";
  if (t === "CAMPUS_SUPERVISOR") return "campus_supervisor_k12";
  if (t === "CAMPUS_SECURITY") return "campus_security_k12";
  if (t === "CAMPUS_DISPATCH") return "campus_dispatch_k12";
  if (t === "CAMPUS_COUNSELOR") return "campus_counselor_k12";
  if (t === "CAMPUS_FACULTY") return "campus_faculty_k12";
  // Legacy snake_case JWT without product suffix → K-12.
  if (t === "campus_admin") return "campus_admin_k12";
  if (t === "campus_supervisor") return "campus_supervisor_k12";
  if (t === "campus_security") return "campus_security_k12";
  if (t === "campus_dispatch") return "campus_dispatch_k12";
  if (t === "campus_counselor") return "campus_counselor_k12";
  if (t === "campus_faculty") return "campus_faculty_k12";
  if (t === "VENUE_ADMIN") return "venue_admin";
  if (t === "VENUE_SUPERVISOR") return "venue_supervisor";
  if (t === "VENUE_SECURITY") return "venue_security";
  if (t === "VENUE_OPERATOR") return "venue_operator";
  if (t === "VENUE_GUEST" || t === "VENUE_GUEST_SERVICES") return "venue_guest";
  if (t === "HOSPITAL_ADMIN") return "hospital_admin";
  if (t === "HOSPITAL_SUPERVISOR") return "hospital_supervisor";
  if (t === "HOSPITAL_STAFF") return "hospital_staff";
  if (t === "HOSPITAL_COORDINATOR" || t === "HOSPITAL_COORD") return "hospital_coord";
  if (t === "TRANSIT_ADMIN") return "transit_admin";
  if (t === "TRANSIT_SUPERVISOR") return "transit_supervisor";
  if (t === "TRANSIT_SECURITY") return "transit_security";
  if (t === "TRANSIT_OPERATOR") return "transit_operator";
  if (t === "CALL_ASSIST_ADMIN") return "call_assist_admin";
  if (t === "CALL_ASSIST_SUPERVISOR") return "call_assist_supervisor";
  if (t === "CALL_ASSIST_OPERATOR") return "call_assist_operator";
  const lower = t.toLowerCase().replace(/-/g, "_");
  if (lower === "commsupervisor") return "supervisor";
  if (
    t === "platform_superadmin" ||
    t === "superadmin" ||
    t === "rc_admin" ||
    t === "rc_superadmin"
  )
    return "rcsuperadmin";
  if (t === "admin") return "agencyadmin";
  if (t === "it_admin") return "agencyit";
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

/** Call Assist–only product console (not PSAP dispatcher / supervisor). */
export function isCallAssistProductRole(role: string | undefined | null): boolean {
  const e = (migrateLegacyRapidCortexRoleTokenValue(role ?? "") ?? role ?? "").trim().toLowerCase();
  return e === "call_assist_admin" || e === "call_assist_supervisor" || e === "call_assist_operator";
}
