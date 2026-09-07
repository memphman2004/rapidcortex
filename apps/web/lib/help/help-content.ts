/**
 * Rapid Cortex — Help Content Index
 *
 * Maps each role to its ordered list of articles.
 * The `topic` field is the S3 key suffix: help/{role}/{topic}.md
 *
 * To add a new article:
 *   1. Add an entry here under the appropriate role(s).
 *   2. Upload the .md file to S3: aws s3 cp my-guide.md s3://<HelpBucket>/help/{role}/{topic}.md
 *   3. CloudFront will pick it up within the cache TTL (5 min).
 */

export interface HelpArticle {
  topic: string;
  title: string;
  /** Short description shown in the article list */
  description: string;
  /** Optional: contextual anchor IDs for deep-linking from feature ?-icons */
  anchors?: string[];
}

export interface HelpSection {
  section: string;
  articles: HelpArticle[];
}

export type HelpIndex = HelpSection[];

// ── Core PSAP roles ────────────────────────────────────────────────────────

const DISPATCHER_HELP: HelpIndex = [
  {
    section: "Getting Started",
    articles: [
      { topic: "index",            title: "Dispatcher Overview",             description: "Your workspace, key panels, and how to navigate." },
      { topic: "first-incident",   title: "Creating Your First Incident",    description: "Step-by-step from intake to CAD submission." },
    ],
  },
  {
    section: "Live Call Workspace",
    articles: [
      { topic: "sop-protocol",     title: "SOP Protocol AI",                 description: "How the AI suggests protocols and how to override." },
      { topic: "triage",           title: "AI Triage & Confidence Score",    description: "Understanding the triage snapshot and re-running analysis." },
      { topic: "cad-entry",        title: "CAD Entry & Submission",          description: "Submitting incidents to CAD from the workspace." },
      { topic: "translation",      title: "Real-Time Translation",           description: "Starting a language session during a live call." },
      { topic: "caller-card",      title: "Caller Card & Premise Notes",     description: "Reading hazard flags and prior incident history." },
    ],
  },
  {
    section: "Caller Media",
    articles: [
      { topic: "silent-text",      title: "Silent Text Link",                description: "Sending an SMS secure link when the caller can't speak." },
      { topic: "live-video",       title: "Caller Video Assist",             description: "Requesting a live video stream from the caller's phone." },
      { topic: "pinpoint",         title: "Pinpoint Location",               description: "Requesting and reading the caller's GPS location." },
    ],
  },
  {
    section: "Incidents",
    articles: [
      { topic: "incident-notes",   title: "Adding Incident Updates",         description: "Logging dispatcher notes and status changes." },
      { topic: "incident-shares",  title: "Sharing an Incident",             description: "Cross-agency incident shares and what they expose." },
    ],
  },
];

const SUPERVISOR_HELP: HelpIndex = [
  {
    section: "Getting Started",
    articles: [
      { topic: "index",            title: "Supervisor Overview",             description: "Floor view, call queue, and your available actions." },
    ],
  },
  {
    section: "Floor Oversight",
    articles: [
      { topic: "floor-monitoring", title: "Live Floor Monitoring",           description: "Watching active calls and dispatcher status in real time." },
      { topic: "cad-approval",     title: "CAD Approval Workflow",           description: "Reviewing and approving CAD submissions from dispatchers." },
      { topic: "call-transfer",    title: "Call Transfer & Takeover",        description: "Transferring a call between dispatchers or taking it over." },
      { topic: "war-rooms",        title: "War Rooms & Incident Command",    description: "Opening a war room for multi-agency or MCI events." },
    ],
  },
  {
    section: "QA & Coaching",
    articles: [
      { topic: "qa-scorecards",    title: "QA Scorecards",                   description: "Reviewing call quality scores for your team." },
      { topic: "coaching-notes",   title: "Dispatcher Coaching Notes",       description: "Adding coaching notes to a dispatcher's record." },
      { topic: "wellness-flags",   title: "Wellness Flags",                  description: "Acknowledging and managing dispatcher wellness flags." },
    ],
  },
  {
    section: "Reporting",
    articles: [
      { topic: "reports",          title: "Shift & Incident Reports",        description: "Running reports for your shift and exporting to CSV." },
      { topic: "stakeholder-pages",title: "Stakeholder Status Pages",        description: "Sharing live incident status with command staff." },
    ],
  },
];

const AGENCY_ADMIN_HELP: HelpIndex = [
  {
    section: "Getting Started",
    articles: [
      { topic: "index",            title: "Agency Admin Overview",           description: "Your admin console and what you can manage." },
    ],
  },
  {
    section: "User Management",
    articles: [
      { topic: "create-user",      title: "Creating a New User",             description: "Inviting and provisioning a new dispatcher, supervisor, or admin." },
      { topic: "assign-roles",     title: "Assigning & Changing Roles",      description: "Promoting dispatchers, setting role-based permissions." },
      { topic: "deactivate-user",  title: "Deactivating a User Account",     description: "Removing access without deleting the user record." },
    ],
  },
  {
    section: "Agency Settings",
    articles: [
      { topic: "sop-library",      title: "SOP Library & Protocol Upload",   description: "Uploading and managing your agency's SOP documents." },
      { topic: "cad-integration",  title: "CAD Integration Setup",           description: "Connecting Rapid Cortex to your CAD system." },
      { topic: "api-keys",         title: "API Keys & Webhooks",             description: "Issuing API keys for integrations and managing webhooks." },
      { topic: "mfa-policy",       title: "MFA Policy",                      description: "Enforcing multi-factor authentication for your agency." },
      { topic: "data-retention",   title: "Data Retention Settings",         description: "Configuring how long incident and transcript data is kept." },
    ],
  },
  {
    section: "Billing & Add-Ons",
    articles: [
      { topic: "billing",          title: "Billing & Subscriptions",         description: "Viewing invoices, payment methods, and your plan." },
      { topic: "addons",           title: "Feature Add-Ons",                 description: "Enabling or disabling optional feature modules." },
    ],
  },
];

const AGENCY_IT_HELP: HelpIndex = [
  {
    section: "Getting Started",
    articles: [
      { topic: "index",            title: "Agency IT Overview",              description: "What you can access and what requires Agency Admin." },
    ],
  },
  {
    section: "Integrations",
    articles: [
      { topic: "cad-integration",  title: "CAD Integration Setup",           description: "Connecting Rapid Cortex to your CAD system." },
      { topic: "api-keys",         title: "API Keys & Webhooks",             description: "Issuing and rotating API keys for integrations." },
      { topic: "mfa-policy",       title: "MFA Policy Configuration",        description: "Setting MFA requirements for your agency." },
    ],
  },
  {
    section: "Troubleshooting",
    articles: [
      { topic: "auth-issues",      title: "User Login & Auth Issues",        description: "Diagnosing login failures, locked accounts, and MFA problems." },
      { topic: "integration-test", title: "Testing Integrations",            description: "Using the integration test console to verify connectivity." },
    ],
  },
];

const ANALYST_HELP: HelpIndex = [
  {
    section: "Getting Started",
    articles: [
      { topic: "index",            title: "Analyst Overview",                description: "Your analytics surfaces and export options." },
    ],
  },
  {
    section: "Analytics",
    articles: [
      { topic: "analytics-dash",   title: "Analytics Dashboard",             description: "Reading call volume, response time, and trend charts." },
      { topic: "qa-trends",        title: "QA Trends & Scorecards",          description: "Reviewing quality scores across your dispatcher team." },
      { topic: "performance",      title: "Dispatcher Performance Reports",  description: "Individual and team performance breakdowns." },
      { topic: "exports",          title: "Exporting Data",                  description: "Downloading reports as CSV for external analysis." },
      { topic: "sla-reports",      title: "SLA Reports",                     description: "Measuring response times against SLA thresholds." },
    ],
  },
];

const AUDITOR_HELP: HelpIndex = [
  {
    section: "Getting Started",
    articles: [
      { topic: "index",            title: "Auditor Overview",                description: "What you can access and compliance export options." },
    ],
  },
  {
    section: "Audit & Compliance",
    articles: [
      { topic: "audit-log",        title: "Reading the Audit Log",           description: "Filtering and searching the immutable audit trail." },
      { topic: "incident-records", title: "Incident Records & Transcripts",  description: "Accessing incident history and call transcripts." },
      { topic: "access-reports",   title: "Access Reports",                  description: "Reviewing who accessed what and when." },
      { topic: "exports",          title: "Compliance Exports",              description: "Downloading audit and transcript data for compliance." },
    ],
  },
];

// ── Vertical roles ─────────────────────────────────────────────────────────

const CAMPUS_ADMIN_HELP: HelpIndex = [
  {
    section: "Getting Started",
    articles: [
      { topic: "index",            title: "Campus Admin Overview",           description: "Your campus console, zones, and admin controls." },
      { topic: "buildings",        title: "Buildings & Zone Setup",          description: "Configuring campus zones and building definitions." },
      { topic: "user-management",  title: "Campus User Management",          description: "Provisioning campus security, counselors, and faculty." },
    ],
  },
  {
    section: "Incidents",
    articles: [
      { topic: "incidents",        title: "Managing Campus Incidents",       description: "Creating, updating, and escalating campus incidents." },
      { topic: "escalation",       title: "Escalation to 911",              description: "Escalating a campus incident to the 911 PSAP." },
    ],
  },
];

const CAMPUS_SUPERVISOR_HELP: HelpIndex = [
  {
    section: "Campus Operations",
    articles: [
      { topic: "index",            title: "Campus Supervisor Overview",      description: "Live campus dashboard, zones, and escalation tools." },
      { topic: "incidents",        title: "Monitoring Campus Incidents",     description: "Watching active incidents across zones." },
      { topic: "escalation",       title: "Escalating an Incident",         description: "Escalating to 911 or department heads." },
    ],
  },
];

const CAMPUS_SECURITY_HELP: HelpIndex = [
  {
    section: "Campus Operations",
    articles: [
      { topic: "index",            title: "Campus Security Overview",        description: "Creating reports, managing patrol, and incident intake." },
      { topic: "create-incident",  title: "Creating a Campus Incident",      description: "Logging a security incident from the field." },
      { topic: "public-report",    title: "Reviewing Public Reports",        description: "Acting on reports submitted via QR/NFC by students." },
    ],
  },
];

const CAMPUS_COUNSELOR_HELP: HelpIndex = [
  {
    section: "Counselor Access",
    articles: [
      { topic: "index",            title: "Campus Counselor Overview",       description: "Your access scope — wellness incidents only." },
      { topic: "wellness-notes",   title: "Wellness Incident Notes",         description: "Reviewing and adding counseling notes to incidents." },
      { topic: "trauma-flags",     title: "Trauma Flag Acknowledgment",      description: "Acknowledging wellness flags for students." },
    ],
  },
];

const CAMPUS_FACULTY_HELP: HelpIndex = [
  {
    section: "Faculty Reporting",
    articles: [
      { topic: "index",            title: "Faculty Overview",                description: "How to submit a safety report and check its status." },
      { topic: "submit-report",    title: "Submitting a Safety Report",      description: "Using the faculty report form to notify campus security." },
    ],
  },
];

const VENUE_ADMIN_HELP: HelpIndex = [
  {
    section: "Getting Started",
    articles: [
      { topic: "index",            title: "Venue Admin Overview",            description: "Venue console, sections, and your admin controls." },
      { topic: "sections",         title: "Section & Zone Setup",            description: "Configuring stadium sections, levels, and gates." },
      { topic: "staff",            title: "Staff Management",                description: "Adding and managing venue security and operations staff." },
    ],
  },
  {
    section: "Operations",
    articles: [
      { topic: "incidents",        title: "Venue Incidents",                 description: "Managing incidents tied to specific sections." },
      { topic: "cameras",          title: "Camera Integration",              description: "Requesting and routing venue cameras to incidents." },
    ],
  },
];

const VENUE_SUPERVISOR_HELP: HelpIndex = [
  {
    section: "Venue Operations",
    articles: [
      { topic: "index",            title: "Venue Supervisor Overview",       description: "Live section monitoring, escalations, and camera requests." },
      { topic: "section-status",   title: "Section Status Management",       description: "Updating section threat levels and escalating incidents." },
      { topic: "cameras",          title: "Requesting Cameras",              description: "Routing venue cameras to an active incident." },
    ],
  },
];

const VENUE_SECURITY_HELP: HelpIndex = [
  {
    section: "Security Operations",
    articles: [
      { topic: "index",            title: "Venue Security Overview",         description: "Incident reporting, section patrol, and guest reports." },
      { topic: "create-incident",  title: "Creating a Section Incident",     description: "Logging a security incident tied to a stadium section." },
      { topic: "guest-reports",    title: "Guest Reports Intake",            description: "Acting on incident reports submitted by venue guests." },
    ],
  },
];

const HOSPITAL_ADMIN_HELP: HelpIndex = [
  {
    section: "Hospital Portal",
    articles: [
      { topic: "index",            title: "Hospital Admin Overview",         description: "Capacity management, pre-alerts, and hospital profile." },
      { topic: "capacity",         title: "Managing Hospital Capacity",      description: "Updating bed availability and department capacity." },
      { topic: "pre-alerts",       title: "Pre-Alert Acknowledgment",        description: "Receiving and acknowledging EMS pre-alerts." },
      { topic: "mci-planning",     title: "MCI Planning",                    description: "Setting up mass casualty incident capacity plans." },
    ],
  },
];

const HOSPITAL_STAFF_HELP: HelpIndex = [
  {
    section: "Hospital Staff",
    articles: [
      { topic: "index",            title: "Hospital Staff Overview",         description: "Your access — pre-alerts and bed status updates." },
      { topic: "capacity",         title: "Updating Bed Status",             description: "Reporting current capacity for your department." },
      { topic: "pre-alerts",       title: "Pre-Alert Review",                description: "Reading incoming EMS pre-alerts for your unit." },
    ],
  },
];

const TRANSIT_ADMIN_HELP: HelpIndex = [
  {
    section: "Transit Admin",
    articles: [
      { topic: "index", title: "Transit Admin Overview", description: "Fleet, routes, QR codes, users, and admin configuration." },
      { topic: "qr-codes", title: "QR and NFC Codes", description: "Create, print, and deactivate passenger report codes for vehicles and stations." },
      { topic: "users", title: "Transit Users", description: "Invite Transit Admin, Supervisor, Security, and Operator accounts." },
      { topic: "incidents", title: "Transit Incident Management", description: "Creating and managing incidents on routes and at stations." },
    ],
  },
];

const TRANSIT_SUPERVISOR_HELP: HelpIndex = [
  {
    section: "Transit Supervisor",
    articles: [
      { topic: "index", title: "Transit Supervisor Overview", description: "Ops dashboard, incidents, alert level, and broadcasts." },
      { topic: "qr-codes", title: "QR and NFC Codes", description: "Create and deactivate passenger report QR / NFC codes for vehicles and stations." },
      { topic: "incidents", title: "Incidents and 911 escalate", description: "Manage transit incidents and flag 911 escalation (audit only — no CAD write-back)." },
    ],
  },
];

const TRANSIT_SECURITY_HELP: HelpIndex = [
  {
    section: "Transit Security",
    articles: [
      { topic: "index",            title: "Transit Security Overview",       description: "Field incident reporting on routes and at stations." },
      { topic: "create-incident",  title: "Creating a Transit Incident",     description: "Logging a security incident on a route or at a station." },
    ],
  },
];

// ── Platform roles ─────────────────────────────────────────────────────────

const RC_ADMIN_HELP: HelpIndex = [
  {
    section: "Platform Admin",
    articles: [
      { topic: "index",            title: "RC Admin Overview",               description: "Multi-tenant platform controls and agency management." },
      { topic: "agency-onboard",   title: "Onboarding an Agency",           description: "Provisioning a new agency in the platform." },
      { topic: "platform-health",  title: "Platform Health Dashboard",       description: "Monitoring all-tenant system health." },
      { topic: "notices",          title: "Platform Notices",                description: "Broadcasting notices to one or all agencies." },
    ],
  },
];

const RC_IT_ADMIN_HELP: HelpIndex = [
  {
    section: "RC IT Support",
    articles: [
      { topic: "index",            title: "RC IT Admin Overview",            description: "Cross-tenant user support and diagnostics access." },
      { topic: "user-support",     title: "User Account Support",            description: "Password resets, unlocks, MFA re-enrollment." },
      { topic: "diagnostics",      title: "Infrastructure Diagnostics",      description: "Accessing system diagnostics across tenants." },
    ],
  },
];

// ── Role → help index map ──────────────────────────────────────────────────

/**
 * Normalizes a role token to its canonical help key.
 * Handles legacy tokens and vertical variants.
 */
export function normalizeHelpRole(role: string): string {
  const r = (role ?? "dispatcher").toLowerCase().replace(/-/g, "_");
  const map: Record<string, string> = {
    admin: "agencyadmin",
    it_admin: "agencyit",
    commsupervisor: "supervisor",
    readonly_auditor: "auditor",
    platform_superadmin: "rcadmin",
    rc_superadmin: "rcadmin",
    rcsuperadmin: "rcadmin",
    campusadmin: "campus_admin",
    campussupervisor: "campus_supervisor",
    campussecurity: "campus_security",
    campuscounselor: "campus_counselor",
    campusfaculty: "campus_faculty",
    campus_dispatch: "campus_security",
    campusdispatch: "campus_security",
    venue_admin: "venue_admin",
    venue_supervisor: "venue_supervisor",
    venue_security: "venue_security",
    venue_operator: "venue_supervisor",
    venue_guest_services: "venue_security",
    hospital_admin: "hospital_admin",
    hospitaladmin: "hospital_admin",
    hospital_staff: "hospital_staff",
    hospitalstaff: "hospital_staff",
    hospital_coordinator: "hospital_staff",
    transit_admin: "transit_admin",
    transit_supervisor: "transit_supervisor",
    transit_security: "transit_security",
    transit_operator: "transit_security",
  };
  return map[r] ?? r;
}

const HELP_INDEX: Record<string, HelpIndex> = {
  dispatcher:        DISPATCHER_HELP,
  supervisor:        SUPERVISOR_HELP,
  agencyadmin:       AGENCY_ADMIN_HELP,
  agencyit:          AGENCY_IT_HELP,
  analyst:           ANALYST_HELP,
  auditor:           AUDITOR_HELP,
  campus_admin:      CAMPUS_ADMIN_HELP,
  campus_supervisor: CAMPUS_SUPERVISOR_HELP,
  campus_security:   CAMPUS_SECURITY_HELP,
  campus_counselor:  CAMPUS_COUNSELOR_HELP,
  campus_faculty:    CAMPUS_FACULTY_HELP,
  venue_admin:       VENUE_ADMIN_HELP,
  venue_supervisor:  VENUE_SUPERVISOR_HELP,
  venue_security:    VENUE_SECURITY_HELP,
  hospital_admin:    HOSPITAL_ADMIN_HELP,
  hospital_staff:    HOSPITAL_STAFF_HELP,
  transit_admin:     TRANSIT_ADMIN_HELP,
  transit_supervisor: TRANSIT_SUPERVISOR_HELP,
  transit_security:  TRANSIT_SECURITY_HELP,
  rcadmin:           RC_ADMIN_HELP,
  rcitadmin:         RC_IT_ADMIN_HELP,
};

export function getHelpIndex(role: string): HelpIndex {
  const key = normalizeHelpRole(role);
  return HELP_INDEX[key] ?? DISPATCHER_HELP;
}

export function findArticle(role: string, topic: string): HelpArticle | undefined {
  const index = getHelpIndex(role);
  for (const section of index) {
    const found = section.articles.find((a) => a.topic === topic);
    if (found) return found;
  }
  return undefined;
}
