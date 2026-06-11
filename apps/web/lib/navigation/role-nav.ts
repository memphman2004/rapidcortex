/**
 * apps/web/lib/navigation/role-nav.ts
 *
 * Single source of truth for every sidebar across all 21 active roles.
 *
 * Usage:
 *   const nav = getRoleNav(session.role, { jurisdiction, venueCode, campusCode });
 *   // nav.sections → array of NavSection, render in sidebar
 *
 * Icons: lucide-react. Every item has an icon — no text-only rows.
 * Badges: "new" | "soon" | "admin-only" | "superadmin-only" | "read-only" | count
 * Feature-gated items: include `feature` key; caller hides if flag is off.
 */

import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavBadge =
  | { type: "label"; text: string; color: "red" | "yellow" | "blue" | "slate" }
  | { type: "count"; key: string }   // resolved at runtime (e.g. pending CAD queue depth)
  | { type: "dot"; color: "red" | "yellow" | "green" };

export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;                       // lucide-react icon name (PascalCase)
  badge?: NavBadge;
  feature?: string;                   // runtime flag key — item hidden when flag is off
  exact?: boolean;                    // active match: exact path vs prefix
  external?: boolean;
};

export type NavSection = {
  id: string;
  label?: string;                     // omit for unlabeled top section
  items: NavItem[];
};

export type RoleNav = {
  sections: NavSection[];
  /** Accent color for the sidebar — drives active item highlight, section label color */
  accent: "violet" | "sky" | "orange" | "teal" | "slate" | "rose";
  /** Badge shown next to role name in sidebar header */
  roleBadge: string;
};

// ─── RC INTERNAL ──────────────────────────────────────────────────────────────

export const RC_SUPERADMIN_NAV: RoleNav = {
  accent: "violet",
  roleBadge: "SUPERADMIN",
  sections: [
    {
      id: "platform",
      label: "PLATFORM",
      items: [
        { id: "overview",  label: "Overview",         href: "/rc-admin/dashboard",     icon: "LayoutDashboard", exact: true },
        { id: "agencies",  label: "Agencies",          href: "/rc-admin/agencies",      icon: "Building2" },
        { id: "users",     label: "Users",             href: "/rc-admin/users",         icon: "Users" },
      ],
    },
    {
      id: "business",
      label: "BUSINESS",
      items: [
        { id: "billing",   label: "Billing",           href: "/rc-admin/billing",       icon: "CreditCard" },
        { id: "invoices",  label: "Invoices",          href: "/rc-admin/invoices",      icon: "Receipt" },
        { id: "catalog",   label: "Service Catalog",   href: "/rc-admin/billing/services", icon: "Package" },
        { id: "agreements",label: "Agreements",        href: "/rc-admin/agreements",    icon: "FileSignature" },
      ],
    },
    {
      id: "ops",
      label: "PLATFORM OPS",
      items: [
        { id: "notices",   label: "Platform Notices",  href: "/rc-admin/support",       icon: "Megaphone" },
        {
          id: "flags",
          label: "Feature Flags",
          href: "/rc-admin/access",
          icon: "Flag",
          badge: { type: "label", text: "IMMUTABLE", color: "slate" },
        },
        {
          id: "grants",
          label: "Grants",
          href: "/rc-admin/grants",
          icon: "ShieldCheck",
          badge: { type: "label", text: "SUPERADMIN", color: "red" },
        },
        { id: "dev-portal",label: "Developer Portal",  href: "/rc-admin/api-clients",   icon: "Code2" },
      ],
    },
    {
      id: "locations",
      label: "LOCATIONS",
      items: [
        { id: "qr",        label: "QR Codes",          href: "/rc-admin/qr-nfc", icon: "QrCode" },
        { id: "qr-legacy", label: "Location QR (RCLI)", href: "/rc-admin/location-qr-codes", icon: "MapPin" },
      ],
    },
    {
      id: "infra",
      label: "INFRASTRUCTURE",
      items: [
        { id: "health",    label: "System Health",     href: "/rc-admin/infrastructure",icon: "Activity" },
        { id: "audit",     label: "Audit Log",         href: "/rc-admin/audit",         icon: "ScrollText" },
        { id: "reports",   label: "Reports",           href: "/rc-admin/usage",         icon: "BarChart3" },
        { id: "settings",  label: "Settings",          href: "/rc-admin/operations",    icon: "Settings" },
      ],
    },
  ],
};

export const RC_ADMIN_NAV: RoleNav = {
  accent: "violet",
  roleBadge: "RC ADMIN",
  sections: [
    {
      id: "platform",
      label: "PLATFORM",
      items: [
        { id: "overview",  label: "Overview",         href: "/rc-admin/dashboard",     icon: "LayoutDashboard", exact: true },
        { id: "agencies",  label: "Agencies",          href: "/rc-admin/agencies",      icon: "Building2" },
        { id: "users",     label: "Users",             href: "/rc-admin/users",         icon: "Users" },
      ],
    },
    {
      id: "business",
      label: "BUSINESS",
      items: [
        { id: "billing",   label: "Billing",           href: "/rc-admin/billing",       icon: "CreditCard" },
        { id: "invoices",  label: "Invoices",          href: "/rc-admin/invoices",      icon: "Receipt" },
        { id: "catalog",   label: "Service Catalog",   href: "/rc-admin/billing/services", icon: "Package" },
        { id: "agreements",label: "Agreements",        href: "/rc-admin/agreements",    icon: "FileSignature" },
      ],
    },
    {
      id: "ops",
      label: "PLATFORM OPS",
      items: [
        { id: "notices",   label: "Platform Notices",  href: "/rc-admin/support",       icon: "Megaphone" },
        { id: "dev-portal",label: "Developer Portal",  href: "/rc-admin/api-clients",   icon: "Code2" },
        // Feature flags + grants: superadmin only (see RC_SUPERADMIN_NAV)
      ],
    },
    {
      id: "locations",
      label: "LOCATIONS",
      items: [
        { id: "qr",        label: "QR Codes",          href: "/rc-admin/qr-nfc", icon: "QrCode" },
        { id: "qr-legacy", label: "Location QR (RCLI)", href: "/rc-admin/location-qr-codes", icon: "MapPin" },
      ],
    },
    {
      id: "reports",
      label: "REPORTS",
      items: [
        { id: "reports",   label: "Reports",           href: "/rc-admin/usage",         icon: "BarChart3" },
      ],
    },
  ],
};

export const RC_IT_ADMIN_NAV: RoleNav = {
  accent: "violet",
  roleBadge: "RC IT",
  sections: [
    {
      id: "infra",
      label: "INFRASTRUCTURE",
      items: [
        { id: "health",    label: "System Health",     href: "/rc-admin/infrastructure",icon: "Activity", exact: true },
        { id: "integrations",label:"Integrations",     href: "/rc-admin/integrations",  icon: "Plug" },
        { id: "cad",       label: "CAD Admin",         href: "/rc-admin/integrations",  icon: "Radio" },
        { id: "security",  label: "Security",          href: "/rc-admin/security",      icon: "ShieldAlert" },
      ],
    },
    {
      id: "tenants",
      label: "TENANTS",
      items: [
        {
          id: "agencies",
          label: "Agencies",
          href: "/rc-admin/agencies",
          icon: "Building2",
          badge: { type: "label", text: "VIEW ONLY", color: "slate" },
        },
        { id: "users",     label: "Users",             href: "/rc-admin/users",         icon: "Users",
          badge: { type: "label", text: "SUPPORT", color: "slate" } },
      ],
    },
    {
      id: "locations",
      label: "LOCATIONS",
      items: [
        { id: "qr",        label: "QR Codes",          href: "/rc-admin/qr-nfc", icon: "QrCode" },
        { id: "qr-legacy", label: "Location QR (RCLI)", href: "/rc-admin/location-qr-codes", icon: "MapPin" },
      ],
    },
    {
      id: "platform",
      label: "PLATFORM",
      items: [
        { id: "audit",     label: "Audit Log",         href: "/rc-admin/audit",         icon: "ScrollText" },
        { id: "settings",  label: "System Settings",   href: "/rc-admin/system-settings", icon: "Settings" },
      ],
    },
  ],
};

// ─── PSAP / DISPATCH ─────────────────────────────────────────────────────────
// {j} = jurisdiction slug from session/context

export function getDispatcherNav(jurisdiction: string): RoleNav {
  const j = `/${jurisdiction}`;
  return {
    accent: "sky",
    roleBadge: "DISPATCHER",
    sections: [
      {
        id: "ops",
        label: "OPERATIONS",
        items: [
          { id: "dashboard",     label: "Dashboard",       href: `${j}/dashboard`,      icon: "LayoutDashboard", exact: true },
          { id: "dispatcher",    label: "Dispatcher",      href: `${j}/dispatcher`,     icon: "Headphones" },
          { id: "intake",        label: "Intake",          href: `${j}/intake`,         icon: "PhoneIncoming" },
          { id: "triage",        label: "Triage",          href: `${j}/triage`,         icon: "ScanLine" },
          { id: "transcription", label: "Transcription",   href: `${j}/transcription`,  icon: "FileText" },
          { id: "incidents",     label: "Incidents",       href: `${j}/incidents`,      icon: "AlertCircle",
            badge: { type: "count", key: "openIncidents" } },
          { id: "history",       label: "History",         href: `${j}/history`,        icon: "Clock" },
          { id: "media",         label: "Media",           href: `${j}/media`,          icon: "Video" },
        ],
      },
    ],
  };
}

export function getSupervisorNav(jurisdiction: string): RoleNav {
  const j = `/${jurisdiction}`;
  return {
    accent: "sky",
    roleBadge: "SUPERVISOR",
    sections: [
      {
        id: "ops",
        label: "OPERATIONS",
        items: [
          { id: "dashboard",     label: "Dashboard",       href: `${j}/supervisor`,         icon: "LayoutDashboard", exact: true },
          { id: "active-calls",  label: "Active Calls",    href: `${j}/supervisor/monitor`, icon: "PhoneCall",
            badge: { type: "count", key: "activeCalls" } },
          { id: "incidents",     label: "Incidents",       href: `${j}/incidents`,          icon: "AlertCircle" },
          { id: "cad-queue",     label: "CAD Queue",       href: `${j}/review`,             icon: "Radio",
            badge: { type: "count", key: "pendingCadApprovals" },
            feature: "cadWriteback" },
        ],
      },
      {
        id: "supervisor",
        label: "SUPERVISOR",
        items: [
          { id: "qa",            label: "QA & Coaching",   href: `${j}/supervisor/coaching`, icon: "ClipboardCheck",
            feature: "qaScoringEnabled" },
          { id: "team",          label: "Team Performance",href: `${j}/supervisor/team-performance`, icon: "Users" },
          { id: "reports",       label: "Reports",         href: `${j}/supervisor/reports`, icon: "BarChart3" },
        ],
      },
      {
        id: "command",
        label: "COMMAND",
        items: [
          { id: "war-rooms",     label: "War Rooms",       href: `${j}/supervisor/command/war-rooms`, icon: "Siren" },
          { id: "status-pages",  label: "Status Pages",    href: `${j}/supervisor/command/status-pages`, icon: "Globe" },
        ],
      },
      {
        id: "review",
        label: "REVIEW",
        items: [
          { id: "audit",         label: "Audit Log",       href: `${j}/admin/audit-logs`,   icon: "ScrollText" },
          { id: "history",       label: "History",         href: `${j}/history`,            icon: "Clock" },
          { id: "media",         label: "Media",           href: `${j}/media`,              icon: "Video" },
        ],
      },
    ],
  };
}

export function getAgencyAdminNav(jurisdiction: string): RoleNav {
  const j = `/${jurisdiction}`;
  return {
    accent: "sky",
    roleBadge: "ADMIN",
    sections: [
      {
        id: "admin",
        label: "ADMINISTRATION",
        items: [
          { id: "overview",      label: "Overview",        href: `${j}/admin`,              icon: "LayoutDashboard", exact: true },
          { id: "users",         label: "Users",           href: `${j}/admin/users`,        icon: "Users" },
          { id: "roles",         label: "Roles",           href: `${j}/admin/roles`,        icon: "ShieldCheck" },
          { id: "qr-codes",      label: "QR Codes",        href: `${j}/admin/qr-codes`,     icon: "QrCode" },
        ],
      },
      {
        id: "config",
        label: "CONFIGURATION",
        items: [
          { id: "integrations",  label: "Integrations",    href: `${j}/admin/integrations`, icon: "Plug" },
          { id: "compliance",    label: "Compliance",      href: `${j}/admin/retention`,   icon: "Scale" },
          { id: "notifications", label: "Notifications",   href: `${j}/admin/notifications`, icon: "Bell" },
          { id: "settings",      label: "Settings",        href: `${j}/admin/settings`,     icon: "Settings" },
        ],
      },
      {
        id: "billing",
        label: "BILLING",
        items: [
          { id: "subscription",  label: "Subscription",    href: `${j}/admin/billing`,      icon: "CreditCard" },
          { id: "invoices",      label: "Invoices",        href: `${j}/admin/billing/invoices`, icon: "Receipt" },
        ],
      },
      {
        id: "command",
        label: "COMMAND",
        items: [
          { id: "war-rooms",     label: "War Rooms",       href: `${j}/supervisor/command/war-rooms`, icon: "Siren" },
          { id: "reviews",       label: "Post-Incident",   href: `${j}/reviews`,            icon: "FileSearch" },
        ],
      },
      {
        id: "data",
        label: "DATA",
        items: [
          { id: "reports",       label: "Reports",         href: `${j}/reports`,            icon: "BarChart3" },
          { id: "audit",         label: "Audit Log",       href: `${j}/admin/audit-logs`,   icon: "ScrollText" },
          { id: "history",       label: "History",         href: `${j}/history`,            icon: "Clock" },
        ],
      },
    ],
  };
}

export function getAgencyItNav(jurisdiction: string): RoleNav {
  const j = `/${jurisdiction}`;
  return {
    accent: "sky",
    roleBadge: "IT ADMIN",
    sections: [
      {
        id: "technical",
        label: "TECHNICAL",
        items: [
          { id: "overview",      label: "Overview",        href: `${j}/admin/it`,           icon: "LayoutDashboard", exact: true },
          { id: "integrations",  label: "Integrations",    href: `${j}/admin/integrations`, icon: "Plug" },
          { id: "cad",           label: "CAD",             href: `${j}/admin/cad`,          icon: "Radio" },
          { id: "api-keys",      label: "API Keys",        href: `${j}/admin/api-keys`,     icon: "Key" },
          { id: "webhooks",      label: "Webhooks",        href: `${j}/admin/webhooks`,     icon: "Webhook" },
        ],
      },
      {
        id: "users",
        label: "USERS",
        items: [
          { id: "users",         label: "Users",           href: `${j}/admin/users`,        icon: "Users" },
        ],
      },
      {
        id: "security",
        label: "SECURITY",
        items: [
          { id: "security",      label: "Security",        href: `${j}/admin/security`,     icon: "ShieldAlert" },
          { id: "settings",      label: "System Settings", href: `${j}/admin/settings`,     icon: "Settings" },
        ],
      },
      {
        id: "data",
        label: "DATA",
        items: [
          { id: "audit",         label: "Audit Log",       href: `${j}/admin/audit-logs`,   icon: "ScrollText" },
          { id: "reports",       label: "Reports",         href: `${j}/reports`,            icon: "BarChart3" },
        ],
      },
    ],
  };
}

export function getAnalystNav(jurisdiction: string): RoleNav {
  const j = `/${jurisdiction}`;
  return {
    accent: "sky",
    roleBadge: "QA ANALYST",
    sections: [
      {
        id: "qa",
        label: "QA",
        items: [
          { id: "dashboard",     label: "QA Dashboard",    href: `${j}/analytics`,          icon: "LayoutDashboard", exact: true },
          { id: "queue",         label: "Review Queue",    href: `${j}/qa`,                 icon: "ClipboardList",
            badge: { type: "count", key: "pendingReviews" },
            feature: "qaScoringEnabled" },
          { id: "scorecards",    label: "Scorecards",      href: `${j}/supervisor/scorecards`, icon: "ClipboardCheck",
            feature: "qaScoringEnabled" },
          { id: "coaching",      label: "Coaching Notes",  href: `${j}/supervisor/coaching`, icon: "MessageSquare",
            feature: "qaScoringEnabled" },
        ],
      },
      {
        id: "data",
        label: "DATA",
        items: [
          { id: "transcripts",   label: "Transcripts",     href: `${j}/history`,            icon: "FileText" },
          { id: "reports",       label: "Reports",         href: `${j}/reports`,            icon: "BarChart3" },
          { id: "history",       label: "History",         href: `${j}/history`,            icon: "Clock" },
        ],
      },
      {
        id: "review",
        label: "REVIEW",
        items: [
          { id: "reviews",       label: "Post-Incident",   href: `${j}/reviews`,            icon: "FileSearch" },
          { id: "audit",         label: "Audit Log",       href: `${j}/admin/audit-logs`,   icon: "ScrollText",
            badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
        ],
      },
    ],
  };
}

export function getAuditorNav(jurisdiction: string): RoleNav {
  const j = `/${jurisdiction}`;
  return {
    accent: "sky",
    roleBadge: "AUDITOR",
    sections: [
      {
        id: "compliance",
        label: "COMPLIANCE",
        items: [
          { id: "overview",      label: "Audit Overview",  href: `${j}/audit`,              icon: "LayoutDashboard", exact: true },
          { id: "log",           label: "Audit Log",       href: `${j}/admin/audit-logs`,   icon: "ScrollText" },
          { id: "cad-audit",     label: "CAD Writeback",   href: `${j}/admin/cad`,          icon: "Radio",
            feature: "cadWriteback" },
          { id: "access",        label: "Access Reports",  href: `${j}/reports`,            icon: "UserCheck",
            badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
        ],
      },
      {
        id: "data",
        label: "DATA",
        items: [
          { id: "reports",       label: "Reports",         href: `${j}/reports`,            icon: "BarChart3",
            badge: { type: "label", text: "EXPORT ONLY", color: "slate" } },
          { id: "history",       label: "History",         href: `${j}/history`,            icon: "Clock" },
          { id: "reviews",       label: "Post-Incident",   href: `${j}/reviews`,            icon: "FileSearch" },
        ],
      },
    ],
  };
}

// ─── CAMPUS ───────────────────────────────────────────────────────────────────
// {code} = campus code extracted from agencyId

export function getCampusAdminNav(code: string): RoleNav {
  const base = `/app/campus/${code}`;
  return {
    accent: "slate",
    roleBadge: "CAMPUS ADMIN",
    sections: [
      {
        id: "safety",
        label: "CAMPUS SAFETY",
        items: [
          { id: "dashboard",   label: "Dashboard",         href: base,                      icon: "LayoutDashboard", exact: true },
          { id: "incidents",   label: "Incidents",         href: `${base}/incidents`,       icon: "AlertCircle",
            badge: { type: "count", key: "openIncidents" } },
          { id: "qr",          label: "QR Codes",          href: `${base}/qr-codes`,        icon: "QrCode" },
          { id: "zones",       label: "Zones",             href: `${base}/zones`,           icon: "Map" },
          { id: "buildings",   label: "Buildings",         href: `${base}/buildings`,       icon: "Building" },
        ],
      },
      {
        id: "management",
        label: "MANAGEMENT",
        items: [
          { id: "users",       label: "Users",             href: `${base}/users`,           icon: "Users" },
          { id: "analytics",   label: "Analytics",         href: `${base}/analytics`,       icon: "BarChart3" },
          { id: "reports",     label: "Reports",           href: `${base}/reports`,         icon: "FileBarChart" },
        ],
      },
      {
        id: "config",
        label: "CONFIGURATION",
        items: [
          { id: "settings",    label: "Settings",          href: `${base}/settings`,        icon: "Settings" },
        ],
      },
    ],
  };
}

export function getCampusSupervisorNav(code: string): RoleNav {
  const base = `/app/campus/${code}`;
  return {
    accent: "slate",
    roleBadge: "CAMPUS SUPERVISOR",
    sections: [
      {
        id: "safety",
        label: "CAMPUS SAFETY",
        items: [
          { id: "dashboard",   label: "Dashboard",         href: base,                      icon: "LayoutDashboard", exact: true },
          { id: "incidents",   label: "Incidents",         href: `${base}/incidents`,       icon: "AlertCircle",
            badge: { type: "count", key: "openIncidents" } },
          { id: "qr",          label: "QR Codes",          href: `${base}/qr-codes`,        icon: "QrCode",
            badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
          { id: "zones",       label: "Zones",             href: `${base}/zones`,           icon: "Map" },
        ],
      },
      {
        id: "reports",
        label: "REPORTS",
        items: [
          { id: "reports",     label: "Reports",           href: `${base}/reports`,         icon: "FileBarChart" },
        ],
      },
    ],
  };
}

export function getCampusSecurityNav(code: string): RoleNav {
  const base = `/app/campus/${code}`;
  return {
    accent: "slate",
    roleBadge: "CAMPUS SECURITY",
    sections: [
      {
        id: "safety",
        label: "CAMPUS SAFETY",
        items: [
          { id: "dashboard",   label: "Dashboard",         href: base,                      icon: "LayoutDashboard", exact: true },
          { id: "incidents",   label: "Incidents",         href: `${base}/incidents`,       icon: "AlertCircle" },
          { id: "qr",          label: "QR Codes",          href: `${base}/qr-codes`,        icon: "QrCode",
            badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
          { id: "zones",       label: "Zones",             href: `${base}/zones`,           icon: "Map" },
        ],
      },
    ],
  };
}

export function getCampusDispatchNav(code: string): RoleNav {
  const base = `/app/campus/${code}`;
  return {
    accent: "slate",
    roleBadge: "CAMPUS DISPATCH",
    sections: [
      {
        id: "dispatch",
        label: "CAMPUS DISPATCH",
        items: [
          { id: "dashboard",   label: "Dashboard",         href: base,                      icon: "LayoutDashboard", exact: true },
          { id: "incidents",   label: "Incident Queue",    href: `${base}/incidents`,       icon: "ClipboardList",
            badge: { type: "count", key: "openIncidents" } },
          { id: "zones",       label: "Zones",             href: `${base}/zones`,           icon: "Map" },
        ],
      },
      {
        id: "reports",
        label: "REPORTS",
        items: [
          { id: "reports",     label: "Reports",           href: `${base}/reports`,         icon: "FileBarChart",
            badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
        ],
      },
    ],
  };
}

// ─── HOSPITAL ─────────────────────────────────────────────────────────────────

export const HOSPITAL_ADMIN_NAV: RoleNav = {
  accent: "teal",
  roleBadge: "HOSPITAL ADMIN",
  sections: [
    {
      id: "facility",
      label: "FACILITY",
      items: [
        { id: "dashboard",   label: "Dashboard",         href: "/hospital-admin/dashboard",  icon: "LayoutDashboard", exact: true },
        { id: "capacity",    label: "Capacity",          href: "/hospital-admin/capacity",   icon: "BedDouble" },
        { id: "routing",     label: "Routing Config",    href: "/hospital-admin/routing",    icon: "Route" },
        { id: "regional",    label: "Regional Map",      href: "/hospital-admin/regional-map", icon: "Map" },
      ],
    },
    {
      id: "management",
      label: "MANAGEMENT",
      items: [
        { id: "users",       label: "Users",             href: "/hospital-admin/users",      icon: "Users" },
        { id: "analytics",   label: "Analytics",         href: "/hospital-admin/analytics",  icon: "BarChart3" },
        { id: "reports",     label: "Reports",           href: "/hospital-admin/reports",    icon: "FileBarChart" },
      ],
    },
    {
      id: "config",
      label: "CONFIGURATION",
      items: [
        { id: "settings",    label: "Settings",          href: "/hospital-admin/settings",   icon: "Settings" },
      ],
    },
  ],
};

export const HOSPITAL_COORDINATOR_NAV: RoleNav = {
  accent: "teal",
  roleBadge: "COORDINATOR",
  sections: [
    {
      id: "ops",
      label: "OPERATIONS",
      items: [
        { id: "dashboard",   label: "Dashboard",         href: "/hospital-admin/dashboard",  icon: "LayoutDashboard", exact: true },
        { id: "capacity",    label: "Capacity",          href: "/hospital-admin/capacity",   icon: "BedDouble" },
        { id: "regional",    label: "Regional Map",      href: "/hospital-admin/regional-map", icon: "Map" },
      ],
    },
    {
      id: "reports",
      label: "REPORTS",
      items: [
        { id: "analytics",   label: "Analytics",         href: "/hospital-admin/analytics",  icon: "BarChart3",
          badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
        { id: "routing",     label: "Routing Config",    href: "/hospital-admin/routing",    icon: "Route",
          badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
      ],
    },
  ],
};

export const HOSPITAL_STAFF_NAV: RoleNav = {
  accent: "teal",
  roleBadge: "STAFF",
  sections: [
    {
      id: "capacity",
      label: "CAPACITY",
      items: [
        { id: "update",      label: "Update Capacity",   href: "/hospital-staff/dashboard",  icon: "BedDouble", exact: true },
        { id: "history",     label: "My History",        href: "/hospital-staff/history",    icon: "Clock" },
      ],
    },
  ],
};

// ─── VENUE ────────────────────────────────────────────────────────────────────
// {code} = venue code extracted from agencyId

export function getVenueAdminNav(code: string): RoleNav {
  const base = `/app/venue/${code}`;
  return {
    accent: "orange",
    roleBadge: "VENUE ADMIN",
    sections: [
      {
        id: "ops",
        label: "VENUE OPS",
        items: [
          { id: "dashboard",   label: "Dashboard",         href: base,                       icon: "LayoutDashboard", exact: true },
          { id: "incidents",   label: "Incidents",         href: `${base}/incidents`,        icon: "AlertCircle",
            badge: { type: "count", key: "openIncidents" } },
          { id: "guest",       label: "Guest Reports",     href: `${base}/reports`,          icon: "MessageSquare",
            badge: { type: "count", key: "openGuestReports" } },
          { id: "staff",       label: "Staff",             href: `${base}/staff`,            icon: "Users" },
          { id: "cameras",     label: "Cameras",           href: `${base}/cameras`,          icon: "Camera" },
        ],
      },
      {
        id: "management",
        label: "VENUE MGMT",
        items: [
          { id: "qr",          label: "QR Codes",          href: `${base}/qr-codes`,         icon: "QrCode" },
          { id: "zones",       label: "Zones",             href: `${base}/zones`,            icon: "Map" },
          { id: "analytics",   label: "Analytics",         href: `${base}/analytics`,        icon: "BarChart3" },
          { id: "reports",     label: "Reports",           href: `${base}/reports`,          icon: "FileBarChart" },
        ],
      },
      {
        id: "config",
        label: "CONFIGURATION",
        items: [
          { id: "settings",    label: "Settings",          href: `${base}/settings`,         icon: "Settings" },
        ],
      },
    ],
  };
}

export function getVenueSupervisorNav(code: string): RoleNav {
  const base = `/app/venue/${code}`;
  return {
    accent: "orange",
    roleBadge: "SUPERVISOR",
    sections: [
      {
        id: "ops",
        label: "VENUE OPS",
        items: [
          { id: "dashboard",   label: "Dashboard",         href: base,                       icon: "LayoutDashboard", exact: true },
          { id: "incidents",   label: "Incidents",         href: `${base}/incidents`,        icon: "AlertCircle",
            badge: { type: "count", key: "openIncidents" } },
          { id: "guest",       label: "Guest Reports",     href: `${base}/reports`,          icon: "MessageSquare",
            badge: { type: "count", key: "openGuestReports" } },
          { id: "staff",       label: "Staff",             href: `${base}/staff`,            icon: "Users" },
          { id: "cameras",     label: "Cameras",           href: `${base}/cameras`,          icon: "Camera" },
        ],
      },
      {
        id: "management",
        label: "VENUE MGMT",
        items: [
          { id: "qr",          label: "QR Codes",          href: `${base}/qr-codes`,         icon: "QrCode",
            badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
          { id: "zones",       label: "Zones",             href: `${base}/zones`,            icon: "Map" },
          { id: "analytics",   label: "Analytics",         href: `${base}/analytics`,        icon: "BarChart3" },
          { id: "reports",     label: "Reports",           href: `${base}/reports`,          icon: "FileBarChart" },
        ],
      },
    ],
  };
}

export function getVenueSecurityNav(code: string): RoleNav {
  const base = `/app/venue/${code}`;
  return {
    accent: "orange",
    roleBadge: "SECURITY",
    sections: [
      {
        id: "ops",
        label: "VENUE OPS",
        items: [
          { id: "dashboard",   label: "Dashboard",         href: base,                       icon: "LayoutDashboard", exact: true },
          { id: "incidents",   label: "Incidents",         href: `${base}/incidents`,        icon: "AlertCircle" },
          { id: "guest",       label: "Guest Reports",     href: `${base}/reports`,          icon: "MessageSquare" },
          { id: "cameras",     label: "Cameras",           href: `${base}/cameras`,          icon: "Camera" },
          { id: "zones",       label: "Zones",             href: `${base}/zones`,            icon: "Map" },
        ],
      },
    ],
  };
}

export function getVenueOperatorNav(code: string): RoleNav {
  const base = `/app/venue/${code}`;
  return {
    accent: "orange",
    roleBadge: "OPERATOR",
    sections: [
      {
        id: "ops",
        label: "VENUE OPS",
        items: [
          { id: "dashboard",   label: "Dashboard",         href: base,                       icon: "LayoutDashboard", exact: true },
          { id: "incidents",   label: "Incidents",         href: `${base}/incidents`,        icon: "AlertCircle",
            badge: { type: "label", text: "VIEW ONLY", color: "slate" } },
        ],
      },
    ],
  };
}

export function getVenueGuestServicesNav(code: string): RoleNav {
  const base = `/app/venue/${code}`;
  return {
    accent: "orange",
    roleBadge: "GUEST SERVICES",
    sections: [
      {
        id: "guest",
        // No section label — single-section roles get no header
        items: [
          { id: "reports",     label: "Guest Reports",     href: `${base}/reports`,          icon: "MessageSquare", exact: true },
        ],
      },
    ],
  };
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

function resolveNavRole(raw: string): string {
  const token = raw.trim();
  const upper = token.toUpperCase();
  if (upper.startsWith("VENUE_")) return upper;
  if (upper.startsWith("CAMPUS_")) return upper;
  if (upper === "HOSPITAL_COORDINATOR") return "HOSPITAL_COORDINATOR";
  if (upper === "HOSPITAL_ADMIN") return "HOSPITAL_ADMIN";
  if (upper === "HOSPITAL_STAFF") return "HOSPITAL_STAFF";

  const migrated = migrateLegacyRapidCortexRoleTokenValue(token) ?? token;
  if (migrated === "hospitaladmin") return "HOSPITAL_ADMIN";
  if (migrated === "hospitalstaff") return "HOSPITAL_STAFF";
  return migrated;
}

export type NavContext = {
  jurisdiction?: string;   // PSAP slug
  venueCode?: string;
  campusCode?: string;
};

export function getRoleNav(role: string, ctx: NavContext): RoleNav {
  const j = ctx.jurisdiction ?? "jurisdiction";
  const v = ctx.venueCode ?? "venue";
  const c = ctx.campusCode ?? "campus";
  const resolved = resolveNavRole(role);

  switch (resolved) {
    // RC Internal
    case "rcsuperadmin":        return RC_SUPERADMIN_NAV;
    case "rcadmin":             return RC_ADMIN_NAV;
    case "rcitadmin":           return RC_IT_ADMIN_NAV;
    // PSAP
    case "dispatcher":          return getDispatcherNav(j);
    case "supervisor":          return getSupervisorNav(j);
    case "agencyadmin":         return getAgencyAdminNav(j);
    case "agencyit":            return getAgencyItNav(j);
    case "analyst":             return getAnalystNav(j);
    case "auditor":             return getAuditorNav(j);
    // Campus
    case "CAMPUS_ADMIN":        return getCampusAdminNav(c);
    case "CAMPUS_SUPERVISOR":   return getCampusSupervisorNav(c);
    case "CAMPUS_SECURITY":     return getCampusSecurityNav(c);
    case "CAMPUS_DISPATCH":     return getCampusDispatchNav(c);
    // Hospital
    case "HOSPITAL_ADMIN":      return HOSPITAL_ADMIN_NAV;
    case "HOSPITAL_COORDINATOR":return HOSPITAL_COORDINATOR_NAV;
    case "HOSPITAL_STAFF":      return HOSPITAL_STAFF_NAV;
    // Venue
    case "VENUE_ADMIN":         return getVenueAdminNav(v);
    case "VENUE_SUPERVISOR":    return getVenueSupervisorNav(v);
    case "VENUE_SECURITY":      return getVenueSecurityNav(v);
    case "VENUE_OPERATOR":      return getVenueOperatorNav(v);
    case "VENUE_GUEST_SERVICES":return getVenueGuestServicesNav(v);

    default:
      // Unknown role — return a minimal safe nav that redirects to sign-out
      return {
        accent: "slate",
        roleBadge: "UNKNOWN",
        sections: [{ id: "fallback", items: [
          { id: "signout", label: "Sign Out", href: "/auth/signout", icon: "LogOut" },
        ]}],
      };
  }
}
