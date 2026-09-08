import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  fieldAccessRequestBodySchema,
  fieldAccessToolsRequestable,
  fieldCoachingNoteBodySchema,
  fieldContinuityLogBodySchema,
  fieldIncidentMessageBodySchema,
  fieldRoleHasDispatch911,
  normalizeFieldAccessToolId,
} from "rapid-cortex-shared";
import type { Incident, TranscriptSegment, UserContext } from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES, type Permission } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { ActiveCallRepository } from "../../repositories/activeCallRepository.js";
import { WebSocketConnectionRepository } from "../../repositories/websocketConnectionRepository.js";
import { IncidentService } from "../../services/incidentService.js";
import { TranscriptService } from "../../services/transcriptService.js";
import { IncidentTimelineService } from "../../services/incidentTimelineService.js";
import { fieldCommandStore } from "../../field/store.js";
import { notifyAccessRequest } from "../../field/notify.js";

const authz = new AuthorizationService();
const auditRepo = new AuditRepository();
const incidents = new IncidentService();
const transcripts = new TranscriptService();
const timeline = new IncidentTimelineService();
const connections = new WebSocketConnectionRepository();
const activeCalls = new ActiveCallRepository();

const URGENCY_RANK: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function rest(path: string, prefix: string): string[] {
  const idx = path.indexOf(prefix);
  const tail = idx >= 0 ? path.slice(idx + prefix.length) : "";
  return tail.split("/").filter(Boolean);
}

function requirePerm(user: UserContext, perm: Permission): void {
  if (!authz.canPerform(user, perm)) {
    throw new Error("FORBIDDEN");
  }
}

/** Field workspace table is the grant source — inherited PSAP perms are not enough. */
function requireDispatch911Workspace(user: UserContext): void {
  if (!fieldRoleHasDispatch911(user.role)) {
    throw new Error("FORBIDDEN");
  }
}

function slimIncident(incident: Incident) {
  return {
    incidentId: incident.incidentId,
    title: incident.title,
    status: incident.status,
    urgency: incident.urgency,
    category: incident.category,
    summary: incident.summary,
    escalationFlag: incident.escalationFlag,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
    location: incident.callerAddressLine ?? incident.cadLocation ?? null,
  };
}

function mapSpeaker(speaker: TranscriptSegment["speaker"]): "caller" | "dispatcher" | "rc_ai" {
  if (speaker === "caller") return "caller";
  if (speaker === "dispatcher") return "dispatcher";
  return "rc_ai";
}

function isOpenIncident(incident: Incident): boolean {
  return incident.status === "active" || incident.status === "in_progress";
}

async function audit(
  user: UserContext,
  type: string,
  resourceId: string,
  details: Record<string, unknown>,
  incidentId?: string,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: user.agencyId,
    actorId: user.userId,
    incidentId,
    type,
    details,
    createdAt: new Date().toISOString(),
    resourceType: "agency",
    resourceId,
  });
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableFieldCommand) {
      return withCorrelationHeaders(event, serviceUnavailable("Field Command is not enabled"));
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? "";
    const body = parseBody(event.body);
    if (event.body && body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));

    if (method === "POST" && path.endsWith("/api/access-requests")) {
      return withCorrelationHeaders(event, await handleAccessRequest(user, body));
    }

    const parts = rest(path, "/api/field/command/");

    if (method === "GET" && parts[0] === "home" && parts.length === 1) {
      requireDispatch911Workspace(user);
      requirePerm(user, "field.command.view");
      return withCorrelationHeaders(event, await handleHome(user, event.queryStringParameters?.agencyId));
    }

    if (method === "GET" && parts[0] === "staff" && parts.length === 1) {
      requireDispatch911Workspace(user);
      requirePerm(user, "field.command.view");
      return withCorrelationHeaders(event, await handleStaff(user));
    }

    if (method === "GET" && parts[0] === "continuity-log" && parts.length === 1) {
      requireDispatch911Workspace(user);
      requirePerm(user, "field.command.view");
      const items = await fieldCommandStore.listContinuityLogs(user.agencyId);
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (method === "POST" && parts[0] === "continuity-log" && parts.length === 1) {
      requireDispatch911Workspace(user);
      requirePerm(user, "field.command.act");
      const parsed = fieldContinuityLogBodySchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const entry = await fieldCommandStore.putContinuityLog({
        agencyId: user.agencyId,
        category: parsed.data.category,
        text: parsed.data.text,
        critical: parsed.data.critical ?? false,
        actorId: user.userId,
      });
      await audit(user, AUDIT_EVENT_TYPES.FIELD_COMMAND_CONTINUITY_LOG, entry.entryId, {
        category: entry.category,
        critical: entry.critical,
      });
      return withCorrelationHeaders(event, ok({ entry }, 201));
    }

    if (method === "POST" && parts[0] === "coaching-notes" && parts.length === 1) {
      requireDispatch911Workspace(user);
      requirePerm(user, "field.command.act");
      const parsed = fieldCoachingNoteBodySchema.safeParse(body ?? {});
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const note = await fieldCommandStore.putCoachingNote({
        agencyId: user.agencyId,
        incidentId: parsed.data.incidentId,
        dispatcherUserId: parsed.data.dispatcherUserId ?? "",
        category: parsed.data.category,
        observation: parsed.data.observation,
        discussInNextReview: parsed.data.discussInNextReview ?? false,
        addToQaQueue: parsed.data.addToQaQueue ?? false,
        positiveRecognition: parsed.data.positiveRecognition ?? false,
        actorId: user.userId,
      });
      await audit(user, AUDIT_EVENT_TYPES.FIELD_COMMAND_COACHING_NOTE, note.noteId, {
        dispatcherUserId: note.dispatcherUserId,
        category: note.category,
        addToQaQueue: note.addToQaQueue,
      }, parsed.data.incidentId);
      return withCorrelationHeaders(event, ok({ note }, 201));
    }

    if (parts[0] === "incidents" && parts[1]) {
      const incidentId = parts[1];
      if (method === "GET" && parts.length === 2) {
        requireDispatch911Workspace(user);
        requirePerm(user, "field.command.view");
        const incident = await incidents.get(incidentId, user);
        if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
        return withCorrelationHeaders(event, ok({ incident: slimIncident(incident) }));
      }
      if (method === "GET" && parts[2] === "transcript") {
        requireDispatch911Workspace(user);
        requirePerm(user, "field.command.view");
        const incident = await incidents.get(incidentId, user);
        if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
        const items = (await transcripts.list(incidentId, user)) as TranscriptSegment[];
        const mapped = items
          .slice()
          .sort((a, b) => (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0))
          .map((seg, i) => ({
            sequence: seg.segmentIndex ?? i,
            speaker: mapSpeaker(seg.speaker),
            text: seg.originalTranscript ?? seg.text,
            timestamp: seg.timestamp,
          }));
        return withCorrelationHeaders(event, ok({ items: mapped }));
      }
      if (method === "POST" && parts[2] === "message") {
        requireDispatch911Workspace(user);
        requirePerm(user, "field.command.act");
        const parsed = fieldIncidentMessageBodySchema.safeParse(body ?? {});
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
        const incident = await incidents.get(incidentId, user);
        if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
        const saved = await fieldCommandStore.putMessage({
          agencyId: user.agencyId,
          incidentId,
          actorId: user.userId,
          text: parsed.data.text,
        });
        try {
          await timeline.addNote(user, incidentId, {
            content: `[911 Dispatch] ${parsed.data.text}`,
          });
        } catch {
          // Timeline is optional; workstation message still persisted.
        }
        await audit(user, AUDIT_EVENT_TYPES.FIELD_COMMAND_MESSAGE_SENT, saved.messageId, {
          excerpt: parsed.data.text.slice(0, 200),
        }, incidentId);
        return withCorrelationHeaders(event, ok({ ok: true, messageId: saved.messageId }, 201));
      }
      if (method === "POST" && parts[2] === "qa-flag") {
        requireDispatch911Workspace(user);
        requirePerm(user, "field.command.act");
        const incident = await incidents.get(incidentId, user);
        if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
        const { flagId } = await fieldCommandStore.putQaFlag({
          agencyId: user.agencyId,
          incidentId,
          actorId: user.userId,
        });
        await audit(user, AUDIT_EVENT_TYPES.FIELD_COMMAND_QA_FLAGGED, flagId, {}, incidentId);
        return withCorrelationHeaders(event, ok({ ok: true, flagId }, 201));
      }
      if (method === "POST" && parts[2] === "follow") {
        requireDispatch911Workspace(user);
        requirePerm(user, "field.command.act");
        const incident = await incidents.get(incidentId, user);
        if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));
        await fieldCommandStore.putFollow({
          agencyId: user.agencyId,
          incidentId,
          actorId: user.userId,
        });
        await audit(user, AUDIT_EVENT_TYPES.FIELD_COMMAND_FOLLOWED, incidentId, {}, incidentId);
        return withCorrelationHeaders(event, ok({ ok: true }, 201));
      }
    }

    return withCorrelationHeaders(event, notFound());
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return withCorrelationHeaders(event, forbidden());
    }
    if (error instanceof Error && error.message === "FIELD_COMMAND_TABLE_NOT_CONFIGURED") {
      return withCorrelationHeaders(event, serviceUnavailable("Field Command storage is not configured"));
    }
    console.error("field command http", error);
    return withCorrelationHeaders(event, serverError());
  }
};

async function handleAccessRequest(user: UserContext, body: unknown) {
  const parsed = fieldAccessRequestBodySchema.safeParse(body ?? {});
  if (!parsed.success) return badRequestFromZod(parsed.error);
  if (!user.agencyId) return forbidden("Agency scope is required");

  const tool = normalizeFieldAccessToolId(parsed.data.requestedWorkspace);
  if (!tool) {
    return badRequest("Unknown access request");
  }
  const allowed = new Set(fieldAccessToolsRequestable(user.role, user.vertical));
  if (!allowed.has(tool)) {
    return badRequest("That access is already granted or is not requestable for your role");
  }

  const title =
    parsed.data.requestedWorkspaceTitle ??
    (tool === "dispatch_ops" ? "Operational dashboard" : "QR & NFC code management");

  const row = await fieldCommandStore.putAccessRequest({
    agencyId: user.agencyId,
    requestedWorkspace: tool,
    requestedWorkspaceTitle: title,
    userEmail: user.email,
    userId: user.userId,
    role: user.role,
    reason: parsed.data.reason ?? "",
  });

  const { notified } = await notifyAccessRequest(row);
  await audit(user, AUDIT_EVENT_TYPES.FIELD_ACCESS_REQUEST_CREATED, row.requestId, {
    requestedWorkspace: row.requestedWorkspace,
    notified,
  });

  return ok(
    {
      requestId: row.requestId,
      status: "queued",
      agencyId: user.agencyId,
      requestedWorkspace: row.requestedWorkspace,
      notified,
    },
    201,
  );
}

async function handleHome(user: UserContext, queryAgencyId: string | undefined) {
  const list = await incidents.list(user, queryAgencyId);
  const open = list.filter(isOpenIncident);
  const ranked = open.slice().sort((a, b) => {
    const ua = URGENCY_RANK[a.urgency] ?? 9;
    const ub = URGENCY_RANK[b.urgency] ?? 9;
    if (ua !== ub) return ua - ub;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  const assist = ranked.filter((i) => i.escalationFlag).map(slimIncident);

  let onlineCount = 0;
  let activeCallCount = ranked.length;
  try {
    const ops = await connections.listByAgencyId(user.agencyId);
    onlineCount = new Set(ops.map((o) => o.userId)).size;
  } catch {
    onlineCount = 0;
  }
  try {
    const calls = await activeCalls.listByAgency(user.agencyId);
    activeCallCount = calls.filter((c) => c.status !== "ended").length || ranked.length;
  } catch {
    // keep incident-derived count
  }

  return ok({
    stats: {
      activeCalls: activeCallCount,
      queue: ranked.length,
      onlineCount,
    },
    assistRequests: assist,
    incidents: ranked.map(slimIncident),
  });
}

async function handleStaff(user: UserContext) {
  let rows: Awaited<ReturnType<WebSocketConnectionRepository["listByAgencyId"]>> = [];
  try {
    rows = await connections.listByAgencyId(user.agencyId);
  } catch {
    rows = [];
  }

  const byUser = new Map<
    string,
    { userId: string; displayName: string; role: string; connectedAt: string }
  >();
  for (const row of rows) {
    if (!byUser.has(row.userId)) {
      byUser.set(row.userId, {
        userId: row.userId,
        displayName: row.displayName || row.userId,
        role: row.role,
        connectedAt: row.connectedAt,
      });
    }
  }

  let calls: Awaited<ReturnType<ActiveCallRepository["listByAgency"]>> = [];
  try {
    calls = await activeCalls.listByAgency(user.agencyId);
  } catch {
    calls = [];
  }
  const onCall = new Set(
    calls.filter((c) => c.status !== "ended" && c.currentHandlerUserId).map((c) => c.currentHandlerUserId as string),
  );

  const items = [...byUser.values()]
    .map((op) => ({
      ...op,
      position: op.role,
      status: onCall.has(op.userId) ? "on_call" : "online",
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return ok({ items });
}
