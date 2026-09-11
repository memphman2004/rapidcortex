import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomBytes, randomUUID } from "node:crypto";
import {
  calculateDistanceMeters,
  canAdminVision,
  canRequestVisionAccess,
  canVerifyVisionObservation,
  canViewVision,
  visionCameraSearchRequestSchema,
  visionRequestAccessBodySchema,
  visionSettingsPatchSchema,
  type VisionAccessState,
  type VisionCamera,
  type VisionCameraSearchResult,
  type VisionSession,
  type UserContext,
} from "rapid-cortex-shared";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  badRequestFromZod,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { requireActiveRingIncident } from "../../integrations/ring/ring-incident.js";
import { visionStore } from "../../rapid-vision/store.js";
import { DemoVisionProvider } from "../../rapid-vision/providers/DemoVisionProvider.js";
import { resolveVisionSessionKvsRef } from "../../rapid-vision/kvs-media-ref.js";
import { getHandler as handleTranscriptGet, startHandler, stopHandler, withVisionPathParams } from "./transcript-session.js";
import { handler as handleVisionViewerToken } from "./vision-viewer-token.js";

const auditRepo = new AuditRepository();
const authz = new AuthorizationService();
const demoProvider = new DemoVisionProvider();

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function pathOf(event: { rawPath?: string; requestContext?: { http?: { path?: string } } }): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

async function gate(
  event: APIGatewayProxyEventV2,
  permission: string,
): Promise<{ user: UserContext } | { response: ReturnType<typeof ok> }> {
  const user = await getUserContext(event);
  if (!user) return { response: unauthorized() };
  if (!isUserAccountActive(user)) return { response: unauthorized(ACCOUNT_INACTIVE_MESSAGE) };
  const blocked = operationalPasswordBlock(user);
  if (blocked) return { response: blocked };
  if (!env.enableRapidVision) return { response: serviceUnavailable("Rapid Vision™ is disabled") };
  if (!authz.canPerform(user, permission)) return { response: forbidden() };
  return { user };
}

function resolveAccessState(
  camera: VisionCamera,
  session?: Pick<VisionSession, "status"> | null,
): VisionAccessState {
  if (camera.connectionStatus === "offline") return "DEVICE_OFFLINE";
  if (camera.provider === "demo") return session?.status === "active" ? "LIVE" : "DEMO";
  if (!session) {
    if (camera.consentPolicy === "ask_every_time") return "CONSENT_REQUIRED";
    if (camera.consentPolicy === "disabled") return "CAPABILITY_NOT_SUPPORTED";
    return "AVAILABLE";
  }
  if (session.status === "pending") return "ACCESS_REQUESTED";
  if (session.status === "active") return "LIVE";
  if (session.status === "expired" || session.status === "revoked") return "ACCESS_EXPIRED";
  if (session.status === "declined") return "OWNER_DECLINED";
  return "AVAILABLE";
}

function seedDemoCameras(agencyId: string, lat: number, lng: number): VisionCamera[] {
  const offsets = [
    [0.0012, 0.0008],
    [-0.0009, 0.0015],
    [0.0004, -0.0011],
  ];
  return ["demo-device-001", "demo-device-002", "demo-device-003"].map((id, idx) => ({
    cameraId: id,
    provider: "demo" as const,
    providerDeviceId: id,
    ownerId: null,
    agencyId,
    friendlyName:
      idx === 0
        ? "Demo — Oak St & 3rd Ave (Doorbell)"
        : idx === 1
          ? "Demo — Main St Parking Camera"
          : "Demo — Corner Store Exterior",
    cameraType: idx === 0 ? ("doorbell" as const) : ("fixed_outdoor" as const),
    latitude: lat + offsets[idx]![0],
    longitude: lng + offsets[idx]![1],
    coverageAreaM: 40,
    isPublic: false,
    isIndoor: false,
    capabilities: ["live_stream" as const],
    consentPolicy: "preauthorized_emergency" as const,
    connectionStatus: idx === 2 ? ("offline" as const) : ("online" as const),
    lastHealthCheck: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method.toUpperCase();
    const rawPath = pathOf(event);
    const incidentMatch = rawPath.match(/\/api\/incidents\/([^/]+)\/vision(?:\/(.*))?$/);
    const visionMatch = rawPath.match(/\/api\/vision(?:\/(.*))?$/);

    if (incidentMatch) {
      const incidentId = decodeURIComponent(incidentMatch[1] ?? "").trim();
      const rest = (incidentMatch[2] ?? "").split("/").filter(Boolean);
      return withCorrelationHeaders(event, await handleIncidentVision(event, method, incidentId, rest));
    }
    if (visionMatch) {
      const rest = (visionMatch[1] ?? "").split("/").filter(Boolean);
      return withCorrelationHeaders(event, await handleVisionRoot(event, method, rest));
    }
    return withCorrelationHeaders(event, notFound());
  } catch (err) {
    console.error(JSON.stringify({ msg: "vision_http_error", error: String(err) }));
    return withCorrelationHeaders(event, serverError("Rapid Vision™ request failed"));
  }
};

async function handleIncidentVision(
  event: APIGatewayProxyEventV2,
  method: string,
  incidentId: string,
  rest: string[],
): Promise<APIGatewayProxyResultV2> {
  if (method === "POST" && rest[0] === "cameras" && rest[1] === "search" && rest.length === 2) {
    const gated = await gate(event, "vision.cameras_view");
    if ("response" in gated) return gated.response;
    const { user } = gated;
    if (!canViewVision(user, user.agencyId)) return forbidden();

    const incidentResult = await requireActiveRingIncident(incidentId, user);
    if (!incidentResult.ok) {
      return ok({ error: incidentResult.message }, incidentResult.statusCode);
    }

    const parsed = visionCameraSearchRequestSchema.safeParse(parseBody(event.body) ?? {});
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const radiusMeters = parsed.data.radiusMeters ?? 500;
    const includeOffline = parsed.data.includeOffline !== false;
    const { callerLocationLat: lat, callerLocationLng: lng } = incidentResult.incident;

    let cameras = await visionStore.listCamerasForAgency(user.agencyId);
    if (env.enableRapidVisionDemo && cameras.length === 0) {
      cameras = seedDemoCameras(user.agencyId, lat, lng);
      await Promise.allSettled(cameras.map((camera) => visionStore.putCamera(camera)));
    }

    const sessions = await visionStore.listSessionsForIncident(user.agencyId, incidentId);
    const sessionByCamera = new Map(sessions.map((s) => [s.cameraId, s]));

    const results: VisionCameraSearchResult[] = cameras
      .map((camera) => ({
        ...camera,
        distanceMeters: Math.round(
          calculateDistanceMeters(lat, lng, camera.latitude, camera.longitude),
        ),
        accessState: resolveAccessState(camera, sessionByCamera.get(camera.cameraId)),
        sessionId: sessionByCamera.get(camera.cameraId)?.sessionId,
        relevanceRank: 0,
      }))
      .filter((c) => c.distanceMeters <= radiusMeters)
      .filter((c) => includeOffline || c.connectionStatus !== "offline")
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .map((c, idx) => ({ ...c, relevanceRank: idx + 1 }));

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VISION_CAMERA_DISCOVERED,
      details: { cameraCount: results.length, radiusMeters },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: incidentId,
    });

    return ok({ success: true, data: { incidentId, radiusMeters, cameras: results } });
  }

  if (
    method === "POST" &&
    rest[0] === "cameras" &&
    rest[2] === "request-access" &&
    rest.length === 3
  ) {
    const gated = await gate(event, "vision.request_access");
    if ("response" in gated) return gated.response;
    const { user } = gated;
    if (!canRequestVisionAccess(user, user.agencyId)) return forbidden();

    const cameraId = decodeURIComponent(rest[1] ?? "").trim();
    const incidentResult = await requireActiveRingIncident(incidentId, user);
    if (!incidentResult.ok) {
      return ok({ error: incidentResult.message }, incidentResult.statusCode);
    }

    const parsed = visionRequestAccessBodySchema.safeParse(parseBody(event.body) ?? {});
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const durationMinutes = parsed.data.durationMinutes ?? 15;

    let camera = await visionStore.getCamera(user.agencyId, cameraId);
    if (!camera && env.enableRapidVisionDemo && cameraId.startsWith("demo-")) {
      const seeded = seedDemoCameras(
        user.agencyId,
        incidentResult.incident.callerLocationLat,
        incidentResult.incident.callerLocationLng,
      ).find((c) => c.cameraId === cameraId);
      camera = seeded ?? null;
    }
    if (!camera) return notFound("Camera not found or not accessible");

    const existing = (await visionStore.listSessionsForIncident(user.agencyId, incidentId)).find(
      (s) => s.cameraId === cameraId && s.status !== "expired" && s.status !== "revoked" && s.status !== "declined",
    );
    if (existing) {
      return conflict("An active access request already exists for this camera on this incident.");
    }

    const sessionId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60_000).toISOString();
    const needsConsent =
      camera.consentPolicy === "ask_every_time" || camera.consentPolicy === "preauthorized_specific_types";

    const kvs = resolveVisionSessionKvsRef(camera);
    const session: VisionSession = {
      sessionId,
      incidentId,
      agencyId: user.agencyId,
      cameraId,
      provider: camera.provider,
      providerSessionId: null,
      kvsChannelName: kvs.kvsChannelName,
      kvsStreamArn: kvs.kvsStreamArn,
      requestedBy: user.userId,
      authorizedBy: needsConsent ? "owner" : camera.provider === "demo" ? "demo" : "agency_policy",
      status: needsConsent ? "pending" : "active",
      aiAnalysisStatus: needsConsent ? "not_started" : "active",
      accessLevel: "live_stream",
      startedAt: now.toISOString(),
      expiresAt,
    };

    await visionStore.putSession({
      ...session,
      ttl: Math.floor(now.getTime() / 1000) + durationMinutes * 60 + 3600,
    });

    if (needsConsent) {
      const token = randomBytes(24).toString("hex");
      await visionStore.putConsentToken({
        token,
        agencyId: user.agencyId,
        incidentId,
        sessionId,
        expiresAt,
      });
      await demoProvider.requestConsent({
        incidentId,
        agencyId: user.agencyId,
        agencyDisplayName: "Agency",
        incidentReason: "Active emergency nearby",
        requestedDurationMinutes: durationMinutes,
        cameraId,
        providerDeviceId: camera.providerDeviceId,
        ownerId: camera.ownerId ?? "demo",
        ownerContactInfo: "",
      });
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VISION_CONSENT_REQUESTED,
        details: { cameraId, sessionId, durationMinutes, provider: camera.provider },
        createdAt: now.toISOString(),
        resourceType: "incident",
        resourceId: sessionId,
      });
      return ok(
        {
          success: true,
          data: {
            sessionId,
            status: "CONSENT_REQUIRED",
            message: "Consent request created. Owner will be notified.",
            expiresAt,
          },
        },
        202,
      );
    }

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VISION_SESSION_STARTED,
      details: { cameraId, sessionId, durationMinutes, provider: camera.provider },
      createdAt: now.toISOString(),
      resourceType: "incident",
      resourceId: sessionId,
    });
    return ok({
      success: true,
      data: {
        sessionId,
        status: "AUTHORIZED",
        message: "Session opened. AI analysis starting.",
        expiresAt,
      },
    });
  }

  if (method === "GET" && rest[0] === "intelligence" && rest.length === 1) {
    const gated = await gate(event, "vision.observations_view");
    if ("response" in gated) return gated.response;
    const { user } = gated;
    if (!canViewVision(user, user.agencyId)) return forbidden();

    const incidentResult = await requireActiveRingIncident(incidentId, user);
    if (!incidentResult.ok) {
      return ok({ error: incidentResult.message }, incidentResult.statusCode);
    }

    const [sessions, observations] = await Promise.all([
      visionStore.listSessionsForIncident(user.agencyId, incidentId),
      visionStore.listObservations(user.agencyId, incidentId, 100),
    ]);
    const activeSessions = sessions.filter((s) => s.status === "active" || s.status === "pending");
    return ok({
      success: true,
      data: {
        incidentId,
        agencyId: user.agencyId,
        activeSessions,
        observations,
        unverifiedCount: observations.filter((o) => o.verificationStatus === "unverified").length,
        verifiedCount: observations.filter((o) => o.verificationStatus === "verified").length,
        discoveredCameras: [],
        lastUpdated: new Date().toISOString(),
      },
    });
  }

  if (method === "GET" && rest[0] === "observations" && rest.length === 1) {
    const gated = await gate(event, "vision.observations_view");
    if ("response" in gated) return gated.response;
    const { user } = gated;
    if (!canViewVision(user, user.agencyId)) return forbidden();
    const observations = await visionStore.listObservations(user.agencyId, incidentId, 100);
    return ok({ success: true, data: { observations } });
  }

  if (method === "GET" && rest[0] === "transcript" && rest.length === 1) {
    return handleTranscriptGet(withVisionPathParams(event, { id: incidentId }));
  }

  if (
    method === "POST" &&
    rest[0] === "sessions" &&
    rest[2] === "transcript" &&
    rest.length === 4 &&
    (rest[3] === "start" || rest[3] === "stop")
  ) {
    const sessionId = decodeURIComponent(rest[1] ?? "").trim();
    if (!sessionId) return badRequest("sessionId required");
    const routed = withVisionPathParams(event, { sessionId, id: incidentId });
    if (rest[3] === "start") return startHandler(routed);
    return stopHandler(routed);
  }

  return notFound();
}

async function handleVisionRoot(
  event: APIGatewayProxyEventV2,
  method: string,
  rest: string[],
): Promise<APIGatewayProxyResultV2> {
  if (method === "GET" && rest[0] === "sessions" && rest[2] === "viewer-token" && rest.length === 3) {
    const sessionId = decodeURIComponent(rest[1] ?? "").trim();
    if (!sessionId) return badRequest("sessionId required");
    return handleVisionViewerToken(withVisionPathParams(event, { sessionId }));
  }

  if (
    method === "POST" &&
    rest[0] === "sessions" &&
    rest[2] === "transcript" &&
    rest.length === 4 &&
    (rest[3] === "start" || rest[3] === "stop")
  ) {
    const sessionId = decodeURIComponent(rest[1] ?? "").trim();
    if (!sessionId) return badRequest("sessionId required");
    const routed = withVisionPathParams(event, { sessionId });
    if (rest[3] === "start") return startHandler(routed);
    return stopHandler(routed);
  }

  if (rest[0] === "observations" && rest.length === 3) {
    const observationId = decodeURIComponent(rest[1] ?? "");
    const action = rest[2];
    if (method !== "POST") return notFound();
    if (action !== "verify" && action !== "reject" && action !== "add-to-incident") return notFound();

    const gated = await gate(event, "vision.observations_verify");
    if ("response" in gated) return gated.response;
    const { user } = gated;
    if (!canVerifyVisionObservation(user, user.agencyId)) return forbidden();

    const incidentId = String(
      (parseBody(event.body) as { incidentId?: string } | null)?.incidentId ??
        event.queryStringParameters?.incidentId ??
        "",
    ).trim();
    if (!incidentId) return badRequest("incidentId required");

    const observations = await visionStore.listObservations(user.agencyId, incidentId, 200);
    const obs = observations.find((o) => o.observationId === observationId);
    if (!obs) return notFound("Observation not found");

    if (action === "add-to-incident") {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VISION_OBSERVATION_SHARED,
        details: { observationId },
        createdAt: new Date().toISOString(),
        resourceType: "incident",
        resourceId: observationId,
      });
      return ok({ success: true });
    }

    const status = action === "verify" ? "verified" : "rejected";
    await visionStore.updateObservationStatus({
      agencyId: user.agencyId,
      incidentId,
      timestamp: obs.timestamp,
      observationId,
      status,
      userId: user.userId,
    });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type:
        status === "verified"
          ? AUDIT_EVENT_TYPES.VISION_OBSERVATION_VERIFIED
          : AUDIT_EVENT_TYPES.VISION_OBSERVATION_REJECTED,
      details: { observationId },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: observationId,
    });
    return ok({ success: true, data: { observationId, status } });
  }

  if (rest[0] === "settings" && rest.length === 1) {
    const gated = await gate(event, "vision.admin");
    if ("response" in gated) return gated.response;
    const { user } = gated;
    if (!canAdminVision(user, user.agencyId)) return forbidden();
    if (method === "GET") {
      const settings = await visionStore.getSettings(user.agencyId);
      return ok({ success: true, data: settings });
    }
    if (method === "PATCH") {
      const parsed = visionSettingsPatchSchema.safeParse(parseBody(event.body) ?? {});
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const current = await visionStore.getSettings(user.agencyId);
      const next = {
        ...current,
        ...parsed.data,
        agencyId: user.agencyId,
        updatedAt: new Date().toISOString(),
        updatedBy: user.userId,
      };
      await visionStore.putSettings(next);
      return ok({ success: true, data: next });
    }
  }

  return notFound();
}
