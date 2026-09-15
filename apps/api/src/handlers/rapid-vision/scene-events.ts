import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  canAdminVision,
  canRequestVisionAccess,
  canViewVision,
  demoSceneAlerts,
  visionCameraSceneConfigSchema,
  visionSceneEventPatchSchema,
  visionSceneEventsQuerySchema,
  type UserContext,
  type VisionSceneAlertStatus,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serviceUnavailable,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { broadcastToAgency } from "../../lib/websocket/send-message.js";
import { visionStore } from "../../rapid-vision/store.js";
import { persistSceneAlert } from "../../rapid-vision/scene-intel/classify-worker.js";

const auditRepo = new AuditRepository();

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

async function seedDemoIfEmpty(agencyId: string): Promise<void> {
  if (!env.visionAiMock && !env.enableRapidVisionDemo) return;
  const existing = await visionStore.listSceneAlerts(agencyId, { status: "active", limit: 5 });
  if (existing.length > 0) return;
  const alerts = demoSceneAlerts(agencyId);
  for (const alert of alerts) {
    try {
      await persistSceneAlert(alert);
    } catch (err) {
      console.warn(JSON.stringify({ msg: "vision_scene_demo_seed_failed", error: String(err) }));
    }
  }
}

export async function handleSceneIntelRoutes(
  event: APIGatewayProxyEventV2,
  method: string,
  rest: string[],
  user: UserContext,
): Promise<APIGatewayProxyResultV2 | null> {
  if (!env.enableRapidVisionSceneIntel) {
    return serviceUnavailable("Rapid Vision™ Scene Intelligence is disabled");
  }

  if (method === "GET" && rest[0] === "events" && rest.length === 1) {
    if (!canViewVision(user, user.agencyId)) return forbidden();
    const parsed = visionSceneEventsQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) return badRequestFromZod(parsed.error);
    await seedDemoIfEmpty(user.agencyId);
    const status = (parsed.data.status ?? "active") as VisionSceneAlertStatus | "all";
    let alerts = await visionStore.listSceneAlerts(user.agencyId, {
      status,
      cameraId: parsed.data.cameraId,
      limit: parsed.data.limit ?? 50,
    });
    if (alerts.length === 0 && (env.visionAiMock || env.enableRapidVisionDemo) && status !== "dismissed") {
      alerts = demoSceneAlerts(user.agencyId).filter(
        (row) => !parsed.data.cameraId || row.cameraId === parsed.data.cameraId,
      );
    }
    return ok({
      success: true,
      data: {
        alerts,
        newCount: alerts.filter((a) => a.status === "active").length,
      },
    });
  }

  if (rest[0] === "events" && rest.length === 2) {
    if (!canViewVision(user, user.agencyId)) return forbidden();
    const eventId = decodeURIComponent(rest[1] ?? "").trim();
    if (!eventId) return badRequest("eventId required");
    const alert = await visionStore.getSceneAlert(user.agencyId, eventId);
    if (!alert) return notFound("Scene alert not found");

    if (method === "GET") {
      return ok({ success: true, data: { alert } });
    }

    if (method === "PATCH") {
      if (!canRequestVisionAccess(user, user.agencyId)) return forbidden();
      const parsed = visionSceneEventPatchSchema.safeParse(parseBody(event.body) ?? {});
      if (!parsed.success) return badRequestFromZod(parsed.error);
      if (parsed.data.action === "create_incident" && !parsed.data.incidentId) {
        return badRequest("incidentId required to link a scene alert");
      }
      const next = await visionStore.updateSceneAlertStatus({
        alert,
        status: parsed.data.action === "dismiss" ? "dismissed" : "incident_created",
        incidentId: parsed.data.incidentId,
        dismissedBy: parsed.data.action === "dismiss" ? user.userId : undefined,
      });
      if (env.enableVisionAiWs) {
        await broadcastToAgency({
          agencyId: user.agencyId,
          message: { type: "rapid-vision.scene.updated", data: { alert: next } },
        });
      }
      try {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          incidentId: next.incidentId,
          actorId: user.userId,
          type:
            parsed.data.action === "dismiss"
              ? AUDIT_EVENT_TYPES.VISION_SCENE_ALERT_DISMISSED
              : AUDIT_EVENT_TYPES.VISION_SCENE_ALERT_INCIDENT_CREATED,
          details: { eventId: next.eventId, cameraId: next.cameraId },
          createdAt: new Date().toISOString(),
          resourceType: "vision_scene_alert",
          resourceId: next.eventId,
        });
      } catch (err) {
        console.warn(JSON.stringify({ msg: "vision_scene_alert_patch_audit_failed", error: String(err) }));
      }
      return ok({ success: true, data: { alert: next } });
    }
    return null;
  }

  if (method === "PUT" && rest[0] === "cameras" && rest[2] === "config" && rest.length === 3) {
    if (!env.enableVisionAiAdmin) return serviceUnavailable("Scene Intelligence admin is disabled");
    if (!canAdminVision(user, user.agencyId)) return forbidden();
    const cameraId = decodeURIComponent(rest[1] ?? "").trim();
    if (!cameraId) return badRequest("cameraId required");
    const parsed = visionCameraSceneConfigSchema.safeParse(parseBody(event.body) ?? {});
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const camera = await visionStore.getCamera(user.agencyId, cameraId);
    if (!camera) return notFound("Camera not found");
    const next = await visionStore.updateCameraSceneConfig(camera, parsed.data);
    return ok({ success: true, data: { camera: next } });
  }

  return null;
}
