export type SystemStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

export type StatusIncidentState =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

export type StatusIncidentSeverity = "minor" | "major" | "critical";

export type ScheduledMaintenanceStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type StatusComponent = {
  id: string;
  name: string;
  description: string;
  status: SystemStatus;
  updatedAt: string;
};

export type StatusIncidentUpdate = {
  id: string;
  timestamp: string;
  message: string;
  status: StatusIncidentState;
};

export type StatusIncident = {
  id: string;
  title: string;
  status: StatusIncidentState;
  severity: StatusIncidentSeverity;
  startedAt: string;
  resolvedAt?: string;
  summary: string;
  updates: StatusIncidentUpdate[];
};

export type ScheduledMaintenance = {
  id: string;
  title: string;
  status: ScheduledMaintenanceStatus;
  scheduledStart: string;
  scheduledEnd: string;
  summary: string;
  affectedComponents: string[];
};

export type UptimeMetric = {
  componentId: string;
  componentName: string;
  periodDays: number;
  uptimePercentage: number;
};
