import {
  getActiveIncidents,
  getCurrentSystemStatus,
  getIncidentHistory90Days,
  getScheduledMaintenance,
  getStatusComponents,
  getStatusLastUpdatedIso,
  getUptimeMetrics,
} from "@/lib/rapid-cortex/status/status-data";
import type {
  ScheduledMaintenance,
  StatusComponent,
  StatusIncident,
  SystemStatus,
  UptimeMetric,
} from "@/lib/rapid-cortex/status/status-types";

export type PublicStatusPayload = {
  ok: true;
  overallStatus: SystemStatus;
  lastUpdated: string;
  components: StatusComponent[];
  activeIncidents: StatusIncident[];
  scheduledMaintenance: ScheduledMaintenance[];
  incidentHistory: StatusIncident[];
  uptime: UptimeMetric[];
};

export function getPublicStatusPayload(now?: Date): PublicStatusPayload {
  return {
    ok: true,
    overallStatus: getCurrentSystemStatus(),
    lastUpdated: getStatusLastUpdatedIso(now ?? new Date()),
    components: getStatusComponents(),
    activeIncidents: getActiveIncidents(),
    scheduledMaintenance: getScheduledMaintenance(),
    incidentHistory: getIncidentHistory90Days(now ?? new Date()),
    uptime: getUptimeMetrics(),
  };
}
