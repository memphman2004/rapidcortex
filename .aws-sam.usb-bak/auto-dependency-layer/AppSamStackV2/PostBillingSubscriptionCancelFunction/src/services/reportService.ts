import { AUDIT_EVENT_TYPES, isSupervisorOrAdmin } from "rapid-cortex-security";
import type {
  GenerateReportBody,
  ReportConfig,
  ReportResult,
  ReportType,
  UserContext,
} from "rapid-cortex-shared";
import { DEFAULT_SLA_THRESHOLDS, isRcsuperadmin } from "rapid-cortex-shared";
import { computeSlaStatus } from "./slaService.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentMediaRepository } from "../repositories/incidentMediaRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { IncidentTimelineRepository } from "../repositories/incidentTimelineRepository.js";
import { QaScorecardRepository } from "../repositories/qaScorecardRepository.js";
import { ReportRepository } from "../repositories/reportRepository.js";
import { SlaBacklogSnapshotRepository } from "../repositories/slaBacklogSnapshotRepository.js";

const reports = new ReportRepository();
const incidents = new IncidentRepository();
const qaRepo = new QaScorecardRepository();
const timelineRepo = new IncidentTimelineRepository();
const mediaRepo = new IncidentMediaRepository();
const slaSnapshots = new SlaBacklogSnapshotRepository();
const auditRepo = new AuditRepository();

function nowIso(): string {
  return new Date().toISOString();
}

function assertInfra(): void {
  if (!env.agencyReportsTable) {
    const err = new Error("REPORTS_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function inRange(iso: string, start: string, end: string): boolean {
  const t = new Date(iso).getTime();
  return t >= new Date(start).getTime() && t <= new Date(end).getTime();
}

function dispatcherFilter(filters: Record<string, unknown>, user: UserContext): string[] | null {
  if (!isSupervisorOrAdmin(user.role)) return [user.userId];
  const raw = filters.dispatcherIds;
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) return raw as string[];
  return null;
}

export class ReportService {
  private assertAccess(user: UserContext, type: ReportType): void {
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (!isSupervisorOrAdmin(user.role) && type !== "dispatcher_performance") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
  }

  async generate(user: UserContext, body: GenerateReportBody): Promise<ReportResult> {
    assertInfra();
    this.assertAccess(user, body.type);
    const agencyId = user.agencyId!;
    const filters = body.filters ?? {};
    const dispatcherIds = dispatcherFilter(filters, user);

    const incidentRows = await incidents.listByAgencySince(agencyId, body.dateRange.start, 500);
    const rangedIncidents = incidentRows.filter((i) => inRange(i.createdAt, body.dateRange.start, body.dateRange.end));

    let rows: Record<string, unknown>[] = [];
    const summary: Record<string, number> = {};

    switch (body.type) {
      case "call_volume": {
        const byDay: Record<string, number> = {};
        for (const i of rangedIncidents) {
          const day = i.createdAt.slice(0, 10);
          byDay[day] = (byDay[day] ?? 0) + 1;
        }
        rows = Object.entries(byDay).map(([day, count]) => ({ day, count }));
        summary.totalCalls = rangedIncidents.length;
        summary.days = rows.length;
        break;
      }
      case "incident_summary": {
        rows = rangedIncidents.map((i) => ({
          incidentId: i.incidentId,
          category: i.category,
          urgency: i.urgency,
          status: i.status,
          createdAt: i.createdAt,
        }));
        summary.total = rows.length;
        break;
      }
      case "response_times":
      case "sla_compliance": {
        const thresholds = DEFAULT_SLA_THRESHOLDS;
        let breaches = 0;
        let warnings = 0;
        rows = rangedIncidents.map((i) => {
          const sla = computeSlaStatus(i, thresholds);
          if (sla.answerSlaStatus === "breached" || sla.dispatchSlaStatus === "breached") breaches += 1;
          if (sla.answerSlaStatus === "warning" || sla.dispatchSlaStatus === "warning") warnings += 1;
          return {
            incidentId: i.incidentId,
            priority: sla.priority,
            answerElapsedSeconds: sla.answerElapsedSeconds,
            answerSlaStatus: sla.answerSlaStatus,
            dispatchSlaStatus: sla.dispatchSlaStatus,
          };
        });
        if (body.type === "sla_compliance" && env.slaBacklogSnapshotsTable) {
          const snaps = await slaSnapshots.listSince(agencyId, body.dateRange.start);
          const inWindow = snaps.filter((s) => inRange(s.snapshotAt, body.dateRange.start, body.dateRange.end));
          summary.avgQueueDepth =
            inWindow.length > 0
              ? Math.round(inWindow.reduce((a, s) => a + s.queueDepth, 0) / inWindow.length)
              : 0;
          summary.snapshotCount = inWindow.length;
        }
        summary.incidents = rows.length;
        summary.breaches = breaches;
        summary.warnings = warnings;
        break;
      }
      case "qa_scores":
      case "dispatcher_performance": {
        if (!env.qaScorecardsTable) break;
        let cards = await qaRepo.listForAgency(agencyId, 200);
        cards = cards.filter((c) => inRange(c.createdAt, body.dateRange.start, body.dateRange.end));
        if (dispatcherIds) cards = cards.filter((c) => dispatcherIds.includes(c.dispatcherId));
        rows = cards.map((c) => ({
          scorecardId: c.scorecardId,
          incidentId: c.incidentId,
          dispatcherId: c.dispatcherId,
          overallScore: c.overallScore,
          status: c.status,
          createdAt: c.createdAt,
        }));
        summary.count = rows.length;
        summary.avgScore =
          cards.length > 0
            ? Math.round(cards.reduce((a, c) => a + c.overallScore, 0) / cards.length)
            : 0;
        break;
      }
      case "translation_usage": {
        if (!env.incidentTimelineTable) break;
        let events = 0;
        for (const i of rangedIncidents.slice(0, 50)) {
          const evs = await timelineRepo.listByIncident(i.incidentId, 200);
          events += evs.filter(
            (e) => e.kind === "translation_activated" && inRange(e.timestamp, body.dateRange.start, body.dateRange.end),
          ).length;
        }
        rows = [{ translationEvents: events }];
        summary.translationEvents = events;
        summary.incidentsSampled = Math.min(rangedIncidents.length, 50);
        break;
      }
      case "media_usage": {
        if (!env.incidentMediaTable) break;
        let uploaded = 0;
        let pending = 0;
        for (const i of rangedIncidents.slice(0, 50)) {
          const media = await mediaRepo.listByIncident(agencyId, i.incidentId);
          for (const m of media) {
            if (!inRange(m.createdAt, body.dateRange.start, body.dateRange.end)) continue;
            if (m.status === "uploaded") uploaded += 1;
            else pending += 1;
          }
        }
        rows = [{ uploaded, pending }];
        summary.uploaded = uploaded;
        summary.pending = pending;
        break;
      }
    }

    const ts = nowIso();
    const reportId = makeId("rpt");
    const config: ReportConfig = {
      reportId,
      agencyId,
      type: body.type,
      name: body.name,
      dateRange: body.dateRange,
      filters,
      createdBy: user.userId,
      createdAt: ts,
    };
    const result: ReportResult = {
      reportId,
      config,
      rows,
      summary,
      generatedAt: ts,
    };
    await reports.put(result);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.REPORT_GENERATED,
      details: { reportId, type: body.type },
      createdAt: ts,
      resourceType: "agency",
      resourceId: reportId,
    });
    return result;
  }

  async list(user: UserContext): Promise<{ items: ReportConfig[] }> {
    assertInfra();
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const all = await reports.listForAgency(user.agencyId);
    let items = all.map((r) => r.config);
    if (!isSupervisorOrAdmin(user.role)) {
      items = items.filter(
        (c) => c.type === "dispatcher_performance" && c.createdBy === user.userId,
      );
    }
    return { items };
  }

  async get(user: UserContext, reportId: string): Promise<ReportResult> {
    assertInfra();
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const result = await reports.get(user.agencyId, reportId);
    if (!result) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    if (!isRcsuperadmin(user) && result.config.agencyId !== user.agencyId) {
      const err = new Error("TENANT_MISMATCH");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (!isSupervisorOrAdmin(user.role)) {
      if (result.config.type !== "dispatcher_performance" || result.config.createdBy !== user.userId) {
        const err = new Error("FORBIDDEN");
        (err as Error & { statusCode?: number }).statusCode = 403;
        throw err;
      }
    }
    return result;
  }

  exportCsv(result: ReportResult): string {
    if (result.rows.length === 0) return "";
    const keys = Object.keys(result.rows[0]!);
    const lines = [keys.join(",")];
    for (const row of result.rows) {
      lines.push(keys.map((k) => JSON.stringify(row[k] ?? "")).join(","));
    }
    return lines.join("\n");
  }
}
