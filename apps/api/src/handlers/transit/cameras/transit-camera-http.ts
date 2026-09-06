import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  transitCamerasQuerySchema,
  venueCameraDiscoverBodySchema,
  venueCameraPtzBodySchema,
  venueCameraUpsertBodySchema,
  venueCameraViewerTokenQuerySchema,
  venueKvsChannelName,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { withCorrelationHeaders } from "../../../lib/correlation.js";
import { makeId } from "../../../lib/ids.js";
import { resolvePlainOrSecretArn } from "../../../lib/runtimeSecrets.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../../lib/response.js";
import { AuditRepository } from "../../../repositories/auditRepository.js";
import { KvsChannelService } from "../../../shared/kvs-channel-service.js";
import { requireTransitRouteContext } from "../transit-route-context.js";
import {
  buildTransitProducerConfigYaml,
  createTransitCamera,
  deleteTransitCamera,
  discoverTransitCamera,
  getCamerasForTransitPlace,
  listTransitCameras,
  recordTransitProducerAgentHeartbeat,
  transitCameraRegistryRepo,
  updateTransitCamera,
} from "./transit-camera-registry-service.js";

const kvs = new KvsChannelService();
const auditRepo = new AuditRepository();

function parseBody(event: APIGatewayProxyEventV2): unknown {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

function methodOf(event: APIGatewayProxyEventV2): string {
  return (event.requestContext.http?.method ?? "GET").toUpperCase();
}

function rawPathOf(event: APIGatewayProxyEventV2): string {
  return event.rawPath ?? "";
}

function match(event: APIGatewayProxyEventV2, method: string, pattern: RegExp): boolean {
  if (methodOf(event) !== method) return false;
  const routeKey = event.routeKey ?? "";
  const path = rawPathOf(event);
  return pattern.test(routeKey.replace(/^[A-Z]+\s+/, "")) || pattern.test(path);
}

function transitCamerasEnabled(): boolean {
  const v = process.env.ENABLE_TRANSIT_CAMERAS?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

async function producerKeyAuthorized(event: APIGatewayProxyEventV2): Promise<boolean> {
  const expected = await resolvePlainOrSecretArn(
    process.env.TRANSIT_CAMERA_PRODUCER_KEY,
    process.env.TRANSIT_CAMERA_PRODUCER_KEY_ARN,
  );
  if (!expected) return false;
  const provided =
    event.headers?.["x-rc-producer-key"]?.trim() || event.headers?.["X-Rc-Producer-Key"]?.trim() || "";
  return Boolean(provided && provided === expected);
}

/**
 * Transit camera HTTP routes. Returns null when the path is not a camera route
 * so the parent transit handler can continue.
 */
export async function tryHandleTransitCameraHttp(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2 | null> {
  const isCameraPath =
    /\/api\/transit\/[^/]+\/cameras(?:\/|$)/.test(event.routeKey?.replace(/^[A-Z]+\s+/, "") ?? "") ||
    /\/api\/transit\/[^/]+\/cameras(?:\/|$)/.test(rawPathOf(event));
  if (!isCameraPath) return null;

  if (!transitCamerasEnabled()) {
    return withCorrelationHeaders(event, notFound());
  }

  try {
    if (match(event, "POST", /^\/api\/transit\/[^/]+\/cameras\/[^/]+\/heartbeat\/?$/)) {
      if (!(await producerKeyAuthorized(event))) {
        return withCorrelationHeaders(event, unauthorized("Invalid producer key"));
      }
      const agencyId = event.pathParameters?.agencyId?.trim();
      const cameraId = event.pathParameters?.cameraId?.trim();
      if (!agencyId || !cameraId) {
        return withCorrelationHeaders(event, badRequest("agencyId and cameraId are required"));
      }
      const camera = await recordTransitProducerAgentHeartbeat(agencyId, cameraId);
      return withCorrelationHeaders(event, ok({ cameraId: camera.cameraId, status: camera.status }));
    }

    if (match(event, "GET", /^\/api\/transit\/[^/]+\/cameras\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.view");
      if ("response" in ctx) return ctx.response;
      const parsed = transitCamerasQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequest("Invalid query parameters"));
      }
      const { vehicle, station, route, cameraIds, limit = 2 } = parsed.data;
      const assignedCameraIds = cameraIds
        ?.split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      const cameras =
        vehicle || station || route || assignedCameraIds?.length
          ? await getCamerasForTransitPlace(
              ctx.agencyId,
              {
                vehicleId: vehicle,
                stationId: station,
                routeId: route,
                assignedCameraIds,
              },
              limit,
            )
          : (await listTransitCameras(ctx.agencyId)).map((c) => ({
              cameraId: c.cameraId,
              displayName: c.displayName,
              kvsChannelName: c.kvsChannelName,
              vendor: c.vendor,
              ptzCapable: c.ptzCapable,
              status: c.status,
              vehicleId: c.vehicleId,
              stationId: c.stationId,
              routeId: c.routeId,
            }));
      return withCorrelationHeaders(event, ok({ cameras }));
    }

    if (match(event, "GET", /^\/api\/transit\/[^/]+\/cameras\/registry\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.view");
      if ("response" in ctx) return ctx.response;
      const cameras = await listTransitCameras(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ cameras }));
    }

    if (match(event, "POST", /^\/api\/transit\/[^/]+\/cameras\/registry\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.manage");
      if ("response" in ctx) return ctx.response;
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = venueCameraUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequest("Invalid camera body"));
      const camera = await createTransitCamera(ctx.agencyId, ctx.user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ camera }));
    }

    if (match(event, "PUT", /^\/api\/transit\/[^/]+\/cameras\/registry\/[^/]+\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.manage");
      if ("response" in ctx) return ctx.response;
      const cameraId = event.pathParameters?.cameraId?.trim();
      if (!cameraId) return withCorrelationHeaders(event, badRequest("cameraId is required"));
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = venueCameraUpsertBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequest("Invalid camera body"));
      const camera = await updateTransitCamera(ctx.agencyId, cameraId, ctx.user.userId, parsed.data);
      return withCorrelationHeaders(event, ok({ camera }));
    }

    if (match(event, "DELETE", /^\/api\/transit\/[^/]+\/cameras\/registry\/[^/]+\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.manage");
      if ("response" in ctx) return ctx.response;
      const cameraId = event.pathParameters?.cameraId?.trim();
      if (!cameraId) return withCorrelationHeaders(event, badRequest("cameraId is required"));
      await deleteTransitCamera(ctx.agencyId, cameraId, ctx.user.userId);
      return withCorrelationHeaders(event, ok({ deleted: true }));
    }

    if (match(event, "GET", /^\/api\/transit\/[^/]+\/cameras\/viewer-token\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.view");
      if ("response" in ctx) return ctx.response;
      const parsed = venueCameraViewerTokenQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!parsed.success) {
        return withCorrelationHeaders(event, badRequest("kvsChannelName is required"));
      }
      const cameras = await transitCameraRegistryRepo.listByAgency(ctx.agencyId);
      const found = cameras.find((c) => c.kvsChannelName === parsed.data.kvsChannelName.trim());
      if (!found) return withCorrelationHeaders(event, forbidden("Camera not registered for agency"));
      const token = await kvs.issueViewerToken(found.kvsChannelName);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: ctx.agencyId,
        actorId: ctx.user.userId,
        type: AUDIT_EVENT_TYPES.TRANSIT_CAMERA_SESSION_STARTED,
        details: { cameraId: found.cameraId, kvsChannelName: found.kvsChannelName },
        createdAt: new Date().toISOString(),
        resourceType: "transit_camera",
        resourceId: found.cameraId,
      });
      return withCorrelationHeaders(
        event,
        ok({
          kvsChannelName: token.channelName,
          channelArn: token.channelArn,
          region: token.region,
          credentials: token.credentials,
          wssEndpoint: token.wssEndpoint,
          iceServers: token.iceServers,
        }),
      );
    }

    if (match(event, "POST", /^\/api\/transit\/[^/]+\/cameras\/[^/]+\/ptz\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.manage");
      if ("response" in ctx) return ctx.response;
      const cameraId = event.pathParameters?.cameraId?.trim();
      if (!cameraId) return withCorrelationHeaders(event, badRequest("cameraId is required"));
      const camera = await transitCameraRegistryRepo.get(ctx.agencyId, cameraId);
      if (!camera) return withCorrelationHeaders(event, notFound("Camera not found"));
      if (!camera.ptzCapable) {
        return withCorrelationHeaders(event, badRequest("Camera is not PTZ capable"));
      }
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = venueCameraPtzBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequest("Invalid PTZ action"));
      return withCorrelationHeaders(
        event,
        ok({
          accepted: false,
          message: "ONVIF/VMS PTZ control pending — action recorded.",
          action: parsed.data.action,
          vendor: camera.vendor,
        }),
      );
    }

    if (match(event, "GET", /^\/api\/transit\/[^/]+\/cameras\/producer-config\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.manage");
      if ("response" in ctx) return ctx.response;
      const cameras = await listTransitCameras(ctx.agencyId);
      const yaml = buildTransitProducerConfigYaml(ctx.agencyId, cameras);
      const filename = `rc-kvs-producer-transit-${ctx.agencyId.replace(/[^a-zA-Z0-9-]/g, "-")}.yaml`;
      return withCorrelationHeaders(event, {
        statusCode: 200,
        headers: {
          "Content-Type": "application/x-yaml",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
        body: yaml,
      });
    }

    if (match(event, "POST", /^\/api\/transit\/[^/]+\/cameras\/discover\/?$/)) {
      const ctx = await requireTransitRouteContext(event, "transit.cameras.manage");
      if ("response" in ctx) return ctx.response;
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
      const parsed = venueCameraDiscoverBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequest("ip is required"));
      const discovered = await discoverTransitCamera(parsed.data);
      const suggestedCameraId = `cam-${parsed.data.ip.replace(/\./g, "-")}`;
      return withCorrelationHeaders(
        event,
        ok({
          discovered,
          suggestedCameraId,
          suggestedKvsChannelName: venueKvsChannelName(ctx.agencyId, suggestedCameraId),
        }),
      );
    }

    return withCorrelationHeaders(event, notFound());
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404) return withCorrelationHeaders(event, notFound("Camera not found"));
    if (statusCode === 400) {
      return withCorrelationHeaders(
        event,
        badRequest(error instanceof Error ? error.message : "Invalid camera request"),
      );
    }
    console.error("[transit-camera-http]", error);
    return withCorrelationHeaders(
      event,
      error instanceof Error && error.message.includes("ONVIF")
        ? badRequest(error.message)
        : serverError(),
    );
  }
}
