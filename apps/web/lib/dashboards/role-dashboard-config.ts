import type { DashboardPrefix } from "./dashboard-access";

/**
 * `href` is an app-root path. Jurisdiction-scoped roles (see `jurisdiction-nav.ts`) resolve under
 * `/{slug}{href}` except absolute paths (`/rc-admin/*`, `/agency-admin/*`).
 */
export type NavTab = { id: string; label: string; href?: string };

export const ROLE_DASHBOARD_NAV: Record<DashboardPrefix, NavTab[]> = {
  /** Superset for tests; live sidebar uses `rcAdminNavForRole` in rc-admin-role-nav.ts. */
  "rc-admin": [
    { id: "overview", label: "Platform overview", href: "/rc-admin/dashboard" },
    { id: "agencies", label: "Agencies", href: "/rc-admin/agencies" },
    { id: "users", label: "Users", href: "/rc-admin/users" },
    { id: "billing", label: "Billing", href: "/rc-admin/billing" },
    { id: "infrastructure", label: "Infrastructure", href: "/rc-admin/infrastructure" },
    { id: "audit", label: "Audit log", href: "/rc-admin/audit" },
    { id: "support", label: "Platform notices", href: "/rc-admin/support" },
    { id: "feature-flags", label: "Feature flags", href: "/rc-admin/access" },
    { id: "api-clients", label: "Developer portal", href: "/rc-admin/api-clients" },
    { id: "location-qr", label: "Location QR Codes", href: "/rc-admin/location-qr-codes" },
    { id: "settings", label: "Settings", href: "/rc-admin/operations" },
    { id: "service-catalog", label: "Service catalog", href: "/rc-admin/billing/services" },
    { id: "reports", label: "Reports", href: "/rc-admin/usage" },
    { id: "system-health", label: "System health", href: "/rc-admin/system-health" },
    { id: "integrations", label: "Integrations", href: "/rc-admin/integrations" },
    { id: "system-settings", label: "System settings", href: "/rc-admin/system-settings" },
    { id: "cad-admin", label: "CAD administration", href: "/rc-admin/integrations" },
    { id: "security", label: "Security", href: "/rc-admin/security" },
  ],
  "agency-admin": [
    { id: "overview", label: "Admin overview", href: "/admin" },
    { id: "users", label: "Users", href: "/admin/users" },
    { id: "roles", label: "Roles & permissions", href: "/admin/roles" },
    { id: "integrations", label: "Integrations", href: "/admin/integrations" },
    { id: "compliance", label: "Compliance", href: "/admin/retention" },
    { id: "reports", label: "Reports", href: "/reports" },
    { id: "billing", label: "Billing", href: "/agency-admin/billing" },
    { id: "audit", label: "Audit log", href: "/admin/audit-logs" },
    { id: "settings", label: "System settings", href: "/admin/settings" },
    { id: "history", label: "History", href: "/history" },
  ],
  dispatcher: [
    { id: "overview", label: "Live call workspace", href: "/dashboard" },
    { id: "active-incident", label: "Active incident", href: "/incidents" },
    // BACKLOG (before 2026-09-02): /caller redirect stub is temporary — update href to the
    // canonical caller-info route when that page ships (see apps/web/app/.../caller/page.tsx).
    { id: "caller-information", label: "Caller information", href: "/caller" },
    { id: "ai-summary", label: "AI summary", href: "/ai-summary" },
    { id: "transcription", label: "Transcription", href: "/transcription" },
    { id: "translation", label: "Translation", href: "/translation" },
    { id: "caller-media", label: "Caller text / photo / video", href: "/media" },
    { id: "cad-entry", label: "CAD entry", href: "/cad" },
    { id: "safety-alerts", label: "Safety alerts", href: "/alerts" },
    { id: "supervisor-assist", label: "Supervisor assist", href: "/supervisor" },
    { id: "recent-calls", label: "Recent calls", href: "/calls" },
    { id: "shift-notes", label: "My shift notes", href: "/notes" },
  ],
  supervisor: [
    { id: "overview", label: "Supervisor dashboard", href: "/supervisor" },
    { id: "active-calls", label: "Active calls", href: "/supervisor/monitor" },
    { id: "active", label: "Incidents", href: "/incidents" },
    { id: "coaching", label: "QA / Coaching", href: "/supervisor/coaching" },
    { id: "team", label: "Team performance", href: "/supervisor/team-performance" },
    { id: "reports", label: "Reports", href: "/supervisor/reports" },
    { id: "writeback", label: "CAD writeback queue", href: "/review" },
    { id: "shifts", label: "History", href: "/history" },
    { id: "media", label: "Media", href: "/media" },
    { id: "audit", label: "Audit log", href: "/admin/audit-logs" },
  ],
  qa: [
    { id: "overview", label: "QA dashboard", href: "/analytics" },
    { id: "queue", label: "Review queue", href: "/qa" },
    { id: "scorecards", label: "Scorecards", href: "/supervisor/scorecards" },
    { id: "transcripts", label: "Transcripts", href: "/history" },
    { id: "reports", label: "Reports", href: "/reports" },
  ],
  "it-security": [
    { id: "overview", label: "IT overview", href: "/admin/it" },
    { id: "integrations", label: "Integrations", href: "/admin/integrations" },
    { id: "users", label: "Users", href: "/admin/users" },
    { id: "settings", label: "System settings", href: "/admin/settings" },
    { id: "cad", label: "CAD administration", href: "/admin/cad" },
    { id: "audit", label: "Audit log", href: "/admin/audit-logs" },
    { id: "security", label: "Security", href: "/admin/security" },
    { id: "reports", label: "Reports", href: "/reports" },
  ],
  "hospital-admin": [
    { id: "overview", label: "Facility overview", href: "/hospital-admin/dashboard" },
    { id: "capacity", label: "Capacity update", href: "/hospital-admin/capacity" },
    { id: "analytics", label: "Performance analytics", href: "/hospital-admin/analytics" },
    { id: "users", label: "Staff access", href: "/hospital-admin/users" },
  ],
  "hospital-staff": [
    { id: "overview", label: "Today's status", href: "/hospital-staff/dashboard" },
    { id: "capacity", label: "Update capacity", href: "/hospital-staff/capacity" },
    { id: "history", label: "Recent updates", href: "/hospital-staff/history" },
  ],
  executive: [
    { id: "overview", label: "Audit overview", href: "/audit" },
    { id: "audit-log", label: "Audit log", href: "/admin/audit-logs" },
    { id: "writeback", label: "CAD writeback audit", href: "/admin/cad" },
    { id: "reports", label: "Reports", href: "/reports" },
    { id: "history", label: "History", href: "/history" },
    { id: "reviews", label: "Post-incident reviews", href: "/reviews" },
  ],
};

/** Legacy titles — UI uses `ROLE_DASHBOARD_IDENTITY` in `role-dashboard-design.ts`. */
export const ROLE_DASHBOARD_TITLES: Record<DashboardPrefix, string> = {
  "rc-admin": "Platform Operations",
  "agency-admin": "Agency Command Center",
  dispatcher: "Mission Control",
  supervisor: "Command Overview",
  qa: "Intelligence Center",
  "it-security": "Security Operations",
  executive: "Executive Briefing",
  "hospital-admin": "Hospital Command",
  "hospital-staff": "Hospital Capacity",
};
