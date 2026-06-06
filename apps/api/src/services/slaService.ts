import type { Incident, SlaLevelStatus, SlaPriority, SlaStatus, SlaThreshold, UrgencyLevel, UserContext } from "rapid-cortex-shared";
import {
  DEFAULT_SLA_THRESHOLDS,
  type BacklogSnapshot,
  type DispatchSlaStatus,
  type PutSlaThresholdsBody,
} from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import {
  AUDIT_EVENT_TYPES,
  AuthorizationService,
  isAdminRole,
} from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { SlaBacklogSnapshotRepository } from "../repositories/slaBacklogSnapshotRepository.js";

const incidents = new IncidentRepository();
const agencies = new AgencyRepository();
const snapshots = new SlaBacklogSnapshotRepository();
const auditRepo = new AuditRepository();
const authz = new AuthorizationService();

const ACTIVE_STATUSES = new Set(["active", "in_progress"]);
const SNAPSHOT_MIN_INTERVAL_MS = 5 * 60 * 1000;

function assertEnabled(): void {
  if (!env.slaBacklogSnapshotsTable) {
    const err = new Error("SLA_BACKLOG_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function urgencyToPriority(urgency: UrgencyLevel): SlaPriority {
  if (urgency === "critical") return "P1";
  if (urgency === "high") return "P2";
  if (urgency === "moderate") return "P3";
  return "P4";
}

function priorityRank(p: SlaPriority): number {
  if (p === "P1") return 0;
  if (p === "P2") return 1;
  if (p === "P3") return 2;
  return 3;
}

function levelStatus(elapsed: number, target: number, warningPct: number): SlaLevelStatus {
  if (elapsed >= target) return "breached";
  if (elapsed >= target * warningPct) return "warning";
  return "ok";
}

function dispatchLevelStatus(elapsed: number, target: number, warningPct: number): DispatchSlaStatus {
  return levelStatus(elapsed, target, warningPct);
}

function thresholdFor(priority: SlaPriority, thresholds: SlaThreshold[]): SlaThreshold {
  return thresholds.find((t) => t.priority === priority) ?? DEFAULT_SLA_THRESHOLDS.find((t) => t.priority === priority)!;
}

export function computeSlaStatus(incident: Incident, thresholds: SlaThreshold[]): SlaStatus {
  const priority = urgencyToPriority(incident.urgency);
  const t = thresholdFor(priority, thresholds);
  const callReceivedAt = incident.createdAt;
  const answeredAt = incident.dispatcherReviewAcknowledgedAt ?? undefined;
  const unitDispatchedAt =
    incident.cadUnits && incident.cadUnits.length > 0 && incident.cadLastSyncAt
      ? incident.cadLastSyncAt
      : undefined;
  const nowMs = Date.now();
  const receivedMs = new Date(callReceivedAt).getTime();

  const answerElapsedSeconds = answeredAt
    ? Math.max(0, Math.round((new Date(answeredAt).getTime() - receivedMs) / 1000))
    : Math.max(0, Math.round((nowMs - receivedMs) / 1000));

  const answerSlaStatus = levelStatus(answerElapsedSeconds, t.targetAnswerSeconds, t.warningPct);

  let dispatchElapsedSeconds: number | undefined;
  let dispatchSlaStatus: DispatchSlaStatus;

  if (unitDispatchedAt) {
    const anchorMs = answeredAt ? new Date(answeredAt).getTime() : receivedMs;
    dispatchElapsedSeconds = Math.max(0, Math.round((new Date(unitDispatchedAt).getTime() - anchorMs) / 1000));
    dispatchSlaStatus = dispatchLevelStatus(dispatchElapsedSeconds, t.targetDispatchSeconds, t.warningPct);
  } else if (answeredAt) {
    dispatchElapsedSeconds = Math.max(0, Math.round((nowMs - new Date(answeredAt).getTime()) / 1000));
    dispatchSlaStatus = dispatchLevelStatus(dispatchElapsedSeconds, t.targetDispatchSeconds, t.warningPct);
  } else {
    dispatchSlaStatus = "pending";
  }

  return {
    incidentId: incident.incidentId,
    priority,
    callReceivedAt,
    answeredAt,
    unitDispatchedAt,
    answerElapsedSeconds,
    dispatchElapsedSeconds,
    answerSlaStatus,
    dispatchSlaStatus,
  };
}

function assertAgencyUser(user: Pick<UserContext, "agencyId" | "role">, agencyId: string): void {
  if (!isRcsuperadmin({ agencyId: user.agencyId, role: user.role }) && user.agencyId !== agencyId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

export class SlaService {
  private async resolveAgencyId(user: Parameters<typeof authz.canDispatch>[0]): Promise<string> {
    if (!user.agencyId) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    return user.agencyId;
  }

  private async loadThresholds(agencyId: string): Promise<SlaThreshold[]> {
    const agency = await agencies.get(agencyId);
    const custom = agency?.config?.slaThresholds;
    if (custom && custom.length > 0) return custom;
    return DEFAULT_SLA_THRESHOLDS;
  }

  private async activeIncidents(agencyId: string): Promise<Incident[]> {
    const rows = await incidents.listByAgencyWithLimit(agencyId, 200);
    return rows.filter((i) => ACTIVE_STATUSES.has(i.status));
  }

  async getStatus(user: Parameters<typeof authz.canDispatch>[0]): Promise<{ items: SlaStatus[] }> {
    assertEnabled();
    if (!authz.canDispatch(user) && !authz.canAccessSupervisorRoutes(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const agencyId = await this.resolveAgencyId(user);
    const thresholds = await this.loadThresholds(agencyId);
    const active = await this.activeIncidents(agencyId);
    const items = active
      .map((i) => computeSlaStatus(i, thresholds))
      .sort((a, b) => {
        const pr = priorityRank(a.priority) - priorityRank(b.priority);
        if (pr !== 0) return pr;
        const breachA = a.answerSlaStatus === "breached" || a.dispatchSlaStatus === "breached" ? 0 : 1;
        const breachB = b.answerSlaStatus === "breached" || b.dispatchSlaStatus === "breached" ? 0 : 1;
        if (breachA !== breachB) return breachA - breachB;
        return b.answerElapsedSeconds - a.answerElapsedSeconds;
      });
    return { items };
  }

  async getThresholds(user: Parameters<typeof authz.canDispatch>[0]): Promise<{ thresholds: SlaThreshold[] }> {
    if (!authz.canDispatch(user) && !authz.canAccessSupervisorRoutes(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const agencyId = await this.resolveAgencyId(user);
    const thresholds = await this.loadThresholds(agencyId);
    return { thresholds };
  }

  async putThresholds(
    user: Parameters<typeof authz.canDispatch>[0],
    body: PutSlaThresholdsBody,
  ): Promise<{ thresholds: SlaThreshold[] }> {
    if (!isAdminRole(user.role) && user.role !== "rcsuperadmin") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const agencyId = await this.resolveAgencyId(user);
    const agency = await agencies.get(agencyId);
    if (!agency) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertAgencyUser(user, agencyId);
    const ts = nowIso();
    const updated = {
      ...agency,
      config: {
        ...agency.config,
        slaThresholds: body.thresholds,
        updatedAt: ts,
      },
      updatedAt: ts,
    };
    await agencies.put(updated);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SLA_THRESHOLDS_UPDATED,
      details: { thresholds: body.thresholds },
      createdAt: ts,
      resourceType: "agency",
      resourceId: agencyId,
    });
    return { thresholds: body.thresholds };
  }

  buildBacklogSnapshot(agencyId: string, items: SlaStatus[]): BacklogSnapshot {
    const p1Count = items.filter((i) => i.priority === "P1").length;
    const p2Count = items.filter((i) => i.priority === "P2").length;
    const p3Count = items.filter((i) => i.priority === "P3").length;
    const waiting = items.filter((i) => !i.answeredAt);
    const avgWaitSeconds =
      waiting.length > 0
        ? Math.round(waiting.reduce((s, i) => s + i.answerElapsedSeconds, 0) / waiting.length)
        : 0;
    const slaBreachCount = items.filter(
      (i) => i.answerSlaStatus === "breached" || i.dispatchSlaStatus === "breached",
    ).length;
    const slaWarningCount = items.filter(
      (i) => i.answerSlaStatus === "warning" || i.dispatchSlaStatus === "warning",
    ).length;
    return {
      agencyId,
      snapshotAt: nowIso(),
      queueDepth: items.length,
      p1Count,
      p2Count,
      p3Count,
      avgWaitSeconds,
      slaBreachCount,
      slaWarningCount,
    };
  }

  async getBacklog(user: Parameters<typeof authz.canDispatch>[0]): Promise<BacklogSnapshot> {
    assertEnabled();
    if (!authz.canDispatch(user) && !authz.canAccessSupervisorRoutes(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const agencyId = await this.resolveAgencyId(user);
    const { items } = await this.getStatus(user);
    const snapshot = this.buildBacklogSnapshot(agencyId, items);

    const latest = await snapshots.getLatest(agencyId);
    const shouldPersist =
      !latest ||
      Date.now() - new Date(latest.snapshotAt).getTime() >= SNAPSHOT_MIN_INTERVAL_MS;
    if (shouldPersist) {
      await snapshots.put(snapshot);
    }
    return snapshot;
  }

  async getHistory(
    user: Parameters<typeof authz.canDispatch>[0],
    period: "24h" | "7d",
  ): Promise<{ items: BacklogSnapshot[] }> {
    assertEnabled();
    if (!authz.canAccessSupervisorRoutes(user) && !authz.canDispatch(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const agencyId = await this.resolveAgencyId(user);
    const hours = period === "7d" ? 7 * 24 : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const items = await snapshots.listSince(agencyId, since);
    return { items };
  }
}
