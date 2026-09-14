import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  cameraStatusFromHeartbeat,
  concurrentStreamLimitForRole,
  videoWallConfigPutBodySchema,
  type CameraHealthSummary,
  type VideoTileStatus,
  type VenueCamera,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  jsonStatus,
  ok,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { CampusCameraRegistryRepository } from "../../repositories/campusCameraRegistryRepository.js";
import { TransitCameraRegistryRepository } from "../../repositories/transitCameraRegistryRepository.js";
import { VenueCameraRegistryRepository } from "../../repositories/venueCameraRegistryRepository.js";
import { VideoWallConfigRepository } from "../../repositories/videoWallConfigRepository.js";
import { requireAgencyRoute } from "../vertical/agency-route-context.js";
import { handleVideoDvr } from "./dvr.js";
import { handleVideoPtz } from "./ptz.js";

const auditRepo = new AuditRepository();
const wallRepo = new VideoWallConfigRepository();

type VideoErrorCode =
  | "STREAM_LIMIT_EXCEEDED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAUTHORIZED";

function videoError(code: VideoErrorCode, error: string, statusCode: number) {
  return jsonStatus({ error, code }, statusCode);
}

function pathTail(event: APIGatewayProxyEventV2): string[] {
  const proxy = event.pathParameters?.proxy?.trim() ?? "";
  return proxy.split("/").filter(Boolean);
}

async function listAgencyCameras(agencyId: string): Promise<VenueCamera[]> {
  const out: VenueCamera[] = [];
  const seen = new Set<string>();
  const loaders: Array<() => Promise<VenueCamera[]>> = [];
  if (process.env.VENUE_CAMERA_REGISTRY_TABLE?.trim()) {
    loaders.push(() => new VenueCameraRegistryRepository().listByAgency(agencyId));
  }
  if (process.env.CAMPUS_CAMERA_REGISTRY_TABLE?.trim()) {
    loaders.push(() => new CampusCameraRegistryRepository().listByAgency(agencyId));
  }
  if (process.env.TRANSIT_CAMERA_REGISTRY_TABLE?.trim()) {
    loaders.push(() => new TransitCameraRegistryRepository().listByAgency(agencyId));
  }
  for (const load of loaders) {
    try {
      const rows = await load();
      for (const cam of rows) {
        if (seen.has(cam.cameraId)) continue;
        seen.add(cam.cameraId);
        out.push(cam);
      }
    } catch (error) {
      console.warn("[rapid-cortex-video] camera registry list skipped", error);
    }
  }
  return out;
}

function healthForCameras(cameras: VenueCamera[]): {
  summary: CameraHealthSummary;
  cameras: Array<{
    position: number;
    cameraId: string;
    displayName: string;
    kvsChannelName: string;
    vendor: string;
    ptzCapable: boolean;
    section?: string;
    buildingId?: string;
    status: VideoTileStatus;
    lastHeartbeat?: string;
  }>;
} {
  const now = Date.now();
  let online = 0;
  let offline = 0;
  let unknown = 0;
  const mapped = cameras.map((cam) => {
    const status = cameraStatusFromHeartbeat(cam.status, cam.lastHeartbeat, now);
    if (status === "online") online += 1;
    else if (status === "offline") offline += 1;
    else unknown += 1;
    return {
      position: 0,
      cameraId: cam.cameraId,
      displayName: cam.displayName,
      kvsChannelName: cam.kvsChannelName,
      vendor: cam.vendor,
      ptzCapable: cam.ptzCapable,
      section: cam.sections[0],
      buildingId: cam.buildingId,
      status,
      lastHeartbeat: cam.lastHeartbeat,
    };
  });
  return {
    summary: {
      total: cameras.length,
      online,
      offline,
      unknown,
      lastCheckedAt: new Date(now).toISOString(),
    },
    cameras: mapped,
  };
}

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

/**
 * Rapid Cortex Video HTTP — command video wall + DVR + PTZ catch-all.
 * Routes: GET/PUT /api/video/{agencyId}/wall/config
 *         GET /api/video/{agencyId}/cameras/health
 *         DVR: playback-session, fragments, recording, clips
 *         PTZ: move, stop, zoom, presets (relayed to on-prem gateway — never camera IPs)
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableRcVideo) {
      return withCorrelationHeaders(event, serviceUnavailable("Rapid Cortex Video is disabled"));
    }

    const parts = pathTail(event);
    const method = event.requestContext.http.method.toUpperCase();

    if (parts[0] === "wall" && parts[1] === "config" && parts.length === 2) {
      const ctx = await requireAgencyRoute(event, "video.wall.view");
      if ("response" in ctx) return ctx.response;

      if (method === "GET") {
        const config = await wallRepo.get(ctx.agencyId, ctx.user.userId);
        try {
          await auditRepo.create({
            eventId: makeId("audit"),
            agencyId: ctx.agencyId,
            actorId: ctx.user.userId,
            type: AUDIT_EVENT_TYPES.VIDEO_WALL_OPENED,
            details: { layout: config?.layout ?? "2x2" },
            createdAt: new Date().toISOString(),
            resourceType: "video_wall",
            resourceId: ctx.user.userId,
          });
        } catch (error) {
          console.warn("[rapid-cortex-video] audit wall opened skipped", error);
        }
        return withCorrelationHeaders(
          event,
          ok({
            config,
            streamLimit: concurrentStreamLimitForRole(ctx.user.role),
          }),
        );
      }

      if (method === "PUT") {
        const writeCtx = await requireAgencyRoute(event, "video.wall.configure");
        if ("response" in writeCtx) return writeCtx.response;
        const body = parseBody(event.body);
        if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
        const parsed = videoWallConfigPutBodySchema.safeParse(body);
        if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));

        const limit = concurrentStreamLimitForRole(writeCtx.user.role);
        const assigned = parsed.data.tiles.filter((t) => t.cameraId.trim().length > 0);
        if (assigned.length > limit) {
          return withCorrelationHeaders(
            event,
            videoError(
              "STREAM_LIMIT_EXCEEDED",
              `Role ${writeCtx.user.role} may open at most ${limit} concurrent live streams`,
              400,
            ),
          );
        }

        const config = {
          agencyId: writeCtx.agencyId,
          userId: writeCtx.user.userId,
          layout: parsed.data.layout,
          tiles: parsed.data.tiles,
          savedAt: new Date().toISOString(),
        };
        await wallRepo.put(config);
        try {
          await auditRepo.create({
            eventId: makeId("audit"),
            agencyId: writeCtx.agencyId,
            actorId: writeCtx.user.userId,
            type: AUDIT_EVENT_TYPES.VIDEO_WALL_CONFIGURED,
            details: { layout: config.layout, tileCount: assigned.length },
            createdAt: config.savedAt,
            resourceType: "video_wall",
            resourceId: writeCtx.user.userId,
          });
        } catch (error) {
          console.warn("[rapid-cortex-video] audit wall configured skipped", error);
        }
        return withCorrelationHeaders(event, ok({ config, streamLimit: limit }));
      }
    }

    if (parts[0] === "cameras" && parts[1] === "health" && parts.length === 2 && method === "GET") {
      const ctx = await requireAgencyRoute(event, "video.wall.view");
      if ("response" in ctx) return ctx.response;
      const cameras = await listAgencyCameras(ctx.agencyId);
      return withCorrelationHeaders(event, ok(healthForCameras(cameras)));
    }

    const dvr = await handleVideoDvr(event, parts, method);
    if (dvr) return withCorrelationHeaders(event, dvr);

    const ptz = await handleVideoPtz(event, parts, method);
    if (ptz) return withCorrelationHeaders(event, ptz);

    return withCorrelationHeaders(event, jsonStatus({ error: "Not found", code: "NOT_FOUND" }, 404));
  } catch (error) {
    console.error("[rapid-cortex-video]", error);
    if (
      error instanceof Error &&
      (error.message.includes("VIDEO_WALL_CONFIGS_TABLE") || error.message.includes("VIDEO_CLIPS_TABLE"))
    ) {
      return withCorrelationHeaders(event, serviceUnavailable("Rapid Cortex Video storage is not configured"));
    }
    return withCorrelationHeaders(event, serverError());
  }
};
