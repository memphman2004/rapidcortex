/**
 * Wyze homeowner camera integration — API Gateway Lambda handler.
 *
 * Public (Auth NONE):
 *   POST /api/cameras/providers/wyze/register
 *   GET  /api/cameras/providers/wyze/c/{token}
 *   POST /api/cameras/providers/wyze/consent/{token}/approve|decline
 *
 * Authenticated:
 *   GET  /api/cameras/providers/wyze/status
 *   GET  /api/cameras/providers/wyze/available-cameras
 *   POST /api/cameras/providers/wyze/request-camera-access
 *   POST /api/cameras/providers/wyze/answer-stream
 *
 * @module handlers/cameras-providers-wyze
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  canRequestVisionAccess,
  wyzeAnswerStreamBodySchema,
  wyzeRegisterBodySchema,
  wyzeRequestCameraAccessBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../lib/auth.js";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { consentActionForm, consentPage, escapeHtml } from "../lib/consentPage.js";
import { forbidden, jsonStatus, unauthorized } from "../lib/response.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import {
  incidentCoordinates,
  requireActiveIncident,
} from "../integrations/incidents/require-active-incident.js";
import { wyzeApiClient } from "../integrations/cameras/wyze-api.js";
import { wyzePublicCorsHeaders, wyzePublicJson } from "../integrations/cameras/wyze-public-cors.js";
import {
  createWyzeConsentRequest,
  getApprovedWyzeStreamContext,
  listWyzeCamerasNearIncident,
  peekWyzeConsentRequest,
  registerWyzeHomeowner,
  resolveWyzeConsentToken,
} from "../integrations/cameras/wyze-camera-service.js";

const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const INVALID_LINK = "This link is no longer valid.";

function wyzeEnabled(): boolean {
  return env.enableConnectWyze !== false;
}

function tail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "cameras" && parts[i + 1] === "providers");
  if (idx < 0) return [];
  return parts.slice(idx + 2);
}

function parseBody(event: { isBase64Encoded?: boolean; body?: string | null }): string {
  if (event.isBase64Encoded && event.body) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return event.body ?? "{}";
}

function parseRadiusMeters(raw: string | undefined): number {
  const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Math.min(2000, Math.max(100, Number.isFinite(n) ? n : 500));
}

function html(event: Parameters<typeof wyzePublicCorsHeaders>[0], body: string, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...wyzePublicCorsHeaders(event),
    },
    body,
  };
}

async function auditWyze(params: {
  type: (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES];
  agencyId: string;
  actorId: string;
  details: Record<string, unknown>;
  resourceId?: string;
}): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: params.agencyId,
      actorId: params.actorId,
      type: params.type,
      details: params.details,
      createdAt: new Date().toISOString(),
      resourceType: "unknown",
      resourceId: params.resourceId ?? params.actorId,
    });
  } catch (err) {
    console.warn("[wyze/audit] write failed", err);
  }
}

async function renderConsentLanding(
  event: Parameters<typeof wyzePublicCorsHeaders>[0],
  plainToken: string,
) {
  try {
    const request = await peekWyzeConsentRequest(plainToken);
    if (!request) return html(event, consentPage("Link invalid", INVALID_LINK), 400);

    if (
      request.requestStatus !== "SENT" ||
      new Date(request.expiresAt).getTime() <= Date.now()
    ) {
      return html(event, consentPage("Already closed", "This request is no longer active."));
    }

    const minutes = request.requestedDurationMinutes;
    const basePath = `/api/cameras/providers/wyze/consent/${encodeURIComponent(plainToken)}`;
    const actions =
      `<div class="actions">` +
      consentActionForm({
        actionPath: `${basePath}/approve`,
        label: `Allow for ${minutes} minutes`,
        variant: "allow",
      }) +
      consentActionForm({
        actionPath: `${basePath}/decline`,
        label: "Decline",
        variant: "decline",
      }) +
      `</div><p class="fine">Sharing stops automatically after ${minutes} minutes.</p>`;

    return html(
      event,
      consentPage(
        "Emergency video request",
        `Emergency responders are requesting temporary live video from ` +
          `${escapeHtml(request.deviceName)} for an active emergency near your address.`,
        actions,
      ),
    );
  } catch (err) {
    console.error("[wyze/consent-landing]", err);
    return html(event, consentPage("Something went wrong", "Please try the link again."), 500);
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  const segments = tail(event.rawPath ?? "");

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: wyzePublicCorsHeaders(event),
    };
  }

  if (!wyzeEnabled()) {
    if (segments[1] === "register" || segments[1] === "c" || segments[1] === "consent") {
      return wyzePublicJson(event, 503, { error: "Wyze Connect is not enabled." });
    }
    return jsonStatus({ error: "Wyze Connect is not enabled." }, 503);
  }

  if (method === "POST" && segments[0] === "wyze" && segments[1] === "register") {
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(parseBody(event));
    } catch {
      return wyzePublicJson(event, 400, { error: "Invalid JSON body." });
    }
    const parsed = wyzeRegisterBodySchema.safeParse(parsedBody);
    if (!parsed.success) {
      return wyzePublicJson(event, 400, { error: "Invalid registration data" });
    }

    try {
      const agency = await agencyRepo.get(parsed.data.agencyId);
      if (!agency) {
        return wyzePublicJson(event, 400, { error: "Unknown agency." });
      }

      const creds = { keyId: parsed.data.keyId, apiKey: parsed.data.apiKey };
      await wyzeApiClient.validateCredentials(creds);

      const result = await registerWyzeHomeowner(parsed.data);
      await auditWyze({
        type: AUDIT_EVENT_TYPES.WYZE_HOMEOWNER_REGISTERED,
        agencyId: parsed.data.agencyId,
        actorId: `wyze-owner:${result.ownerId}`,
        details: { camerasFound: result.camerasFound },
        resourceId: result.ownerId,
      });
      return wyzePublicJson(
        event,
        201,
        {
          success: true,
          ownerId: result.ownerId,
          camerasFound: result.camerasFound,
          message:
            result.camerasFound === 0
              ? "Registered successfully. No cameras found on your Wyze account yet — add cameras in the Wyze app and re-register to include them."
              : `Registered successfully with ${result.camerasFound} camera${result.camerasFound === 1 ? "" : "s"}.`,
        },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      if (msg.toLowerCase().includes("auth") || msg.includes("401") || msg.includes("403")) {
        return wyzePublicJson(event, 401, {
          error: "Invalid Wyze credentials. Check your Key ID and API Key.",
        });
      }
      console.error("[wyze/register]", err);
      return wyzePublicJson(event, 500, { error: "Registration failed. Please try again." });
    }
  }

  if (method === "GET" && segments[0] === "wyze" && segments[1] === "c" && segments[2]) {
    return renderConsentLanding(event, segments[2]);
  }

  if (
    method === "POST" &&
    segments[0] === "wyze" &&
    segments[1] === "consent" &&
    segments[3]
  ) {
    const plainToken = segments[2] ?? "";
    const decision =
      segments[3] === "approve" ? "APPROVED" : segments[3] === "decline" ? "DECLINED" : null;

    if (!plainToken || !decision) {
      return html(event, consentPage("Link invalid", INVALID_LINK), 400);
    }

    try {
      const resolved = await resolveWyzeConsentToken(plainToken, decision);
      if (!resolved) return html(event, consentPage("Link invalid", INVALID_LINK), 404);

      await auditWyze({
        type:
          decision === "APPROVED"
            ? AUDIT_EVENT_TYPES.WYZE_CAMERA_REQUEST_APPROVED
            : AUDIT_EVENT_TYPES.WYZE_CAMERA_REQUEST_DECLINED,
        agencyId: resolved.agencyId,
        actorId: "wyze-owner",
        details: { requestId: resolved.requestId, mac: resolved.mac },
        resourceId: resolved.requestId,
      });

      return html(
        event,
        consentPage(
          decision === "APPROVED" ? "Sharing approved" : "Request declined",
          decision === "APPROVED"
            ? "Thank you. Emergency responders can now view your camera for the requested time. Sharing ends automatically when the time is up."
            : "You have declined the request. No video will be shared.",
        ),
      );
    } catch (err) {
      console.error("[wyze/consent]", err);
      return html(event, consentPage("Something went wrong", "Please try the link again."), 500);
    }
  }

  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

  const pwd = operationalPasswordBlock(user);
  if (pwd) return pwd;

  if (!canRequestVisionAccess(user, user.agencyId)) {
    return forbidden("Forbidden");
  }

  try {
    if (method === "GET" && segments[0] === "wyze" && segments[1] === "status") {
      return jsonStatus({ enabled: true, provider: "wyze" }, 200);
    }

    if (method === "GET" && segments[0] === "wyze" && segments[1] === "available-cameras") {
      const incidentId = event.queryStringParameters?.incidentId?.trim() ?? "";
      if (!incidentId) return jsonStatus({ error: "incidentId is required" }, 400);

      const incidentResult = await requireActiveIncident(incidentId, user);
      if (!incidentResult.ok) {
        return jsonStatus({ error: incidentResult.message }, incidentResult.statusCode);
      }

      const radiusMeters = parseRadiusMeters(event.queryStringParameters?.radiusMeters);
      const { latitude, longitude } = incidentCoordinates(incidentResult.incident);
      const cameras = await listWyzeCamerasNearIncident(
        user.agencyId,
        latitude,
        longitude,
        radiusMeters,
        incidentId,
      );

      return jsonStatus({ success: true, data: { incidentId, radiusMeters, cameras } }, 200);
    }

    if (method === "POST" && segments[0] === "wyze" && segments[1] === "request-camera-access") {
      const parsed = wyzeRequestCameraAccessBodySchema.safeParse(JSON.parse(parseBody(event)));
      if (!parsed.success) {
        return jsonStatus({ error: "Invalid request body" }, 400);
      }

      const incidentResult = await requireActiveIncident(parsed.data.incidentId, user);
      if (!incidentResult.ok) {
        return jsonStatus({ error: incidentResult.message }, incidentResult.statusCode);
      }

      const agency = await agencyRepo.get(user.agencyId);
      const result = await createWyzeConsentRequest({
        agencyId: user.agencyId,
        incidentId: parsed.data.incidentId,
        mac: parsed.data.mac,
        requestedDurationMinutes: parsed.data.requestedDurationMinutes,
        agencyName: agency?.name ?? user.agencyId,
      });

      await auditWyze({
        type:
          result.status === "SENT"
            ? AUDIT_EVENT_TYPES.WYZE_CAMERA_REQUEST_SENT
            : AUDIT_EVENT_TYPES.WYZE_CAMERA_REQUEST_CREATED,
        agencyId: user.agencyId,
        actorId: user.userId,
        details: { requestId: result.requestId, mac: parsed.data.mac, status: result.status },
        resourceId: result.requestId,
      });

      return jsonStatus(
        { requestId: result.requestId, status: result.status },
        result.status === "SENT" ? 201 : 202,
      );
    }

    if (method === "POST" && segments[0] === "wyze" && segments[1] === "answer-stream") {
      const parsed = wyzeAnswerStreamBodySchema.safeParse(JSON.parse(parseBody(event)));
      if (!parsed.success) {
        return jsonStatus({ error: "incidentId and mac are required" }, 400);
      }

      const incidentResult = await requireActiveIncident(parsed.data.incidentId, user);
      if (!incidentResult.ok) {
        return jsonStatus({ error: incidentResult.message }, incidentResult.statusCode);
      }

      const ctx = await getApprovedWyzeStreamContext(
        user.agencyId,
        parsed.data.incidentId,
        parsed.data.mac,
      );
      if (!ctx) {
        return jsonStatus(
          { error: "No approved live-share for this camera. Owner consent may be pending or expired." },
          403,
        );
      }

      const streamInfo = await wyzeApiClient.getStreamInfo(
        parsed.data.mac,
        ctx.camera.model,
        ctx.creds,
      );

      await auditWyze({
        type: AUDIT_EVENT_TYPES.WYZE_CAMERA_SESSION_STARTED,
        agencyId: user.agencyId,
        actorId: user.userId,
        details: { mac: parsed.data.mac, incidentId: parsed.data.incidentId },
        resourceId: parsed.data.mac,
      });

      return jsonStatus(
        {
          signalingUrl: streamInfo.signalingUrl,
          iceServers: streamInfo.iceServers,
          authToken: streamInfo.authToken,
          clientId: streamInfo.clientId,
          streamMode: "webrtc-kvs",
          expiresAt: streamInfo.expiresAt,
        },
        200,
      );
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 409) {
      return jsonStatus({ error: err instanceof Error ? err.message : "Conflict" }, 409);
    }
    console.error("[cameras/providers/wyze]", err);
    return jsonStatus({ error: "Internal error" }, 500);
  }
};
