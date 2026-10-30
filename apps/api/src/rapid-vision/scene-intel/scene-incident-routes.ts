import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { canAdminVision, canRequestVisionAccess, canViewVision, type UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { badRequest, forbidden, notFound, ok } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";
import { env } from "../../lib/env.js";
import { visionStore } from "../store.js";
import {
  applySceneIncidentAction,
  buildSceneIncident,
  isSceneIncidentOpen,
  parseDetectionInput,
  qualifyDetection,
  type SceneIncident,
} from "./scene-incident.js";

const auditRepo = new AuditRepository();

function asIncident(row: Record<string, unknown>): SceneIncident | null {
  if (row.recordType !== "scene_incident") return null;
  if (typeof row.id !== "string" || typeof row.agencyId !== "string") return null;
  return row as unknown as SceneIncident;
}

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

async function audit(agencyId: string, actorId: string, type: (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES], incident: SceneIncident) {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId,
      type,
      details: {
        sceneIncidentId: incident.id,
        status: incident.status,
        category: incident.detectionCategory,
        synthetic: incident.synthetic,
        cadCreatedBySystem: false,
        linkedCadIncidentId: incident.linkedCadIncidentId,
      },
      createdAt: new Date().toISOString(),
      resourceType: "vision_scene_alert",
      resourceId: incident.id,
    });
  } catch (err) {
    console.warn(JSON.stringify({ msg: "vision_scene_incident_audit_failed", error: String(err) }));
  }
}

async function notifyWatchDesk(incident: SceneIncident) {
  if (!env.enableVisionAiWs || incident.priority !== "critical" || incident.status !== "UNVERIFIED") return;
  try {
    await broadcastToAgency({
      agencyId: incident.agencyId,
      message: {
        type: "rapid-vision.scene.alert",
        data: {
          alert: {
            eventId: incident.id,
            agencyId: incident.agencyId,
            severity: "critical",
            status: "active",
            synthetic: incident.synthetic,
          },
        },
      },
    });
  } catch (err) {
    console.warn(JSON.stringify({ msg: "vision_scene_incident_notify_failed", error: String(err) }));
  }
}

export async function handleSceneIncidentRoutes(
  event: APIGatewayProxyEventV2,
  method: string,
  rest: string[],
  user: UserContext,
): Promise<APIGatewayProxyResultV2 | null> {
  if (rest[0] !== "scene-incidents") return null;
  const agencyId = user.agencyId;
  if (!agencyId) return forbidden();

  if (method === "GET" && rest.length === 1) {
    if (!canViewVision(user, agencyId)) return forbidden();
    const rows = await visionStore.listSceneIncidents(agencyId);
    const incidents = rows.map(asIncident).filter((row): row is SceneIncident => row != null && row.agencyId === agencyId);
    return ok({ success: true, data: { incidents } });
  }

  if (method === "POST" && rest.length === 1) {
    if (!canAdminVision(user, agencyId)) return forbidden();
    const parsed = parseDetectionInput(parseBody(event.body));
    if (!parsed.success) return badRequest("Camera, category, and frame count are required.");
    const input = parsed.data;
    if (!input.synthetic) {
      return badRequest("No approved detection model is connected. Use a labeled test.");
    }
    const qualified = qualifyDetection({
      category: input.category,
      frameCount: input.frameCount,
      negativeExample: input.negativeExample,
      modelApproved: false,
      synthetic: true,
    });
    if (!qualified.ok) return badRequest(qualified.reason);

    const existing = (await visionStore.listSceneIncidents(agencyId))
      .map(asIncident)
      .find(
        (row) =>
          row &&
          row.agencyId === agencyId &&
          isSceneIncidentOpen(row.status) &&
          row.detectionCategory === qualified.category.id &&
          row.cameraIds.includes(input.cameraId),
      );
    if (existing) {
      return ok({ success: true, data: { incident: existing, deduplicated: true } });
    }

    const incident = buildSceneIncident({
      id: `VSN-${new Date().getUTCFullYear()}-${makeId("vsn").slice(-4).toUpperCase()}`,
      agencyId,
      cameraId: input.cameraId,
      cameraName: input.cameraName,
      zoneLabel: input.zoneLabel,
      category: qualified.category,
      synthetic: true,
      modelVersion: "test-fixture",
    });
    await visionStore.putSceneIncident(incident);
    await audit(agencyId, user.userId, AUDIT_EVENT_TYPES.VISION_SCENE_ALERT_CREATED, incident);
    await notifyWatchDesk(incident);
    return ok({ success: true, data: { incident, deduplicated: false } });
  }

  if (rest.length === 2 && (method === "PATCH" || method === "POST")) {
    if (!canRequestVisionAccess(user, agencyId)) return forbidden();
    const id = decodeURIComponent(rest[1] ?? "").trim();
    const current = (await visionStore.listSceneIncidents(agencyId))
      .map(asIncident)
      .find((row) => row?.id === id && row.agencyId === agencyId);
    if (!current) return notFound("Scene incident not found");
    const body = parseBody(event.body) as {
      action?: string;
      reason?: string;
      note?: string;
      linkedCadIncidentId?: string;
      cadConfirmed?: boolean;
    } | null;
    const actionName = body?.action;
    const at = new Date().toISOString();
    const applied =
      actionName === "acknowledge"
        ? applySceneIncidentAction(current, { type: "acknowledge", operatorId: user.userId, at })
        : actionName === "review"
          ? applySceneIncidentAction(current, { type: "review", operatorId: user.userId, at })
          : actionName === "verify"
            ? applySceneIncidentAction(current, { type: "verify", operatorId: user.userId, note: body?.note ?? "", at })
            : actionName === "dismiss"
              ? applySceneIncidentAction(current, { type: "dismiss", operatorId: user.userId, reason: body?.reason ?? "", at })
              : actionName === "authorize_dispatch"
                ? applySceneIncidentAction(current, {
                    type: "authorize_dispatch",
                    operatorId: user.userId,
                    linkedCadIncidentId: body?.linkedCadIncidentId ?? "",
                    cadConfirmed: body?.cadConfirmed === true,
                    at,
                  })
                : { ok: false as const, reason: "Unknown action." };
    if (!applied.ok) return badRequest(applied.reason);
    await visionStore.putSceneIncident(applied.incident);
    const auditType =
      applied.incident.status === "DISMISSED"
        ? AUDIT_EVENT_TYPES.VISION_SCENE_ALERT_DISMISSED
        : applied.incident.status === "DISPATCHED"
          ? AUDIT_EVENT_TYPES.VISION_SCENE_ALERT_INCIDENT_CREATED
          : AUDIT_EVENT_TYPES.VISION_SCENE_ALERT_CREATED;
    await audit(agencyId, user.userId, auditType, applied.incident);
    return ok({ success: true, data: { incident: applied.incident } });
  }

  return null;
}
