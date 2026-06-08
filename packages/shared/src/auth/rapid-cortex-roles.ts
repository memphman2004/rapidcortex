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
  const upper = (raw ?? "").trim().toUpperCase();
  return (
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
  if (isProductVerticalRoleToken(raw)) return raw;
  const migrated = migrateLegacyRapidCortexRoleTokenValue(raw) ?? "";
  if (migrated && isRapidCortexRole(migrated)) return migrated;
  return "dispatcher";
}

/**
 * JWT / Cognito may still emit legacy role strings until user pools are fully migrated.
 * Normalize at token parse boundaries only — do **not** write new assigns with legacy values.
 */
export function migrateLegacyRapidCortexRoleTokenValue(raw: string | undefined): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const t = raw.trim();
  // Campus role-family bridge: Cognito groups currently emit CAMPUS_* identifiers.
  // Map these to canonical product roles until native campus role literals are introduced.
  if (t === "CAMPUS_ADMIN") return "agencyadmin";
  if (t === "CAMPUS_SUPERVISOR") return "supervisor";
  if (t === "CAMPUS_SECURITY") return "dispatcher";
  if (t === "CAMPUS_DISPATCH") return "dispatcher";
  if (t === "CAMPUS_COUNSELOR") return "analyst";
  if (t === "CAMPUS_FACULTY") return "auditor";
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
  if (t === "staff") return "auditor";
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
