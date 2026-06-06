import type {
  IncidentTimelineExportResponse,
  PostIncidentTimelineNoteBody,
  TimelineEvent,
  UserContext,
} from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { resolveIncidentRead } from "../lib/incidentReadAccess.js";
import { incidentTimelineLogger } from "../lib/incidentTimelineLogger.js";
import { env } from "../lib/env.js";
import { IncidentTimelineRepository } from "../repositories/incidentTimelineRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../lib/ids.js";

const repo = new IncidentTimelineRepository();
const auditRepo = new AuditRepository();

function assertEnabled(): void {
  if (!env.incidentTimelineTable) {
    const err = new Error("TIMELINE_DISABLED");
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }
}

async function assertIncidentAccess(user: UserContext, incidentId: string): Promise<{ agencyId: string }> {
  const resolved = await resolveIncidentRead(incidentId, user);
  if (!resolved) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  if (!isRcsuperadmin(user) && user.agencyId !== resolved.incident.agencyId) {
    const err = new Error("TENANT_MISMATCH");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
  return { agencyId: resolved.incident.agencyId };
}

export class IncidentTimelineService {
  async list(user: UserContext, incidentId: string): Promise<TimelineEvent[]> {
    assertEnabled();
    await assertIncidentAccess(user, incidentId);
    return repo.listByIncident(incidentId);
  }

  async addNote(
    user: UserContext,
    incidentId: string,
    body: PostIncidentTimelineNoteBody,
  ): Promise<TimelineEvent> {
    assertEnabled();
    const { agencyId } = await assertIncidentAccess(user, incidentId);
    if (user.role === "auditor") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const event = await incidentTimelineLogger.emit({
      incidentId,
      agencyId,
      kind: "dispatcher_note",
      source:
        user.role === "supervisor" || user.role === "agencyadmin" || user.role === "rcsuperadmin"
          ? "supervisor"
          : "dispatcher",
      actorId: user.userId,
      actorRole: user.role,
      payload: { content: body.content },
    });
    if (!event) {
      const err = new Error("TIMELINE_DISABLED");
      (err as Error & { statusCode?: number }).statusCode = 503;
      throw err;
    }

    const ts = event.timestamp;
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.INCIDENT_TIMELINE_NOTE,
      details: { timelineEventId: event.eventId, kind: "dispatcher_note" },
      createdAt: ts,
      resourceType: "incident",
      resourceId: incidentId,
    });
    return event;
  }

  async export(user: UserContext, incidentId: string): Promise<IncidentTimelineExportResponse> {
    assertEnabled();
    const { agencyId } = await assertIncidentAccess(user, incidentId);
    const events = await repo.listByIncident(incidentId, 2000);
    return {
      incidentId,
      agencyId,
      exportedAt: new Date().toISOString(),
      events,
    };
  }
}
