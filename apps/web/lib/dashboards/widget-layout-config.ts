/**
 * apps/web/lib/dashboards/widget-layout-config.ts
 *
 * Single source of truth for every dashboard home widget layout.
 * All 21 active roles defined. No role is missing. No widget appears
 * on a role that shouldn't see it.
 *
 * Layout system:
 *   Each widget slot has a `span` (out of 12 columns, responsive).
 *   Widgets render in array order, left-to-right, wrapping to the next row.
 *   `priority` controls load order for skeleton shimmer sequencing.
 */

import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

// ─── Widget registry ──────────────────────────────────────────────────────────

export type WidgetId =
  // Stat cards
  | "stat-open-incidents"
  | "stat-active-calls"
  | "stat-units-available"
  | "stat-sla-answer-time"
  | "stat-agency-count"
  | "stat-mrr"
  | "stat-open-invoices"
  | "stat-pending-reviews"
  | "stat-integration-errors"
  | "stat-beds-available"
  | "stat-staff-on-duty"
  | "stat-cameras-online"
  | "stat-open-guest-reports"
  | "stat-qr-scans-today"
  // Operational
  | "sla-bar"
  | "active-calls-grid"
  | "incident-queue"
  | "cad-approval-queue"
  | "escalated-incidents"
  | "team-workload"
  | "war-rooms-active"
  // Admin / config
  | "quick-links-admin"
  | "recent-activity"
  | "integration-health"
  | "compliance-status"
  | "api-key-status"
  | "cad-adapter-status"
  | "user-login-activity"
  | "webhook-delivery"
  // RC platform
  | "platform-health-bar"
  | "agency-pipeline"
  | "billing-health"
  | "platform-notices-sent"
  | "service-catalog-summary"
  | "system-alerts"
  | "active-grants"
  | "revenue-snapshot"
  | "api-poller-status"
  | "failed-auth-events"
  // QA / reports
  | "qa-review-queue"
  | "scorecard-stats"
  | "quality-trend-chart"
  | "reports-summary"
  | "flagged-calls"
  | "audit-activity"
  | "access-reports-summary"
  | "cad-writeback-audit"
  | "trend-overview"
  // Campus
  | "campus-incident-queue"
  | "campus-zone-status"
  | "qr-scan-activity"
  | "campus-user-activity"
  // Hospital
  | "capacity-status"
  | "capacity-trend"
  | "regional-capacity-map"
  | "routing-events"
  | "capacity-quick-update"
  | "my-capacity-history"
  // Venue
  | "venue-live-stats-row"
  | "guest-reports-feed"
  | "staff-board"
  | "camera-grid"
  | "zone-status"
  | "venue-heatmap";

export type WidgetSpan = 3 | 4 | 6 | 8 | 12;
export type WidgetHeight = "xs" | "sm" | "md" | "lg" | "xl";

export type WidgetSlot = {
  id: WidgetId;
  /** Tailwind col-span out of 12. Responsive: collapses to 12 on mobile. */
  span: WidgetSpan;
  /** Minimum height class applied to the widget card. */
  height: WidgetHeight;
  /** React Query queryKey root — renderer appends [agencyId] automatically. */
  queryKey: string;
  /** Load order for skeleton shimmer — lower = loads first. */
  priority: number;
  /** Feature flag key — widget hidden when flag is off. Omit if always visible. */
  feature?: string;
  /** If true, shows a badge/count on the widget header (from the query result). */
  showCount?: boolean;
};

export type RoleWidgetLayout = {
  /** Accent color drives section headers and stat card highlights */
  accent: "violet" | "sky" | "orange" | "teal" | "slate" | "rose";
  /** Greeting shown at top of dashboard e.g. "Good morning, {name}" */
  greeting: string;
  /** Subline shown under greeting */
  description: string;
  widgets: WidgetSlot[];
};

// ─── RC INTERNAL ──────────────────────────────────────────────────────────────

export const RC_SUPERADMIN_LAYOUT: RoleWidgetLayout = {
  accent: "violet",
  greeting: "Platform Overview",
  description: "Real-time health across all tenants, stacks, and infrastructure.",
  widgets: [
    { id: "platform-health-bar",    span: 12, height: "xs", queryKey: "platform-health",   priority: 1 },
    { id: "stat-agency-count",      span: 3,  height: "xs", queryKey: "platform-stats",    priority: 2 },
    { id: "stat-mrr",               span: 3,  height: "xs", queryKey: "billing-summary",   priority: 2 },
    { id: "stat-open-invoices",     span: 3,  height: "xs", queryKey: "billing-summary",   priority: 2 },
    { id: "system-alerts",          span: 3,  height: "xs", queryKey: "system-alerts",     priority: 2, showCount: true },
    { id: "agency-pipeline",        span: 6,  height: "md", queryKey: "agency-pipeline",   priority: 3 },
    { id: "active-grants",          span: 6,  height: "md", queryKey: "active-grants",     priority: 3, showCount: true },
    { id: "revenue-snapshot",       span: 6,  height: "md", queryKey: "billing-summary",   priority: 4 },
    { id: "platform-notices-sent",  span: 6,  height: "md", queryKey: "platform-notices",  priority: 4 },
    { id: "integration-health",     span: 12, height: "sm", queryKey: "integration-health",priority: 5 },
  ],
};

export const RC_ADMIN_LAYOUT: RoleWidgetLayout = {
  accent: "violet",
  greeting: "Business Overview",
  description: "Agency pipeline, billing health, and platform activity.",
  widgets: [
    { id: "stat-agency-count",       span: 4,  height: "xs", queryKey: "platform-stats",   priority: 1 },
    { id: "stat-open-invoices",      span: 4,  height: "xs", queryKey: "billing-summary",  priority: 1 },
    { id: "stat-mrr",                span: 4,  height: "xs", queryKey: "billing-summary",  priority: 1 },
    { id: "agency-pipeline",         span: 6,  height: "lg", queryKey: "agency-pipeline",  priority: 2 },
    { id: "billing-health",          span: 6,  height: "lg", queryKey: "billing-health",   priority: 2 },
    { id: "platform-notices-sent",   span: 6,  height: "md", queryKey: "platform-notices", priority: 3 },
    { id: "service-catalog-summary", span: 6,  height: "md", queryKey: "service-catalog",  priority: 3 },
  ],
};

export const RC_IT_ADMIN_LAYOUT: RoleWidgetLayout = {
  accent: "violet",
  greeting: "Infrastructure Overview",
  description: "Stack health, integration status, and security signals.",
  widgets: [
    { id: "platform-health-bar",  span: 12, height: "sm", queryKey: "platform-health",    priority: 1 },
    { id: "stat-integration-errors", span: 4, height: "xs", queryKey: "integration-health", priority: 2 },
    { id: "failed-auth-events",   span: 4,  height: "xs", queryKey: "auth-events",         priority: 2, showCount: true },
    { id: "system-alerts",        span: 4,  height: "xs", queryKey: "system-alerts",       priority: 2, showCount: true },
    { id: "integration-health",   span: 6,  height: "lg", queryKey: "integration-health",  priority: 3 },
    { id: "cad-adapter-status",   span: 6,  height: "lg", queryKey: "cad-adapter",         priority: 3 },
    { id: "api-poller-status",    span: 6,  height: "md", queryKey: "api-pollers",         priority: 4 },
    { id: "user-login-activity",  span: 6,  height: "md", queryKey: "auth-events",         priority: 4 },
  ],
};

// ─── PSAP / DISPATCH ─────────────────────────────────────────────────────────

// Dispatcher home is the live workspace — handled by existing DispatcherWorkspace component.
// The layout config here defines the fallback/empty-queue view.
export const DISPATCHER_LAYOUT: RoleWidgetLayout = {
  accent: "sky",
  greeting: "Dispatcher Workspace",
  description: "Select an incident from the queue to begin.",
  widgets: [
    // Primary: incident queue fills the center. SLA bar is the only summary widget.
    { id: "sla-bar",           span: 12, height: "xs", queryKey: "shift-sla",          priority: 1 },
    { id: "incident-queue",    span: 8,  height: "xl", queryKey: "incidents",           priority: 2, showCount: true },
    { id: "stat-units-available", span: 4, height: "xl", queryKey: "unit-status",       priority: 2 },
  ],
};

export const SUPERVISOR_LAYOUT: RoleWidgetLayout = {
  accent: "sky",
  greeting: "Supervisor Dashboard",
  description: "Active calls, CAD queue, and team workload at a glance.",
  widgets: [
    { id: "sla-bar",               span: 12, height: "xs", queryKey: "shift-sla",           priority: 1 },
    { id: "active-calls-grid",     span: 8,  height: "lg", queryKey: "active-calls",         priority: 2 },
    { id: "cad-approval-queue",    span: 4,  height: "lg", queryKey: "cad-approvals",        priority: 2, showCount: true, feature: "cadWriteback" },
    { id: "incident-queue",        span: 6,  height: "md", queryKey: "incidents",            priority: 3, showCount: true },
    { id: "team-workload",         span: 6,  height: "md", queryKey: "team-workload",        priority: 3 },
    { id: "escalated-incidents",   span: 6,  height: "sm", queryKey: "incidents",            priority: 4, showCount: true },
    { id: "war-rooms-active",      span: 6,  height: "sm", queryKey: "war-rooms",            priority: 4, showCount: true },
  ],
};

export const AGENCY_ADMIN_LAYOUT: RoleWidgetLayout = {
  accent: "sky",
  greeting: "Agency Administration",
  description: "User management, integrations, compliance, and reporting.",
  widgets: [
    { id: "stat-agency-count",    span: 3,  height: "xs", queryKey: "agency-stats",      priority: 1 },
    { id: "stat-sla-answer-time", span: 3,  height: "xs", queryKey: "shift-sla",         priority: 1 },
    { id: "stat-open-incidents",  span: 3,  height: "xs", queryKey: "incidents",         priority: 1 },
    { id: "stat-integration-errors", span: 3, height: "xs", queryKey: "integration-health", priority: 1 },
    { id: "quick-links-admin",    span: 4,  height: "md", queryKey: "agency-stats",      priority: 2 },
    { id: "recent-activity",      span: 8,  height: "md", queryKey: "activity-feed",     priority: 2 },
    { id: "reports-summary",      span: 6,  height: "md", queryKey: "reports",           priority: 3 },
    { id: "compliance-status",    span: 6,  height: "md", queryKey: "compliance",        priority: 3 },
    { id: "integration-health",   span: 12, height: "sm", queryKey: "integration-health",priority: 4 },
  ],
};

export const AGENCY_IT_LAYOUT: RoleWidgetLayout = {
  accent: "sky",
  greeting: "IT Administration",
  description: "Integration health, CAD status, API keys, and security.",
  widgets: [
    { id: "stat-integration-errors", span: 4, height: "xs", queryKey: "integration-health", priority: 1 },
    { id: "failed-auth-events",  span: 4,  height: "xs", queryKey: "auth-events",        priority: 1, showCount: true },
    { id: "api-key-status",      span: 4,  height: "xs", queryKey: "api-keys",           priority: 1 },
    { id: "integration-health",  span: 6,  height: "lg", queryKey: "integration-health", priority: 2 },
    { id: "cad-adapter-status",  span: 6,  height: "lg", queryKey: "cad-adapter",        priority: 2 },
    { id: "user-login-activity", span: 6,  height: "md", queryKey: "auth-events",        priority: 3 },
    { id: "webhook-delivery",    span: 6,  height: "md", queryKey: "webhook-stats",      priority: 3 },
  ],
};

export const ANALYST_LAYOUT: RoleWidgetLayout = {
  accent: "sky",
  greeting: "QA Dashboard",
  description: "Review queue, scorecard trends, and quality analytics.",
  widgets: [
    { id: "stat-pending-reviews", span: 4,  height: "xs", queryKey: "qa-queue",         priority: 1, showCount: true },
    { id: "scorecard-stats",      span: 4,  height: "xs", queryKey: "scorecards",        priority: 1 },
    { id: "stat-sla-answer-time", span: 4,  height: "xs", queryKey: "shift-sla",         priority: 1 },
    { id: "qa-review-queue",      span: 8,  height: "xl", queryKey: "qa-queue",          priority: 2, showCount: true },
    { id: "quality-trend-chart",  span: 4,  height: "xl", queryKey: "qa-trends",         priority: 2 },
    { id: "flagged-calls",        span: 6,  height: "md", queryKey: "qa-queue",          priority: 3, showCount: true },
    { id: "recent-activity",      span: 6,  height: "md", queryKey: "activity-feed",     priority: 3 },
  ],
};

export const AUDITOR_LAYOUT: RoleWidgetLayout = {
  accent: "sky",
  greeting: "Audit Overview",
  description: "Compliance trends, audit activity, and access reports.",
  widgets: [
    { id: "trend-overview",          span: 12, height: "md", queryKey: "audit-trends",       priority: 1 },
    { id: "audit-activity",          span: 6,  height: "lg", queryKey: "audit-log",           priority: 2 },
    { id: "cad-writeback-audit",     span: 6,  height: "lg", queryKey: "cad-audit",           priority: 2 },
    { id: "access-reports-summary",  span: 6,  height: "md", queryKey: "access-reports",      priority: 3 },
    { id: "reports-summary",         span: 6,  height: "md", queryKey: "reports",             priority: 3 },
  ],
};

// ─── CAMPUS ───────────────────────────────────────────────────────────────────

export const CAMPUS_ADMIN_LAYOUT: RoleWidgetLayout = {
  accent: "slate",
  greeting: "Campus Safety",
  description: "Incident activity, QR engagement, and zone awareness.",
  widgets: [
    { id: "stat-open-incidents", span: 3,  height: "xs", queryKey: "campus-incidents",   priority: 1, showCount: true },
    { id: "stat-qr-scans-today", span: 3,  height: "xs", queryKey: "qr-activity",        priority: 1 },
    { id: "stat-staff-on-duty",  span: 3,  height: "xs", queryKey: "campus-users",       priority: 1 },
    { id: "campus-user-activity",span: 3,  height: "xs", queryKey: "activity-feed",      priority: 1 },
    { id: "campus-incident-queue",span: 8, height: "xl", queryKey: "campus-incidents",   priority: 2, showCount: true },
    { id: "campus-zone-status",  span: 4,  height: "xl", queryKey: "campus-zones",       priority: 2 },
    { id: "qr-scan-activity",    span: 6,  height: "md", queryKey: "qr-activity",        priority: 3 },
    { id: "reports-summary",     span: 6,  height: "md", queryKey: "campus-reports",     priority: 3 },
  ],
};

export const CAMPUS_SUPERVISOR_LAYOUT: RoleWidgetLayout = {
  accent: "slate",
  greeting: "Campus Supervisor",
  description: "Active incidents and zone status.",
  widgets: [
    { id: "stat-open-incidents",  span: 6,  height: "xs", queryKey: "campus-incidents",  priority: 1, showCount: true },
    { id: "campus-zone-status",   span: 6,  height: "xs", queryKey: "campus-zones",      priority: 1 },
    { id: "campus-incident-queue",span: 12, height: "xl", queryKey: "campus-incidents",  priority: 2, showCount: true },
  ],
};

export const CAMPUS_SECURITY_LAYOUT: RoleWidgetLayout = {
  accent: "slate",
  greeting: "Campus Security",
  description: "Incidents in your zone and recent submissions.",
  widgets: [
    { id: "campus-incident-queue",span: 8,  height: "xl", queryKey: "campus-incidents",  priority: 1 },
    { id: "campus-zone-status",   span: 4,  height: "xl", queryKey: "campus-zones",      priority: 1 },
    { id: "qr-scan-activity",     span: 12, height: "sm", queryKey: "qr-activity",       priority: 2 },
  ],
};

export const CAMPUS_DISPATCH_LAYOUT: RoleWidgetLayout = {
  accent: "slate",
  greeting: "Campus Dispatch",
  description: "Incident queue and zone assignment.",
  widgets: [
    { id: "stat-open-incidents",  span: 6,  height: "xs", queryKey: "campus-incidents",  priority: 1, showCount: true },
    { id: "campus-zone-status",   span: 6,  height: "xs", queryKey: "campus-zones",      priority: 1 },
    { id: "campus-incident-queue",span: 12, height: "xl", queryKey: "campus-incidents",  priority: 2, showCount: true },
  ],
};

// ─── HOSPITAL ─────────────────────────────────────────────────────────────────

export const HOSPITAL_ADMIN_LAYOUT: RoleWidgetLayout = {
  accent: "teal",
  greeting: "Facility Dashboard",
  description: "Live capacity, regional comparison, and routing events.",
  widgets: [
    { id: "capacity-status",       span: 4,  height: "sm", queryKey: "facility-capacity", priority: 1 },
    { id: "stat-beds-available",   span: 4,  height: "xs", queryKey: "facility-capacity", priority: 1 },
    { id: "routing-events",        span: 4,  height: "sm", queryKey: "routing-events",    priority: 1 },
    { id: "regional-capacity-map", span: 8,  height: "xl", queryKey: "regional-capacity", priority: 2 },
    { id: "capacity-trend",        span: 4,  height: "xl", queryKey: "capacity-trend",    priority: 2 },
    { id: "recent-activity",       span: 6,  height: "md", queryKey: "activity-feed",     priority: 3 },
    { id: "reports-summary",       span: 6,  height: "md", queryKey: "hospital-reports",  priority: 3 },
  ],
};

export const HOSPITAL_COORDINATOR_LAYOUT: RoleWidgetLayout = {
  accent: "teal",
  greeting: "Hospital Coordinator",
  description: "Facility capacity and regional routing overview.",
  widgets: [
    { id: "capacity-status",       span: 6,  height: "md", queryKey: "facility-capacity", priority: 1 },
    { id: "routing-events",        span: 6,  height: "md", queryKey: "routing-events",    priority: 1 },
    { id: "regional-capacity-map", span: 12, height: "xl", queryKey: "regional-capacity", priority: 2 },
    { id: "capacity-trend",        span: 12, height: "md", queryKey: "capacity-trend",    priority: 3 },
  ],
};

export const HOSPITAL_STAFF_LAYOUT: RoleWidgetLayout = {
  accent: "teal",
  greeting: "Capacity Update",
  description: "Update current bed availability for your facility.",
  widgets: [
    { id: "capacity-quick-update", span: 8,  height: "lg", queryKey: "facility-capacity", priority: 1 },
    { id: "capacity-status",       span: 4,  height: "lg", queryKey: "facility-capacity", priority: 1 },
    { id: "my-capacity-history",   span: 12, height: "md", queryKey: "capacity-history",  priority: 2 },
  ],
};

// ─── VENUE ────────────────────────────────────────────────────────────────────

export const VENUE_ADMIN_LAYOUT: RoleWidgetLayout = {
  accent: "orange",
  greeting: "Venue Operations",
  description: "Live incident activity, guest reports, staff, and cameras.",
  widgets: [
    { id: "venue-live-stats-row",  span: 12, height: "xs", queryKey: "venue-stats",       priority: 1 },
    { id: "camera-grid",           span: 6,  height: "lg", queryKey: "venue-cameras",     priority: 2 },
    { id: "guest-reports-feed",    span: 6,  height: "lg", queryKey: "guest-reports",     priority: 2, showCount: true },
    { id: "incident-queue",        span: 8,  height: "md", queryKey: "venue-incidents",   priority: 3, showCount: true },
    { id: "staff-board",           span: 4,  height: "md", queryKey: "venue-staff",       priority: 3 },
    { id: "zone-status",           span: 6,  height: "sm", queryKey: "venue-zones",       priority: 4 },
    { id: "qr-scan-activity",      span: 6,  height: "sm", queryKey: "qr-activity",       priority: 4 },
  ],
};

export const VENUE_SUPERVISOR_LAYOUT: RoleWidgetLayout = {
  accent: "orange",
  greeting: "Venue Supervisor",
  description: "Full ops view — incidents, reports, staff, and cameras.",
  widgets: [
    { id: "venue-live-stats-row",  span: 12, height: "xs", queryKey: "venue-stats",       priority: 1 },
    { id: "camera-grid",           span: 6,  height: "lg", queryKey: "venue-cameras",     priority: 2 },
    { id: "guest-reports-feed",    span: 6,  height: "lg", queryKey: "guest-reports",     priority: 2, showCount: true },
    { id: "incident-queue",        span: 8,  height: "md", queryKey: "venue-incidents",   priority: 3, showCount: true },
    { id: "staff-board",           span: 4,  height: "md", queryKey: "venue-staff",       priority: 3 },
    { id: "zone-status",           span: 12, height: "sm", queryKey: "venue-zones",       priority: 4 },
  ],
};

export const VENUE_SECURITY_LAYOUT: RoleWidgetLayout = {
  accent: "orange",
  greeting: "Venue Security",
  description: "Incidents, guest reports, and your zone cameras.",
  widgets: [
    { id: "stat-open-incidents",   span: 4,  height: "xs", queryKey: "venue-incidents",   priority: 1, showCount: true },
    { id: "stat-open-guest-reports",span: 4, height: "xs", queryKey: "guest-reports",     priority: 1, showCount: true },
    { id: "stat-cameras-online",   span: 4,  height: "xs", queryKey: "venue-cameras",     priority: 1 },
    { id: "incident-queue",        span: 6,  height: "xl", queryKey: "venue-incidents",   priority: 2 },
    { id: "guest-reports-feed",    span: 6,  height: "xl", queryKey: "guest-reports",     priority: 2 },
    { id: "camera-grid",           span: 8,  height: "md", queryKey: "venue-cameras",     priority: 3 },
    { id: "zone-status",           span: 4,  height: "md", queryKey: "venue-zones",       priority: 3 },
  ],
};

export const VENUE_OPERATOR_LAYOUT: RoleWidgetLayout = {
  accent: "orange",
  greeting: "Venue Operations",
  description: "Incident queue for your event.",
  widgets: [
    { id: "stat-open-incidents",  span: 6,   height: "xs", queryKey: "venue-incidents",   priority: 1, showCount: true },
    { id: "zone-status",          span: 6,   height: "xs", queryKey: "venue-zones",       priority: 1 },
    { id: "incident-queue",       span: 12,  height: "xl", queryKey: "venue-incidents",   priority: 2, showCount: true },
  ],
};

export const VENUE_GUEST_SERVICES_LAYOUT: RoleWidgetLayout = {
  accent: "orange",
  greeting: "Guest Services",
  description: "Incoming guest reports. This is not a 911 emergency system.",
  widgets: [
    // Single widget — guest services only sees the report feed
    { id: "guest-reports-feed",   span: 12,  height: "xl", queryKey: "guest-reports",     priority: 1, showCount: true },
  ],
};

// ─── Resolver ─────────────────────────────────────────────────────────────────

/** Normalize JWT / legacy role tokens to layout config keys. */
export function resolveWidgetLayoutRole(raw: string): string {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();

  if (upper.startsWith("CAMPUS_")) return upper;
  if (upper.startsWith("VENUE_")) return upper;
  if (upper === "HOSPITAL_ADMIN" || upper === "HOSPITAL_COORDINATOR" || upper === "HOSPITAL_STAFF") {
    return upper;
  }

  const migrated = migrateLegacyRapidCortexRoleTokenValue(trimmed) ?? trimmed;
  if (migrated === "hospitaladmin") return "HOSPITAL_ADMIN";
  if (migrated === "hospitalstaff") return "HOSPITAL_STAFF";

  return migrated;
}

export const ROLE_WIDGET_LAYOUTS: Record<string, RoleWidgetLayout> = {
  rcsuperadmin:          RC_SUPERADMIN_LAYOUT,
  rcadmin:               RC_ADMIN_LAYOUT,
  rcitadmin:             RC_IT_ADMIN_LAYOUT,
  dispatcher:            DISPATCHER_LAYOUT,
  supervisor:            SUPERVISOR_LAYOUT,
  agencyadmin:           AGENCY_ADMIN_LAYOUT,
  agencyit:              AGENCY_IT_LAYOUT,
  analyst:               ANALYST_LAYOUT,
  auditor:               AUDITOR_LAYOUT,
  CAMPUS_ADMIN:          CAMPUS_ADMIN_LAYOUT,
  CAMPUS_SUPERVISOR:     CAMPUS_SUPERVISOR_LAYOUT,
  CAMPUS_SECURITY:       CAMPUS_SECURITY_LAYOUT,
  CAMPUS_DISPATCH:       CAMPUS_DISPATCH_LAYOUT,
  HOSPITAL_ADMIN:        HOSPITAL_ADMIN_LAYOUT,
  HOSPITAL_COORDINATOR:  HOSPITAL_COORDINATOR_LAYOUT,
  HOSPITAL_STAFF:        HOSPITAL_STAFF_LAYOUT,
  VENUE_ADMIN:           VENUE_ADMIN_LAYOUT,
  VENUE_SUPERVISOR:      VENUE_SUPERVISOR_LAYOUT,
  VENUE_SECURITY:        VENUE_SECURITY_LAYOUT,
  VENUE_OPERATOR:        VENUE_OPERATOR_LAYOUT,
  VENUE_GUEST_SERVICES:  VENUE_GUEST_SERVICES_LAYOUT,
};

export function getWidgetLayout(role: string): RoleWidgetLayout | null {
  return ROLE_WIDGET_LAYOUTS[resolveWidgetLayoutRole(role)] ?? null;
}

/** Tailwind col-span classes for each span value */
export const SPAN_CLASS: Record<WidgetSpan, string> = {
  3:  "col-span-12 md:col-span-6 xl:col-span-3",
  4:  "col-span-12 md:col-span-6 xl:col-span-4",
  6:  "col-span-12 xl:col-span-6",
  8:  "col-span-12 xl:col-span-8",
  12: "col-span-12",
};

/** Tailwind min-height classes */
export const HEIGHT_CLASS: Record<WidgetHeight, string> = {
  xs: "min-h-[72px]",
  sm: "min-h-[120px]",
  md: "min-h-[200px]",
  lg: "min-h-[280px]",
  xl: "min-h-[400px]",
};
