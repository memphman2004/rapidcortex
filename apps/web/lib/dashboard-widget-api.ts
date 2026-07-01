/**
 * Canonical API helpers for dashboard widgets — maps widget data needs to real SAM routes.
 */
import type { ActiveCallRecord, AuditEvent, Incident, QASession } from "rapid-cortex-shared";
import {
  fetchAuditEvents,
  fetchIncidents,
  fetchQaSessions,
  fetchSupervisorActiveCalls,
} from "@/lib/api";
import { fetchReports } from "@/lib/reports-api";
import { backendGet } from "@/components/widgets/widget-primitives";

const OPEN_INCIDENT_STATUSES = new Set<Incident["status"]>(["active", "in_progress"]);
const QA_PENDING_STATUSES = new Set<QASession["status"]>(["draft", "scoring"]);

function incidentsQuery(agencyId: string): string {
  return agencyId ? `?agencyId=${encodeURIComponent(agencyId)}` : "";
}

export async function fetchDashboardOpenIncidents(agencyId: string, limit = 100): Promise<Incident[]> {
  try {
    const items = await fetchIncidents();
    return items
      .filter((i) => !agencyId || i.agencyId === agencyId)
      .filter((i) => OPEN_INCIDENT_STATUSES.has(i.status))
      .slice(0, limit);
  } catch {
    const data = await backendGet<{ items?: Incident[] }>(`/api/incidents${incidentsQuery(agencyId)}`);
    const items = data?.items ?? [];
    return items.filter((i) => OPEN_INCIDENT_STATUSES.has(i.status)).slice(0, limit);
  }
}

export async function fetchDashboardActiveCalls(): Promise<ActiveCallRecord[]> {
  try {
    return await fetchSupervisorActiveCalls();
  } catch {
    return [];
  }
}

function auditSummary(event: AuditEvent): string {
  const details = event.details ?? {};
  if (typeof details.summary === "string") return details.summary;
  if (typeof details.message === "string") return details.message;
  return event.type;
}

export async function fetchDashboardAuditFeed(limit = 20): Promise<
  Array<{ eventId: string; type: string; actor: string; timestamp: string; summary: string }>
> {
  try {
    const items = await fetchAuditEvents(limit);
    return items.map((event) => ({
      eventId: event.eventId,
      type: event.type,
      actor: event.actorId ?? "system",
      timestamp: event.createdAt,
      summary: auditSummary(event),
    }));
  } catch {
    return [];
  }
}

export async function fetchDashboardQaQueue(limit = 15): Promise<
  Array<{
    sessionId: string;
    incidentId: string;
    dispatcherName: string;
    createdAt: string;
    ageHours: number;
  }>
> {
  try {
    const sessions = await fetchQaSessions();
    return sessions
      .filter((s) => QA_PENDING_STATUSES.has(s.status))
      .slice(0, limit)
      .map((s) => ({
        sessionId: s.sessionId,
        incidentId: s.incidentId,
        dispatcherName: s.dispatcherUserId,
        createdAt: s.createdAt,
        ageHours: Math.max(
          0,
          Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 3_600_000),
        ),
      }));
  } catch {
    return [];
  }
}

export async function fetchDashboardReports(limit = 10): Promise<
  Array<{ id: string; title: string; status: string }>
> {
  try {
    const items = await fetchReports();
    return items.slice(0, limit).map((r: { reportId: string; name: string; type: string }) => ({
      id: r.reportId,
      title: r.name,
      status: r.type,
    }));
  } catch {
    return [];
  }
}

export type VenueLiveStats = {
  openIncidents: number;
  openGuestReports: number;
  staffOnDuty: number;
  camerasOnline: number;
};

export async function fetchDashboardVenueStats(agencyId: string): Promise<VenueLiveStats | null> {
  const data = await backendGet<{
    activeIncidents: number;
    securityOnDuty: number;
    sectionsMonitored: number;
    guestReportsToday: number;
  }>(
    `/api/venue/${encodeURIComponent(agencyId)}/stats`,
  );
  if (!data) return null;
  return {
    openIncidents: data.activeIncidents,
    openGuestReports: data.guestReportsToday,
    staffOnDuty: data.securityOnDuty,
    camerasOnline: data.sectionsMonitored,
  };
}

export async function fetchDashboardHospitalRoutingEvents(
  agencyId: string,
  limit = 15,
): Promise<Array<{ id: string; hospitalId: string; incidentId: string; createdAt: string }>> {
  const res = await fetch(
    `/api/hospital/${encodeURIComponent(agencyId)}/routing-events?limit=${limit}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!res.ok) return [];
  const body = (await res.json()) as {
    events?: Array<{ id: string; hospitalId: string; incidentId: string; createdAt: string }>;
  };
  return body.events ?? [];
}

export async function fetchDashboardSlaBacklog() {
  return backendGet<{ avgWaitSeconds?: number; avgAnswerTimeSeconds?: number }>("/api/sla/backlog");
}
