import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  venueCameraDiscoverBodySchema,
  venueCameraUpsertBodySchema,
  venueCameraViewerTokenQuerySchema,
  venueCameraPtzBodySchema,
  venueKvsChannelName,
} from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { KvsChannelService } from "../../shared/kvs-channel-service.js";
import {
  canSupervisorVenueOps,
  requireAgencyRoute,
} from "../vertical/agency-route-context.js";
import {
  buildProducerConfigYaml,
  createVenueCamera,
  deleteVenueCamera,
  discoverVenueCamera,
  listVenueCameras,
  recordProducerAgentHeartbeat,
  updateVenueCamera,
} from "./venue-camera-registry-service.js";
import { VenueCameraRegistryRepository } from "../../repositories/venueCameraRegistryRepository.js";

const kvs = new KvsChannelService();
const repo = new VenueCameraRegistryRepository();

function parseBody(event: { body?: string | null }): unknown {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

function requireSupervisorOrAgencyIt(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  user: { role: string },
) {
  if (!canSupervisorVenueOps(user as never)) {
    return withCorrelationHeaders(event, forbidden());
  }
  return null;
}

function producerKeyAuthorized(event: Parameters<APIGatewayProxyHandlerV2>[0]): boolean {
  const expected = process.env.VENUE_CAMERA_PRODUCER_KEY?.trim();
  if (!expected) return false;
  const provided =
    event.headers?.["x-rc-producer-key"]?.trim() ||
    event.headers?.["X-RC-Producer-Key"]?.trim();
  return Boolean(provided && provided === expected);
}

/** GET/POST /api/venue/{agencyId}/cameras/registry */
export const listOrCreate: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "venue.dashboard.view");
    if ("response" in ctx) return ctx.response;

    if (event.requestContext.http.method === "GET") {
      const cameras = await listVenueCameras(ctx.agencyId);
      return withCorrelationHeaders(event, ok({ cameras }));
    }

    const denied = requireSupervisorOrAgencyIt(event, ctx.user);
    if (denied) return denied;

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    const parsed = venueCameraUpsertBodySchema.safeParse(body);
    if (!parsed.success) return withCorrelationHeaders(event, badRequest("Invalid camera body"));

    const camera = await createVenueCamera(ctx.agencyId, ctx.user.userId, parsed.data);
    return withCorrelationHeaders(event, ok({ camera }));
  } catch (error) {
    console.error("[venue-camera-registry-listOrCreate]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

/** PUT/DELETE /api/venue/{agencyId}/cameras/registry/{cameraId} */
export const updateOrDelete: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "venue.dashboard.view");
    if ("response" in ctx) return ctx.response;

    const denied = requireSupervisorOrAgencyIt(event, ctx.user);
    if (denied) return denied;

    const cameraId = event.pathParameters?.cameraId?.trim();
    if (!cameraId) return withCorrelationHeaders(event, badRequest("cameraId is required"));

    if (event.requestContext.http.method === "DELETE") {
      await deleteVenueCamera(ctx.agencyId, cameraId, ctx.user.userId);
      return withCorrelationHeaders(event, ok({ deleted: true }));
    }

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    const parsed = venueCameraUpsertBodySchema.safeParse(body);
    if (!parsed.success) return withCorrelationHeaders(event, badRequest("Invalid camera body"));

    const camera = await updateVenueCamera(ctx.agencyId, cameraId, ctx.user.userId, parsed.data);
    return withCorrelationHeaders(event, ok({ camera }));
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404) {
      return withCorrelationHeaders(event, notFound("Camera not found"));
    }
    console.error("[venue-camera-registry-updateOrDelete]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

/** GET /api/venue/{agencyId}/cameras/viewer-token?kvsChannelName=... */
export const viewerToken: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "venue.dashboard.view");
    if ("response" in ctx) return ctx.response;

    const parsed = venueCameraViewerTokenQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest("kvsChannelName is required"));
    }

    const cameras = await repo.listByAgency(ctx.agencyId);
    const match = cameras.find((c) => c.kvsChannelName === parsed.data.kvsChannelName.trim());
    if (!match) return withCorrelationHeaders(event, forbidden("Camera not registered for agency"));

    const token = await kvs.issueViewerToken(match.kvsChannelName);
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
  } catch (error) {
    console.error("[venue-camera-viewer-token]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

/** POST /api/venue/{agencyId}/cameras/{cameraId}/ptz */
export const ptz: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "venue.dashboard.view");
    if ("response" in ctx) return ctx.response;
    if (!canSupervisorVenueOps(ctx.user)) {
      return withCorrelationHeaders(event, forbidden());
    }

    const cameraId = event.pathParameters?.cameraId?.trim();
    if (!cameraId) return withCorrelationHeaders(event, badRequest("cameraId is required"));

    const camera = await repo.get(ctx.agencyId, cameraId);
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
  } catch (error) {
    console.error("[venue-camera-ptz]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

/** GET /api/venue/{agencyId}/cameras/producer-config */
export const producerConfig: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "venue.dashboard.view");
    if ("response" in ctx) return ctx.response;

    const denied = requireSupervisorOrAgencyIt(event, ctx.user);
    if (denied) return denied;

    const cameras = await listVenueCameras(ctx.agencyId);
    const yaml = buildProducerConfigYaml(ctx.agencyId, cameras);
    const filename = `rc-kvs-producer-${ctx.agencyId.replace(/[^a-zA-Z0-9-]/g, "-")}.yaml`;

    return withCorrelationHeaders(event, {
      statusCode: 200,
      headers: {
        "Content-Type": "application/x-yaml",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: yaml,
    });
  } catch (error) {
    console.error("[venue-camera-producer-config]", error);
    return withCorrelationHeaders(event, serverError());
  }
};

/** POST /api/venue/{agencyId}/cameras/discover */
export const discover: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ctx = await requireAgencyRoute(event, "venue.dashboard.view");
    if ("response" in ctx) return ctx.response;

    const denied = requireSupervisorOrAgencyIt(event, ctx.user);
    if (denied) return denied;

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON body"));
    const parsed = venueCameraDiscoverBodySchema.safeParse(body);
    if (!parsed.success) return withCorrelationHeaders(event, badRequest("ip is required"));

    const discovered = await discoverVenueCamera(parsed.data);
    const suggestedCameraId = `cam-${parsed.data.ip.replace(/\./g, "-")}`;
    return withCorrelationHeaders(
      event,
      ok({
        discovered,
        suggestedCameraId,
        suggestedKvsChannelName: venueKvsChannelName(ctx.agencyId, suggestedCameraId),
      }),
    );
  } catch (error) {
    console.error("[venue-camera-discover]", error);
    return withCorrelationHeaders(
      event,
      badRequest(error instanceof Error ? error.message : "ONVIF discovery failed"),
    );
  }
};

/** POST /api/venue/{agencyId}/cameras/{cameraId}/heartbeat — on-site KVS producer agent */
export const agentHeartbeat: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!producerKeyAuthorized(event)) {
      return withCorrelationHeaders(event, unauthorized("Invalid producer key"));
    }

    const agencyId = event.pathParameters?.agencyId?.trim();
    const cameraId = event.pathParameters?.cameraId?.trim();
    if (!agencyId || !cameraId) {
      return withCorrelationHeaders(event, badRequest("agencyId and cameraId are required"));
    }

    const camera = await recordProducerAgentHeartbeat(agencyId, cameraId);
    return withCorrelationHeaders(event, ok({ cameraId: camera.cameraId, status: camera.status }));
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404) return withCorrelationHeaders(event, notFound("Camera not found"));
    console.error("[venue-camera-agent-heartbeat]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
