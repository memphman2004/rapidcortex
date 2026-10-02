import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  canAdminVision,
  canRequestVisionAccess,
  canViewVision,
  canViewVisionSupervisorDashboard,
  demoSceneAlerts,
  summarizeSceneAlerts,
  visionCameraSceneConfigSchema,
  visionSceneEventPatchSchema,
  visionSceneEventsQuerySchema,
  type UserContext,
  type VisionCamera,
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

async function loadAlert(agencyId: string, eventId: string) {
  const existing = await visionStore.getSceneAlert(agencyId, eventId);
  if (existing) return existing;
  if (!env.visionAiMock && !env.enableRapidVisionDemo) return null;
  const demo = demoSceneAlerts(agencyId).find((row) => row.eventId === eventId);
  if (!demo) return null;
  try {
    await persistSceneAlert(demo);
  } catch (err) {
    console.warn(JSON.stringify({ msg: "vision_scene_demo_hydrate_failed", error: String(err) }));
  }
  return demo;
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
    const alert = await loadAlert(user.agencyId, eventId);
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
      if (parsed.data.action === "dismiss" && !parsed.data.dismissReason) {
        return badRequest("dismissReason required");
      }
      const next = await visionStore.updateSceneAlertStatus({
        alert,
        status: parsed.data.action === "dismiss" ? "dismissed" : "incident_created",
        incidentId: parsed.data.incidentId,
        dismissedBy: parsed.data.action === "dismiss" ? user.userId : undefined,
        dismissReason: parsed.data.dismissReason,
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

  if (method === "GET" && rest[0] === "cameras" && rest.length === 1) {
    if (!canViewVision(user, user.agencyId)) return forbidden();
    let cameras = await visionStore.listCamerasForAgency(user.agencyId);
    if (cameras.length === 0 && (env.visionAiMock || env.enableRapidVisionDemo)) {
      cameras = seedSceneDemoCameras(user.agencyId);
      await Promise.allSettled(cameras.map((camera) => visionStore.putCamera(camera)));
    }
    return ok({
      success: true,
      data: {
        cameras: cameras.map((camera) => ({
          cameraId: camera.cameraId,
          friendlyName: camera.friendlyName,
          zoneLabel: camera.zoneLabel ?? "",
          connectionStatus: camera.connectionStatus,
          aiMonitoringEnabled: camera.aiMonitoringEnabled !== false,
          sceneSensitivity: camera.sceneSensitivity ?? "medium",
          sceneCooldownSeconds: camera.sceneCooldownSeconds ?? 120,
          provider: camera.provider,
        })),
      },
    });
  }

  if (method === "GET" && rest[0] === "scene-stats" && rest.length === 1) {
    if (!canViewVisionSupervisorDashboard(user, user.agencyId)) return forbidden();
    await seedDemoIfEmpty(user.agencyId);
    let alerts = await visionStore.listSceneAlerts(user.agencyId, { status: "all", limit: 100 });
    if (alerts.length === 0 && (env.visionAiMock || env.enableRapidVisionDemo)) {
      alerts = demoSceneAlerts(user.agencyId);
    }
    return ok({ success: true, data: { windowHours: 24, ...summarizeSceneAlerts(alerts), alerts } });
  }

  return null;
}

function seedSceneDemoCameras(agencyId: string): VisionCamera[] {
  const now = new Date().toISOString();
  return [
    {
      cameraId: "demo-device-001",
      provider: "demo" as const,
      providerDeviceId: "demo-device-001",
      ownerId: null,
      agencyId,
      friendlyName: "5th & Main – Northeast Corner",
      cameraType: "fixed_outdoor" as const,
      latitude: 39.1,
      longitude: -84.5,
      coverageAreaM: 40,
      isPublic: true,
      isIndoor: false,
      capabilities: ["live_stream" as const, "motion_detection" as const],
      consentPolicy: "preauthorized_emergency" as const,
      connectionStatus: "online" as const,
      lastHealthCheck: now,
      aiMonitoringEnabled: true,
      zoneLabel: "Downtown District",
      sceneSensitivity: "high" as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      cameraId: "demo-device-002",
      provider: "demo" as const,
      providerDeviceId: "demo-device-002",
      ownerId: null,
      agencyId,
      friendlyName: "Campus Lot C",
      cameraType: "fixed_outdoor" as const,
      latitude: 39.101,
      longitude: -84.502,
      coverageAreaM: 50,
      isPublic: true,
      isIndoor: false,
      capabilities: ["live_stream" as const, "motion_detection" as const],
      consentPolicy: "preauthorized_emergency" as const,
      connectionStatus: "online" as const,
      lastHealthCheck: now,
      aiMonitoringEnabled: true,
      zoneLabel: "Campus perimeter",
      sceneSensitivity: "medium" as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      cameraId: "demo-device-003",
      provider: "demo" as const,
      providerDeviceId: "demo-device-003",
      ownerId: null,
      agencyId,
      friendlyName: "Platform B – Track 2 South End",
      cameraType: "fixed_outdoor" as const,
      latitude: 39.099,
      longitude: -84.498,
      coverageAreaM: 35,
      isPublic: true,
      isIndoor: false,
      capabilities: ["live_stream" as const, "motion_detection" as const],
      consentPolicy: "preauthorized_emergency" as const,
      connectionStatus: "online" as const,
      lastHealthCheck: now,
      aiMonitoringEnabled: true,
      zoneLabel: "Central Station",
      sceneSensitivity: "medium" as const,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
