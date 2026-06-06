import type {
  ScheduledMaintenance,
  StatusComponent,
  StatusIncident,
  SystemStatus,
  UptimeMetric,
} from "@/lib/rapid-cortex/status/status-types";

const DEFAULT_STATUS: SystemStatus = "operational";

const STATUS_RANK: Record<SystemStatus, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

export function deriveWorstSystemStatus(statuses: readonly SystemStatus[]): SystemStatus {
  if (statuses.length === 0) return DEFAULT_STATUS;
  let worst: SystemStatus = DEFAULT_STATUS;
  let rank = 0;
  for (const s of statuses) {
    const r = STATUS_RANK[s];
    if (r > rank) {
      rank = r;
      worst = s;
    }
  }
  return worst;
}

export function deriveOverallFromComponents(components: StatusComponent[]): SystemStatus {
  return deriveWorstSystemStatus(components.map((c) => c.status));
}

const COMPONENTS: StatusComponent[] = [
  {
    id: "web-application",
    name: "Web Application",
    description: "Public and authenticated web experiences.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "api-services",
    name: "API Services",
    description: "Core API endpoints and service orchestration.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "authentication",
    name: "Authentication",
    description: "User login and session management.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "dispatcher-console",
    name: "Dispatcher Console",
    description: "Dispatcher workspace and related UI paths.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "supervisor-dashboard",
    name: "Supervisor Dashboard",
    description: "Supervisor and oversight dashboards.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "sms-caller-link-delivery",
    name: "SMS / Caller Link Delivery",
    description: "Public token links and SMS delivery workflows.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "media-uploads",
    name: "Media Uploads",
    description: "Media upload and retrieval services.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "translation-services",
    name: "Translation Services",
    description: "Language translation and text processing features.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "cad-read-only-integration",
    name: "CAD Read-Only Integration",
    description: "Read-only CAD integration surfaces.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "audit-logging",
    name: "Audit Logging",
    description: "Operational audit event capture.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "public-website",
    name: "Public Website",
    description: "Public marketing and informational pages.",
    status: "operational",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
];

const INCIDENTS: StatusIncident[] = [];
const MAINTENANCE_WINDOWS: ScheduledMaintenance[] = [];
const UPTIME_METRICS: UptimeMetric[] = [];

/**
 * TODO(status-admin): Replace in-file arrays with an audited persistence layer
 * (for example DynamoDB + role-gated admin APIs) before exposing write controls.
 */
export function getCurrentSystemStatus(): SystemStatus {
  return deriveOverallFromComponents(COMPONENTS);
}

export function getStatusComponents(): StatusComponent[] {
  return COMPONENTS;
}

export function getActiveIncidents(): StatusIncident[] {
  return INCIDENTS.filter((incident) => incident.status !== "resolved");
}

export function getScheduledMaintenance(): ScheduledMaintenance[] {
  return MAINTENANCE_WINDOWS.filter((maintenance) =>
    maintenance.status === "scheduled" || maintenance.status === "in_progress",
  );
}

export function filterIncidentHistoryToWindow(
  incidents: StatusIncident[],
  days: number,
  now: Date = new Date(),
): StatusIncident[] {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return incidents
    .filter((incident) => new Date(incident.startedAt) >= cutoff)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

export function getIncidentHistory90Days(now: Date = new Date()): StatusIncident[] {
  return filterIncidentHistoryToWindow(INCIDENTS, 90, now);
}

export function getUptimeMetrics(): UptimeMetric[] {
  return UPTIME_METRICS;
}

export function getStatusLastUpdatedIso(now: Date = new Date()): string {
  return now.toISOString();
}
