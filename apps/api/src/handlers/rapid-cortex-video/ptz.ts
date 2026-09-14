import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  videoPtzMoveBodySchema,
  videoPtzPresetSaveBodySchema,
  videoPtzPresetGotoBodySchema,
  videoPtzZoomBodySchema,
  type VideoApiErrorCode,
  type VideoGatewayRelayBody,
  type VideoPtzPreset,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  jsonStatus,
  ok,
  tooManyRequests,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { relayPtzToGateway } from "../../services/videoGatewayRelay.js";
import { consumePtzRateLimit, ptzRateLimitKey } from "../../services/videoPtzRateLimit.js";
import { requireAgencyRoute } from "../vertical/agency-route-context.js";
import { getAgencyCamera, updateCameraPtzPresets } from "./camera-lookup.js";

const auditRepo = new AuditRepository();

function videoError(code: VideoApiErrorCode, error: string, statusCode: number) {
  return jsonStatus({ error, code }, statusCode);
}

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

async function auditSafe(input: Parameters<AuditRepository["create"]>[0]): Promise<void> {
  try {
    await auditRepo.create(input);
  } catch (error) {
    console.warn("[rapid-cortex-video] PTZ audit skipped", error);
  }
}

function cameraPresets(camera: { ptzPresets?: VideoPtzPreset[] }): VideoPtzPreset[] {
  return camera.ptzPresets ?? [];
}

/**
 * Phase 3 PTZ routes: Browser → Video Lambda → on-prem gateway sidecar → camera.
 * Never send ONVIF to the camera IP from this Lambda.
 */
export async function handleVideoPtz(
  event: APIGatewayProxyEventV2,
  parts: string[],
  method: string,
): Promise<APIGatewayProxyResultV2 | null> {
  if (parts[0] !== "cameras" || parts[2] !== "ptz") return null;
  const cameraId = parts[1] ?? "";
  const action = parts.slice(3);

  const ctx = await requireAgencyRoute(event, "video.ptz.control");
  if ("response" in ctx) return ctx.response;

  const camera = await getAgencyCamera(ctx.agencyId, cameraId);
  if (!camera) return videoError("NOT_FOUND", "Camera not found", 404);
  if (!camera.ptzCapable) return videoError("FORBIDDEN", "Camera is not PTZ capable", 400);

  if (action[0] === "presets" && action.length === 1 && method === "GET") {
    return ok({ presets: cameraPresets(camera), mock: !env.videoGatewayUrl || env.videoGatewayMock });
  }

  if (method !== "POST") return null;

  if (!consumePtzRateLimit(ptzRateLimitKey(ctx.agencyId, ctx.user.userId, camera.cameraId))) {
    return tooManyRequests("PTZ rate limit exceeded (60 commands per minute)", 60);
  }

  const body = parseBody(event.body);
  if (action[0] === "move" && action.length === 1) {
    if (body === null) return badRequest("Invalid JSON body");
    const parsed = videoPtzMoveBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const relay = await sendRelay(ctx.agencyId, camera.cameraId, camera.cameraIp, {
      command: "ContinuousMove",
      direction: parsed.data.direction,
      speed: parsed.data.speed,
    });
    if (!relay.ok) return relay.response;
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_PTZ_MOVED,
      details: { cameraId: camera.cameraId, direction: parsed.data.direction, speed: parsed.data.speed, mock: relay.mock },
      createdAt: new Date().toISOString(),
      resourceType: "video_ptz",
      resourceId: camera.cameraId,
    });
    return ok({ accepted: true, mock: relay.mock, action: parsed.data.direction });
  }

  if (action[0] === "stop" && action.length === 1) {
    const relay = await sendRelay(ctx.agencyId, camera.cameraId, camera.cameraIp, { command: "Stop" });
    if (!relay.ok) return relay.response;
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_PTZ_STOPPED,
      details: { cameraId: camera.cameraId, mock: relay.mock },
      createdAt: new Date().toISOString(),
      resourceType: "video_ptz",
      resourceId: camera.cameraId,
    });
    return ok({ accepted: true, mock: relay.mock });
  }

  if (action[0] === "zoom" && action.length === 1) {
    if (body === null) return badRequest("Invalid JSON body");
    const parsed = videoPtzZoomBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const relay = await sendRelay(ctx.agencyId, camera.cameraId, camera.cameraIp, {
      command: "Zoom",
      zoomDirection: parsed.data.direction,
      speed: parsed.data.speed,
    });
    if (!relay.ok) return relay.response;
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_PTZ_ZOOMED,
      details: { cameraId: camera.cameraId, direction: parsed.data.direction, mock: relay.mock },
      createdAt: new Date().toISOString(),
      resourceType: "video_ptz",
      resourceId: camera.cameraId,
    });
    return ok({ accepted: true, mock: relay.mock, action: parsed.data.direction });
  }

  if (action[0] === "preset" && action[1] === "goto" && action.length === 2) {
    if (body === null) return badRequest("Invalid JSON body");
    const parsed = videoPtzPresetGotoBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const relay = await sendRelay(ctx.agencyId, camera.cameraId, camera.cameraIp, {
      command: "GotoPreset",
      presetToken: parsed.data.presetToken,
    });
    if (!relay.ok) return relay.response;
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_PTZ_PRESET_GOTO,
      details: { cameraId: camera.cameraId, presetToken: parsed.data.presetToken, mock: relay.mock },
      createdAt: new Date().toISOString(),
      resourceType: "video_ptz",
      resourceId: camera.cameraId,
    });
    return ok({ accepted: true, mock: relay.mock });
  }

  if (action[0] === "preset" && action[1] === "save" && action.length === 2) {
    if (body === null) return badRequest("Invalid JSON body");
    const parsed = videoPtzPresetSaveBodySchema.safeParse(body);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const relay = await sendRelay(ctx.agencyId, camera.cameraId, camera.cameraIp, {
      command: "SetPreset",
      presetName: parsed.data.presetName,
    });
    if (!relay.ok) return relay.response;
    const token = `preset-${Date.now().toString(36)}`;
    const next: VideoPtzPreset[] = [
      ...cameraPresets(camera).filter((p) => p.name !== parsed.data.presetName),
      { token, name: parsed.data.presetName },
    ].slice(0, 16);
    await updateCameraPtzPresets(ctx.agencyId, camera.cameraId, next);
    await auditSafe({
      eventId: makeId("audit"),
      agencyId: ctx.agencyId,
      actorId: ctx.user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_PTZ_PRESET_SAVED,
      details: { cameraId: camera.cameraId, presetName: parsed.data.presetName, mock: relay.mock },
      createdAt: new Date().toISOString(),
      resourceType: "video_ptz",
      resourceId: camera.cameraId,
    });
    return ok({ accepted: true, mock: relay.mock, presets: next });
  }

  return null;
}

async function sendRelay(
  agencyId: string,
  cameraId: string,
  cameraIp: string | undefined,
  command: Omit<VideoGatewayRelayBody, "agencyId" | "cameraId" | "cameraIp">,
): Promise<{ ok: true; mock: boolean } | { ok: false; response: APIGatewayProxyResultV2 }> {
  const result = await relayPtzToGateway({
    agencyId,
    cameraId,
    cameraIp,
    ...command,
  });
  if (!result.ok) {
    return { ok: false, response: videoError("GATEWAY_UNAVAILABLE", result.error, 502) };
  }
  return { ok: true, mock: result.mock };
}
