import type { DashboardPrefix } from "./dashboard-access";

/**
 * `href` is an app-root path. Jurisdiction-scoped roles (see `jurisdiction-nav.ts`) resolve under
 * `/{slug}{href}` except absolute paths (`/rc-admin/*`, `/agency-admin/*`).
 */
export type NavTab = { id: string; label: string; href?: string };

export const ROLE_DASHBOARD_NAV: Record<DashboardPrefix, NavTab[]> = {
  "rc-admin": [
    { id: "overview", label: "Overview", href: "/rc-admin/dashboard" },
    { id: "infrastructure", label: "Infrastructure", href: "/rc-admin/infrastructure" },
    { id: "operations", label: "Operations", href: "/rc-admin/operations" },
    { id: "billing", label: "Billing", href: "/rc-admin/billing" },
    { id: "plans", label: "Plans", href: "/rc-admin/plans" },
    { id: "api-clients", label: "Tenant API clients", href: "/rc-admin/api-clients" },
    { id: "agencies", label: "Agencies", href: "/rc-admin/agencies" },
    { id: "users", label: "Users", href: "/rc-admin/users" },
    { id: "feature-access", label: "Feature access", href: "/rc-admin/access" },
    { id: "onboarding", label: "Onboarding", href: "/rc-admin/onboarding" },
    { id: "usage", label: "API Usage", href: "/rc-admin/usage" },
    { id: "invoices", label: "Invoices", href: "/rc-admin/invoices" },
    { id: "add-ons", label: "Add-ons", href: "/rc-admin/add-ons" },
  ],
  "agency-admin": [
    { id: "overview", label: "Agency overview", href: "/admin" },
    { id: "overrides", label: "Access overrides", href: "/agency-admin/overrides" },
    { id: "billing", label: "Billing & usage", href: "/agency-admin/billing" },
    { id: "features", label: "Features & add-ons", href: "/agency-admin/features" },
    { id: "network-access", label: "Network access", href: "/agency-admin/network" },
    { id: "api-access", label: "Agency API", href: "/agency-admin/api-access" },
    { id: "users", label: "Users & roles", href: "/admin/users" },
    { id: "departments", label: "Departments", href: "/admin/agency" },
    { id: "incidents", label: "Incident history", href: "/history" },
    { id: "cad", label: "CAD integration", href: "/admin/cad" },
    { id: "caller-links", label: "Caller link settings", href: "/admin/settings" },
    { id: "reports", label: "Reports", href: "/reports" },
    { id: "settings", label: "Agency settings", href: "/admin/settings" },
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
    { id: "overview", label: "Live operations", href: "/supervisor" },
    { id: "active", label: "Active incidents", href: "/incidents" },
    { id: "escalations", label: "Escalations", href: "/review" },
    { id: "map", label: "Incident map", href: "/command" },
    { id: "team", label: "Team activity", href: "/supervisor/team-performance" },
    { id: "media", label: "Media sessions", href: "/dispatcher/media" },
    { id: "translation", label: "Translation monitor", href: "/translation" },
    { id: "shifts", label: "Shift reports", href: "/history" },
  ],
  qa: [
    { id: "overview", label: "QA review queue", href: "/qa" },
    { id: "transcripts", label: "Transcripts", href: "/history" },
    { id: "summaries", label: "AI summaries", href: "/qa" },
    { id: "scorecards", label: "Scorecards", href: "/supervisor/scorecards" },
    { id: "coaching", label: "Coaching notes", href: "/supervisor/coaching" },
    { id: "training", label: "Training assignments", href: "/admin/qa/templates" },
    { id: "protocol", label: "Protocol compliance", href: "/admin/protocols" },
    { id: "reports", label: "Reports", href: "/reports" },
  ],
  "it-security": [
    { id: "overview", label: "Security overview", href: "/admin/security" },
    { id: "access", label: "Access logs", href: "/admin/audit-logs" },
    { id: "auth", label: "Authentication settings", href: "/admin/settings" },
    { id: "mfa", label: "MFA settings", href: "/settings/security" },
    { id: "api-keys", label: "API keys", href: "/admin/integrations" },
    { id: "cad-health", label: "CAD health", href: "/admin/cad" },
    { id: "audit", label: "Audit logs", href: "/admin/audit" },
    { id: "retention", label: "Data retention", href: "/admin/retention" },
    { id: "reports", label: "Security reports", href: "/reports" },
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
    { id: "overview", label: "Executive overview", href: "/analytics" },
    { id: "trends", label: "Trends", href: "/analytics" },
    { id: "reports", label: "Reports", href: "/reports" },
    { id: "usage", label: "Usage analytics", href: "/admin/analytics" },
    { id: "response", label: "Response metrics", href: "/reliability" },
    { id: "qa", label: "QA summary", href: "/supervisor/qa" },
    { id: "training", label: "Training impact", href: "/admin/wellness" },
    { id: "grants", label: "Grant reporting" },
    { id: "export", label: "Export center" },
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
