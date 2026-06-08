import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

export type PsapNavItem = { path: string; label: string };

export function resolvePsapRole(role: string | undefined | null): string {
  return migrateLegacyRapidCortexRoleTokenValue(role?.trim() ?? "") ?? role?.trim() ?? "";
}

/** Dispatcher live workspace — spec section 2. */
export const DISPATCHER_OPS_NAV: readonly PsapNavItem[] = [
  { path: "/dashboard", label: "Live workspace" },
  { path: "/dispatcher", label: "Dispatcher" },
  { path: "/intake", label: "Intake" },
  { path: "/triage", label: "Triage" },
  { path: "/transcription", label: "Transcription" },
  { path: "/incidents", label: "Incidents" },
  { path: "/history", label: "History" },
  { path: "/media", label: "Media" },
];

/** Supervisor command tools — appended for supervisor role. */
export const SUPERVISOR_OPS_NAV: readonly PsapNavItem[] = [
  { path: "/supervisor", label: "Supervisor dashboard" },
  { path: "/supervisor/monitor", label: "Active calls" },
  { path: "/incidents", label: "Incidents" },
  { path: "/supervisor/coaching", label: "QA / Coaching" },
  { path: "/supervisor/team-performance", label: "Team performance" },
  { path: "/supervisor/reports", label: "Reports" },
  { path: "/review", label: "CAD writeback queue" },
  { path: "/history", label: "History" },
  { path: "/media", label: "Media" },
  { path: "/admin/audit-logs", label: "Audit log" },
];

/** agencyadmin — management console only (no live ops paths). */
export const AGENCY_ADMIN_OPS_NAV: readonly PsapNavItem[] = [
  { path: "/admin", label: "Admin overview" },
  { path: "/history", label: "Incident history" },
  { path: "/reports", label: "Reports" },
];

export const AGENCY_ADMIN_ADMIN_NAV: readonly PsapNavItem[] = [
  { path: "/admin/users", label: "Users" },
  { path: "/admin/roles", label: "Roles & permissions" },
  { path: "/admin/integrations", label: "Integrations" },
  { path: "/admin/retention", label: "Compliance" },
  { path: "/admin/billing", label: "Billing" },
  { path: "/admin/audit-logs", label: "Audit log" },
  { path: "/admin/settings", label: "System settings" },
];

/** agencyit — technical console (no billing / compliance). */
export const AGENCY_IT_OPS_NAV: readonly PsapNavItem[] = [
  { path: "/admin/it", label: "IT overview" },
  { path: "/admin/integrations", label: "Integrations" },
  { path: "/admin/users", label: "Users" },
  { path: "/admin/settings", label: "System settings" },
  { path: "/admin/cad", label: "CAD administration" },
  { path: "/admin/audit-logs", label: "Audit log" },
  { path: "/admin/security", label: "Security" },
  { path: "/reports", label: "Reports" },
];

/** analyst — QA only, never live dispatch. */
export const ANALYST_OPS_NAV: readonly PsapNavItem[] = [
  { path: "/analytics", label: "QA dashboard" },
  { path: "/qa", label: "Review queue" },
  { path: "/supervisor/scorecards", label: "Scorecards" },
  { path: "/history", label: "Transcripts" },
  { path: "/reports", label: "Reports" },
];

/** auditor — read-only compliance surface. */
export const AUDITOR_OPS_NAV: readonly PsapNavItem[] = [
  { path: "/audit", label: "Audit overview" },
  { path: "/admin/audit-logs", label: "Audit log" },
  { path: "/admin/cad", label: "CAD writeback audit" },
  { path: "/reports", label: "Reports" },
  { path: "/history", label: "History" },
  { path: "/reviews", label: "Post-incident reviews" },
];

/** Paths auditors may open under /admin despite not being agency admins. */
export const AUDITOR_READ_ADMIN_PATHS: readonly string[] = [
  "/admin/audit-logs",
  "/admin/cad",
];

/** Paths analysts may open under /supervisor despite not being supervisors. */
export const ANALYST_SUPERVISOR_PATHS: readonly string[] = ["/supervisor/scorecards"];

export function psapOperationsNavForRole(role: string | undefined | null): readonly PsapNavItem[] {
  const effective = resolvePsapRole(role);
  switch (effective) {
    case "dispatcher":
      return DISPATCHER_OPS_NAV;
    case "supervisor":
      return SUPERVISOR_OPS_NAV;
    case "agencyadmin":
      return AGENCY_ADMIN_OPS_NAV;
    case "agencyit":
      return AGENCY_IT_OPS_NAV;
    case "analyst":
      return ANALYST_OPS_NAV;
    case "auditor":
      return AUDITOR_OPS_NAV;
    default:
      return [];
  }
}

export function psapAdministrationNavForRole(role: string | undefined | null): readonly PsapNavItem[] {
  if (resolvePsapRole(role) === "agencyadmin") return AGENCY_ADMIN_ADMIN_NAV;
  return [];
}
