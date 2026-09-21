/**
 * Campus / venue / transit Staff Guide catalog.
 *
 * This is the product-vertical knowledge base (onboarding + ongoing reference).
 * It is not the 911 Help tab used on PSAP dispatcher consoles.
 *
 * Access is unlimited: no seats, session caps, or article-view quotas.
 */

export type StaffGuideVertical = "campus" | "venue" | "transit";

export interface StaffGuideArticle {
  topic: string;
  title: string;
  description: string;
  /** Load markdown from /staff-guide/shared/{topic}.md instead of the vertical folder. */
  shared?: boolean;
}

export interface StaffGuideSection {
  section: string;
  articles: StaffGuideArticle[];
}

export type StaffGuideIndex = StaffGuideSection[];

export interface StaffGuidePosition {
  id: string;
  title: string;
  topic: string;
  summary: string;
  roleTokens: readonly string[];
}

export const STAFF_GUIDE_ACCESS = {
  unlimited: true as const,
  quota: null,
  headline: "Unlimited training access",
  message:
    "Every signed-in campus, venue, and transit staff account can open every article in this guide as often as needed. There is no seat cap, session limit, or view quota.",
} as const;

const SHARED_FIELD_TOOLS: StaffGuideSection = {
  section: "Field tools",
  articles: [
    {
      topic: "qr-nfc-update",
      title: "Update QR codes and NFC tags",
      description: "Reprint QR art, reprogram NFC tags, assign cameras, and reactivate a code.",
      shared: true,
    },
    {
      topic: "delete-locations",
      title: "Delete locations from the dashboard",
      description: "Deactivate a reporting point or RCLI location so scans and taps stop working.",
      shared: true,
    },
  ],
};

const CAMPUS_CONSOLE: StaffGuideSection = {
  section: "How to use the console",
  articles: [
    {
      topic: "when-to-call-911",
      title: "When to call 911",
      description: "What Rapid Cortex Campus handles versus a public-safety emergency.",
    },
    {
      topic: "incidents",
      title: "Work campus incidents",
      description: "Open, assign, update, close, and escalate campus safety reports.",
    },
    {
      topic: "cameras",
      title: "Cameras, Camera AI, and video wall",
      description: "Watch cameras for awareness. AI never creates an incident or dispatches units.",
    },
    {
      topic: "qr-codes",
      title: "QR Codes page",
      description: "Named Field-app report codes versus Location QR (RCLI).",
    },
    {
      topic: "zones-buildings",
      title: "Zones and buildings",
      description: "Campus geography used on incidents, cameras, and posted codes.",
    },
    {
      topic: "users",
      title: "Invite and manage campus users",
      description: "Provision Campus Admin, Supervisor, Security, Dispatch, Counselor, and Faculty.",
    },
    {
      topic: "occupant-alerts",
      title: "Occupant alerts",
      description: "Send campus occupant notifications when the alerts module is on.",
    },
    {
      topic: "reports",
      title: "Reports and Clery tools",
      description: "Campus analytics, Clery review queues, and what Rapid Cortex does not file.",
    },
  ],
};

const VENUE_CONSOLE: StaffGuideSection = {
  section: "How to use the console",
  articles: [
    {
      topic: "when-to-call-911",
      title: "When to call 911",
      description: "Guest reports and venue incidents versus a 911 emergency.",
    },
    {
      topic: "incidents",
      title: "Work venue incidents",
      description: "Section incidents, assignment, and notes — not a CAD queue.",
    },
    {
      topic: "guest-reports",
      title: "Guest Reports inbox",
      description: "Reports that arrive from QR, NFC, SMS, or staff entry.",
    },
    {
      topic: "cameras",
      title: "Cameras, Camera AI, and video wall",
      description: "Event cameras for awareness. AI never dispatches units.",
    },
    {
      topic: "qr-codes",
      title: "QR Codes page",
      description: "Zone scan points for guest reporting, print assets, and deactivate.",
    },
    {
      topic: "staff-users",
      title: "Staff accounts",
      description: "Venue Admin, Supervisor, Security, Operator, and Guest Services.",
    },
    {
      topic: "zones",
      title: "Zones and sections",
      description: "Gates, levels, and sections used on incidents and posted codes.",
    },
    {
      topic: "occupant-alerts",
      title: "Occupant alerts",
      description: "In-venue occupant notifications when the alerts module is on.",
    },
  ],
};

const TRANSIT_CONSOLE: StaffGuideSection = {
  section: "How to use the console",
  articles: [
    {
      topic: "when-to-call-911",
      title: "When to call 911",
      description: "On-system incidents versus a public-safety emergency. No CAD write-back.",
    },
    {
      topic: "fleet-routes",
      title: "Fleet, routes, and stations",
      description: "Vehicles, routes, and stations on the transit operations console.",
    },
    {
      topic: "incidents",
      title: "Work transit incidents",
      description: "Create and update on-system incidents. 911 escalate is audit-only.",
    },
    {
      topic: "cameras",
      title: "Cameras and video wall",
      description: "Vehicle and station cameras for awareness, not automatic dispatch.",
    },
    {
      topic: "qr-codes",
      title: "QR Codes page",
      description: "Passenger report codes on vehicles and stations.",
    },
    {
      topic: "users",
      title: "Transit users",
      description: "Invite Transit Admin, Supervisor, Security, and Operator accounts.",
    },
    {
      topic: "occupant-alerts",
      title: "Occupant alerts and broadcasts",
      description: "Alert level and occupant notifications for the transit system.",
    },
  ],
};

export const CAMPUS_POSITIONS: readonly StaffGuidePosition[] = [
  {
    id: "admin",
    title: "Campus Admin",
    topic: "position-admin",
    summary: "Tenant configuration, users, QR/NFC, buildings, Clery tools, and escalation policy.",
    roleTokens: ["CAMPUS_ADMIN", "campus_admin"],
  },
  {
    id: "supervisor",
    title: "Campus Supervisor",
    topic: "position-supervisor",
    summary: "Live campus ops, QR/NFC management, incident oversight, and 911 handoff.",
    roleTokens: ["CAMPUS_SUPERVISOR", "campus_supervisor"],
  },
  {
    id: "security",
    title: "Campus Security",
    topic: "position-security",
    summary: "Field incident intake, public QR reports, cameras, and zone awareness.",
    roleTokens: ["CAMPUS_SECURITY", "campus_security"],
  },
  {
    id: "dispatch",
    title: "Campus Dispatch",
    topic: "position-dispatch",
    summary: "Campus incident queue, cameras, and coordination — not a 911 CAD workspace.",
    roleTokens: ["CAMPUS_DISPATCH", "campus_dispatch"],
  },
  {
    id: "counselor",
    title: "Campus Counselor",
    topic: "position-counselor",
    summary: "Wellness-queue access only. No cameras, CAD, or campus-wide incident command.",
    roleTokens: ["CAMPUS_COUNSELOR", "campus_counselor"],
  },
  {
    id: "faculty",
    title: "Campus Faculty",
    topic: "position-faculty",
    summary: "Submit and track safety reports. View-only translate. No security console.",
    roleTokens: ["CAMPUS_FACULTY", "campus_faculty"],
  },
];

export const VENUE_POSITIONS: readonly StaffGuidePosition[] = [
  {
    id: "admin",
    title: "Venue Admin",
    topic: "position-admin",
    summary: "Venue console, staff, QR/NFC, zones, analytics, and event configuration.",
    roleTokens: ["VENUE_ADMIN", "venue_admin"],
  },
  {
    id: "supervisor",
    title: "Venue Supervisor",
    topic: "position-supervisor",
    summary: "Section status, guest reports, cameras, and QR/NFC for the event.",
    roleTokens: ["VENUE_SUPERVISOR", "venue_supervisor"],
  },
  {
    id: "security",
    title: "Venue Security",
    topic: "position-security",
    summary: "Section incidents, guest-report intake, and camera awareness on the floor.",
    roleTokens: ["VENUE_SECURITY", "venue_security"],
  },
  {
    id: "operator",
    title: "Venue Operator",
    topic: "position-operator",
    summary: "QR/NFC posting, view-only incidents, and guest-assist field support.",
    roleTokens: ["VENUE_OPERATOR", "venue_operator"],
  },
  {
    id: "guest-services",
    title: "Venue Guest Services",
    topic: "position-guest-services",
    summary: "Guest reports inbox only. Not a 911 emergency dispatch system.",
    roleTokens: ["VENUE_GUEST_SERVICES", "VENUE_GUEST", "venue_guest_services", "venue_guest"],
  },
];

export const TRANSIT_POSITIONS: readonly StaffGuidePosition[] = [
  {
    id: "admin",
    title: "Transit Admin",
    topic: "position-admin",
    summary: "Fleet, routes, users, QR/NFC on vehicles and stations, and camera registry.",
    roleTokens: ["TRANSIT_ADMIN", "transit_admin"],
  },
  {
    id: "supervisor",
    title: "Transit Supervisor",
    topic: "position-supervisor",
    summary: "Ops dashboard, incidents, broadcasts, and QR/NFC for the system.",
    roleTokens: ["TRANSIT_SUPERVISOR", "transit_supervisor"],
  },
  {
    id: "security",
    title: "Transit Security",
    topic: "position-security",
    summary: "Field incidents on routes and at stations. Escalation is audit-only — no CAD write-back.",
    roleTokens: ["TRANSIT_SECURITY", "transit_security"],
  },
  {
    id: "operator",
    title: "Transit Operator",
    topic: "position-operator",
    summary: "Your vehicle, fleet view, and incident reporting from the operator console.",
    roleTokens: ["TRANSIT_OPERATOR", "transit_operator"],
  },
];

const CAMPUS_GUIDE: StaffGuideIndex = [
  {
    section: "Campus Safety vertical",
    articles: [
      {
        topic: "overview",
        title: "Campus Safety overview",
        description: "What this product is, what it is not, and how campus roles work together.",
      },
      {
        topic: "onboarding",
        title: "New employee onboarding",
        description: "First-week checklist for campus staff: sign-in, your console, and when to call 911.",
      },
    ],
  },
  {
    section: "Positions",
    articles: CAMPUS_POSITIONS.map((position) => ({
      topic: position.topic,
      title: position.title,
      description: position.summary,
    })),
  },
  CAMPUS_CONSOLE,
  SHARED_FIELD_TOOLS,
];

const VENUE_GUIDE: StaffGuideIndex = [
  {
    section: "Venue Operations vertical",
    articles: [
      {
        topic: "overview",
        title: "Venue Operations overview",
        description: "Event and facility operations intelligence — not a 911 emergency dispatch system.",
      },
      {
        topic: "onboarding",
        title: "New employee onboarding",
        description: "First-week checklist for venue staff: console, guest reports, and when to call 911.",
      },
    ],
  },
  {
    section: "Positions",
    articles: VENUE_POSITIONS.map((position) => ({
      topic: position.topic,
      title: position.title,
      description: position.summary,
    })),
  },
  VENUE_CONSOLE,
  SHARED_FIELD_TOOLS,
];

const TRANSIT_GUIDE: StaffGuideIndex = [
  {
    section: "Transit Operations vertical",
    articles: [
      {
        topic: "overview",
        title: "Transit Operations overview",
        description: "Fleet, routes, stations, and on-system incidents — not a replacement for 911 or transit CAD.",
      },
      {
        topic: "onboarding",
        title: "New employee onboarding",
        description: "First-week checklist for transit staff: console, vehicles, and when to call 911.",
      },
    ],
  },
  {
    section: "Positions",
    articles: TRANSIT_POSITIONS.map((position) => ({
      topic: position.topic,
      title: position.title,
      description: position.summary,
    })),
  },
  TRANSIT_CONSOLE,
  SHARED_FIELD_TOOLS,
];

const BY_VERTICAL: Record<StaffGuideVertical, StaffGuideIndex> = {
  campus: CAMPUS_GUIDE,
  venue: VENUE_GUIDE,
  transit: TRANSIT_GUIDE,
};

const POSITIONS_BY_VERTICAL: Record<StaffGuideVertical, readonly StaffGuidePosition[]> = {
  campus: CAMPUS_POSITIONS,
  venue: VENUE_POSITIONS,
  transit: TRANSIT_POSITIONS,
};

export function staffGuideVerticalFromRole(role: string): StaffGuideVertical | null {
  const token = (role ?? "").trim().toUpperCase().replace(/-/g, "_");
  if (token.startsWith("CAMPUS_")) return "campus";
  if (token.startsWith("VENUE_")) return "venue";
  if (token.startsWith("TRANSIT_")) return "transit";
  const lower = (role ?? "").trim().toLowerCase().replace(/-/g, "_");
  if (lower.startsWith("campus_")) return "campus";
  if (lower.startsWith("venue_")) return "venue";
  if (lower.startsWith("transit_")) return "transit";
  return null;
}

export function isStaffGuideRole(role: string): boolean {
  return staffGuideVerticalFromRole(role) !== null;
}

export function getStaffGuideIndex(vertical: StaffGuideVertical): StaffGuideIndex {
  return BY_VERTICAL[vertical];
}

export function getStaffGuidePositions(vertical: StaffGuideVertical): readonly StaffGuidePosition[] {
  return POSITIONS_BY_VERTICAL[vertical];
}

export function findStaffGuideArticle(
  vertical: StaffGuideVertical,
  topic: string,
): StaffGuideArticle | undefined {
  for (const section of getStaffGuideIndex(vertical)) {
    const found = section.articles.find((article) => article.topic === topic);
    if (found) return found;
  }
  return undefined;
}

export function positionForRole(
  vertical: StaffGuideVertical,
  role: string,
): StaffGuidePosition | undefined {
  const tokens = new Set([
    role.trim(),
    role.trim().toUpperCase(),
    role.trim().toLowerCase(),
    role.trim().toUpperCase().replace(/-/g, "_"),
    role.trim().toLowerCase().replace(/-/g, "_"),
  ]);
  return getStaffGuidePositions(vertical).find((position) =>
    position.roleTokens.some((token) => tokens.has(token)),
  );
}

export function flattenStaffGuideArticles(vertical: StaffGuideVertical): StaffGuideArticle[] {
  return getStaffGuideIndex(vertical).flatMap((section) => section.articles);
}
