/**
 * Structured mock payloads for role dashboards.
 * TODO: Replace with API Gateway + Lambda responses; every query must filter by agencyId
 * except rcsuperadmin cross-tenant views (still enforce least privilege server-side).
 */
import type { UserContext } from "rapid-cortex-shared";
import type { DashboardPrefix } from "./dashboard-access";

export type StatusTone =
  | "active"
  | "critical"
  | "warning"
  | "resolved"
  | "pending"
  | "offline"
  | "manual_mode"
  | "ai_suggested"
  | "supervisor_watching";

export interface KpiStat {
  id: string;
  label: string;
  value: string;
  hint?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  tone?: StatusTone;
}

export interface IncidentRow {
  id: string;
  cadId: string;
  agencyId: string;
  unitId?: string;
  priority: string;
  status: StatusTone;
  summary: string;
  updatedAt: string;
}

export interface SecurityAlert {
  id: string;
  agencyId: string;
  title: string;
  severity: StatusTone;
  message: string;
}

export interface ReportRow {
  id: string;
  title: string;
  period: string;
  status: StatusTone;
}

export interface DashboardMockPayload {
  agencyId: string | null;
  stats: KpiStat[];
  activities: ActivityItem[];
  incidents: IncidentRow[];
  securityAlerts: SecurityAlert[];
  reports: ReportRow[];
  /** Short copy blocks for compliance / security callouts (no certification claims). */
  complianceNotes: string[];
}

const MOCK_AGENCY = "agency-demo-001";
const MOCK_UNIT = "unit-42";

const ALL_INCIDENTS: IncidentRow[] = [
  {
    id: "inc-101",
    cadId: "CAD-7781",
    agencyId: MOCK_AGENCY,
    unitId: "unit-42",
    priority: "P1",
    status: "critical",
    summary: "Multi-vehicle MVA — bridge approach",
    updatedAt: "2 min ago",
  },
  {
    id: "inc-102",
    cadId: "CAD-7784",
    agencyId: MOCK_AGENCY,
    unitId: "unit-12",
    priority: "P2",
    status: "active",
    summary: "Domestic disturbance — audio flagged",
    updatedAt: "6 min ago",
  },
  {
    id: "inc-103",
    cadId: "CAD-7789",
    agencyId: MOCK_AGENCY,
    unitId: "unit-42",
    priority: "P3",
    status: "pending",
    summary: "Welfare check — elderly caller",
    updatedAt: "14 min ago",
  },
  {
    id: "inc-201",
    cadId: "CAD-9021",
    agencyId: "agency-west-002",
    unitId: "unit-7",
    priority: "P2",
    status: "resolved",
    summary: "Commercial alarm — false",
    updatedAt: "1 hr ago",
  },
];

function filterIncidentsForUser(
  user: UserContext | null,
  prefix: DashboardPrefix,
): IncidentRow[] {
  if (!user) return [];
  if (user.role === "rcsuperadmin" && prefix === "rc-admin") {
    return ALL_INCIDENTS;
  }
  const agency = user.agencyId;
  let rows = ALL_INCIDENTS.filter((r) => r.agencyId === agency);
  if (user.role === "auditor") {
    rows = rows.filter((r) => r.unitId === MOCK_UNIT || r.id === "inc-101");
  }
  return rows;
}

function baseCompliance(): string[] {
  return [
    "CJIS-aligned controls: role-based access, audit-ready logs, and agency-scoped data paths.",
    "Security-focused architecture: MFA-ready authentication and encrypted transport in production.",
  ];
}

export function getMockDashboardPayload(
  prefix: DashboardPrefix,
  user: UserContext | null,
): DashboardMockPayload {
  const agencyId = user?.agencyId ?? null;
  const incidents = filterIncidentsForUser(user, prefix);

  const byPrefix: Record<DashboardPrefix, () => DashboardMockPayload> = {
    "rc-admin": () => ({
      agencyId: null,
      stats: [],
      activities: [],
      incidents: [],
      securityAlerts: [],
      reports: [],
      complianceNotes: [
        ...baseCompliance(),
        "RC Admin actions are fully logged for accountability across tenants.",
      ],
    }),
    "agency-admin": () => ({
      agencyId,
      stats: [
        { id: "b1", label: "Active users", value: "86" },
        { id: "b2", label: "Open incidents today", value: "37" },
        { id: "b3", label: "AI usage this month", value: "182k tokens" },
        { id: "b4", label: "Translation sessions", value: "214" },
        { id: "b5", label: "Live video sessions", value: "19" },
        { id: "b6", label: "Compliance checklist", value: "12/14" },
        { id: "b7", label: "Open agency alerts", value: "4" },
        { id: "b8", label: "Data retention status", value: "Within policy" },
      ],
      activities: [
        {
          id: "1",
          title: "Role change approved",
          description: "Supervisor added for night shift command.",
          timeLabel: "8 min ago",
          tone: "active",
        },
      ],
      incidents,
      securityAlerts: [],
      reports: [{ id: "r2", title: "Agency usage summary", period: "March 2026", status: "pending" }],
      complianceNotes: baseCompliance(),
    }),
    dispatcher: () => ({
      agencyId,
      stats: [
        { id: "dp1", label: "Active call", value: "CAD-7781", hint: "Live incident workspace" },
        { id: "dp2", label: "Live transcription", value: "Connected", hint: "English output stream" },
        { id: "dp3", label: "AI incident summary", value: "Updating", hint: "Suggestion only" },
        { id: "dp4", label: "Caller location", value: "Bridge approach, mile 14" },
        { id: "dp5", label: "Callback number", value: "(555) 013-4491" },
        { id: "dp6", label: "Incident type", value: "Vehicle collision", hint: "Dispatcher editable" },
        { id: "dp7", label: "Priority level", value: "P1" },
        { id: "dp8", label: "Manual mode status", value: "Available" },
      ],
      activities: [
        {
          id: "1",
          title: "Supervisor assist requested",
          description: "Silent monitor enabled for CAD-7781.",
          timeLabel: "Now",
          tone: "supervisor_watching",
        },
        {
          id: "2",
          title: "CAD payload prepared",
          description: "Awaiting dispatcher confirmation before submit.",
          timeLabel: "1 min ago",
          tone: "ai_suggested",
        },
      ],
      incidents,
      securityAlerts: [
        {
          id: "dps1",
          agencyId: MOCK_AGENCY,
          title: "Safety reminder",
          severity: "warning",
          message: "AI output is assistive only; dispatcher review required before CAD submission.",
        },
      ],
      reports: [],
      complianceNotes: [
        ...baseCompliance(),
        "CAD-ready output requires dispatcher review unless agency policy explicitly allows automation.",
        "Manual mode changes and CAD submissions must be audit logged with actor + incident context.",
      ],
    }),
    supervisor: () => ({
      agencyId,
      stats: [
        { id: "c1", label: "Active incidents", value: "11" },
        { id: "c2", label: "High priority incidents", value: "3" },
        { id: "c3", label: "Escalations", value: "2" },
        { id: "c4", label: "Live media sessions", value: "5" },
        { id: "c5", label: "Translation sessions", value: "8" },
        { id: "c6", label: "Team workload", value: "Medium" },
        { id: "c7", label: "Average handling time", value: "6m 12s" },
        { id: "c8", label: "AI risk alerts", value: "1" },
      ],
      activities: [
        {
          id: "1",
          title: "Escalation acknowledged",
          description: "CAD-7781 — command notified, secondary unit en route.",
          timeLabel: "1 min ago",
          tone: "critical",
        },
      ],
      incidents,
      securityAlerts: [
        {
          id: "s1",
          agencyId: MOCK_AGENCY,
          title: "AI risk alert",
          severity: "warning",
          message: "Summary divergence vs. transcript on CAD-7784 — QA sample created.",
        },
      ],
      reports: [],
      complianceNotes: baseCompliance(),
    }),
    qa: () => ({
      agencyId,
      stats: [
        { id: "d1", label: "Calls pending review", value: "23" },
        { id: "d2", label: "Average QA score", value: "4.2 / 5" },
        { id: "d3", label: "Protocol misses", value: "5" },
        { id: "d4", label: "Coaching assignments", value: "9" },
        { id: "d5", label: "High-risk reviews", value: "2" },
        { id: "d6", label: "AI summary exceptions", value: "4" },
        { id: "d7", label: "Training completion", value: "78%" },
        { id: "d8", label: "Performance trends", value: "Improving" },
      ],
      activities: [
        {
          id: "1",
          title: "Review assigned",
          description: "CAD-7781 — supervisor escalation + AI summary delta.",
          timeLabel: "4 min ago",
          tone: "pending",
        },
      ],
      incidents,
      securityAlerts: [],
      reports: [{ id: "r3", title: "Weekly QA digest", period: "Week 14", status: "active" }],
      complianceNotes: baseCompliance(),
    }),
    "it-security": () => ({
      agencyId,
      stats: [
        { id: "e1", label: "Failed logins (24h)", value: "37" },
        { id: "e2", label: "MFA adoption", value: "94%" },
        { id: "e3", label: "Active sessions", value: "52" },
        { id: "e4", label: "API health", value: "Healthy" },
        { id: "e5", label: "CAD connection status", value: "Online" },
        { id: "e6", label: "Audit log events (24h)", value: "1.2k" },
        { id: "e7", label: "Security alerts", value: "1" },
        { id: "e8", label: "Data export activity", value: "3 jobs" },
      ],
      activities: [
        {
          id: "1",
          title: "Session revoked",
          description: "Stale refresh from unrecognized device fingerprint.",
          timeLabel: "22 min ago",
          tone: "resolved",
        },
      ],
      incidents: [],
      securityAlerts: [
        {
          id: "s2",
          agencyId: MOCK_AGENCY,
          title: "Export job completed",
          severity: "active",
          message: "Incident bundle export — audit-ready logs retained 90 days.",
        },
      ],
      reports: [],
      complianceNotes: [
        ...baseCompliance(),
        "API and CAD health checks are synthetic in this preview; wire to CloudWatch + vendor status.",
      ],
    }),
    "hospital-admin": () => ({
      agencyId,
      stats: [
        { id: "h1", label: "ER beds available", value: "12 / 28" },
        { id: "h2", label: "ICU beds available", value: "4 / 16" },
        { id: "h3", label: "Diversion status", value: "Open" },
        { id: "h4", label: "Avg ER wait", value: "18 min" },
        { id: "h5", label: "Staff on duty", value: "Adequate" },
        { id: "h6", label: "Updates (24h)", value: "14" },
        { id: "h7", label: "Portal users", value: "6" },
        { id: "h8", label: "Data quality", value: "Good" },
      ],
      activities: [
        {
          id: "1",
          title: "Capacity published",
          description: "ER + ICU counts synced to dispatch routing.",
          timeLabel: "12 min ago",
          tone: "active",
        },
      ],
      incidents: [],
      securityAlerts: [],
      reports: [],
      complianceNotes: [
        "Hospital portal metrics are facility-scoped; wire to live capacity API when connected.",
      ],
    }),
    "hospital-staff": () => ({
      agencyId,
      stats: [
        { id: "s1", label: "ER beds available", value: "12 / 28" },
        { id: "s2", label: "ICU beds available", value: "4 / 16" },
        { id: "s3", label: "Diversion", value: "Not on diversion" },
        { id: "s4", label: "Last update", value: "12 min ago" },
        { id: "s5", label: "Trauma beds", value: "2 / 4" },
        { id: "s6", label: "Shift notes", value: "—" },
      ],
      activities: [
        {
          id: "1",
          title: "Bed count adjusted",
          description: "ER available +2 after discharges.",
          timeLabel: "12 min ago",
          tone: "resolved",
        },
      ],
      incidents: [],
      securityAlerts: [],
      reports: [],
      complianceNotes: ["Staff role can update capacity only; admin manages portal users."],
    }),
    executive: () => ({
      agencyId,
      stats: [
        { id: "g1", label: "Monthly incident volume", value: "1,842" },
        { id: "g2", label: "Incident trends", value: "-4% MoM" },
        { id: "g3", label: "Average handling time", value: "6m 05s" },
        { id: "g4", label: "Translation usage", value: "3.1k min" },
        { id: "g5", label: "Media usage", value: "420 hrs" },
        { id: "g6", label: "QA trends", value: "Stable" },
        { id: "g7", label: "Training impact", value: "+6 pts" },
        { id: "g8", label: "Pilot success metrics", value: "On track" },
      ],
      activities: [
        {
          id: "1",
          title: "Executive briefing generated",
          description: "Rolling 30-day operational snapshot.",
          timeLabel: "1 hr ago",
          tone: "active",
        },
      ],
      incidents: incidents.slice(0, 2),
      securityAlerts: [],
      reports: [
        { id: "r4", title: "Grant utilization pack", period: "FY26 Q1", status: "pending" },
      ],
      complianceNotes: baseCompliance(),
    }),
  };

  return byPrefix[prefix]();
}
