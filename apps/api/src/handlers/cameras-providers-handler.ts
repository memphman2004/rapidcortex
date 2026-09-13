import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { canAdminVision, canRequestVisionAccess, canViewVision } from "rapid-cortex-shared";
import type { UserContext } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { makeId } from "../lib/ids.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { consentActionForm, consentPage, escapeHtml } from "../lib/consentPage.js";
import { env } from "../lib/env.js";
import { jsonStatus, unauthorized } from "../lib/response.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import {
  nestAccountLinkUrl,
  nestBuildCitizenOAuthUrl,
  nestBuildOAuthUrl,
  nestHandleCallback,
  RCError,
} from "../integrations/cameras/nest-oauth.js";
import { nestSdmClient } from "../integrations/cameras/nest-sdm.js";
import { deleteNestToken } from "../integrations/cameras/nest-tables.js";
import {
  createNestConsentRequest,
  getValidNestAccess,
  listAgencyNestCameras,
  listCitizenNestNearIncident,
  loadNestToken,
  peekNestConsentRequest,
  resolveNestConsentToken,
} from "../integrations/cameras/nest-camera-service.js";
import { wyzePublicCorsHeaders, wyzePublicJson } from "../integrations/cameras/wyze-public-cors.js";
// RING_REMOVED — incident validation is now provider-agnostic.
// Do NOT re-import from ../integrations/ring/ring-incident here.
import {
  incidentCoordinates,
  requireActiveIncident,
} from "../integrations/incidents/require-active-incident.js";

// ── Request body schemas ──────────────────────────────────────────────────────

const nestConnectBodySchema = z
  .object({
    projectId: z.string().min(1).max(120),
    clientId: z.string().min(1).max(320),
    clientSecret: z.string().min(1).max(500),
  })
  .strict();

const nestCitizenRegisterBodySchema = z
  .object({
    agencyId: z.string().min(1).max(120),
    phone: z.string().min(8).max(20),
    address: z.string().min(3).max(240),
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
    email: z.string().email().max(200).optional(),
  })
  .strict();

const streamTokenBodySchema = z
  .object({
    agencyId: z.string().min(1).max(120).optional(),
    deviceId: z.string().min(1).max(200),
    projectId: z.string().min(1).max(120).optional(),
  })
  .strict();

const answerStreamBodySchema = z
  .object({
    agencyId: z.string().min(1).max(120).optional(),
    deviceId: z.string().min(1).max(200),
    offerSdp: z.string().min(10).max(50_000),
  })
  .strict();

const stopStreamBodySchema = z
  .object({
    agencyId: z.string().min(1).max(120).optional(),
    deviceId: z.string().min(1).max(200),
    mediaSessionId: z.string().min(1).max(500),
  })
  .strict();

const requestAccessBodySchema = z
  .object({
    incidentId: z.string().min(1).max(120),
    deviceId: z.string().min(1).max(200),
    requestedDurationMinutes: z.union([
      z.literal(10),
      z.literal(30),
      z.literal(60),
      z.literal(120),
    ]),
  })
  .strict();

const E164 = /^\+[1-9]\d{7,14}$/;

// ── Utilities ─────────────────────────────────────────────────────────────────

const NEST_AUDIT_EVENT_TYPES = {
  NEST_ACCOUNT_LINKED: "nest.account.linked",
  NEST_ACCOUNT_UNLINKED: "nest.account.unlinked",
  NEST_CITIZEN_REGISTERED: "nest.citizen.registered",
  NEST_CAMERA_REQUEST_CREATED: "nest.camera.request_created",
  NEST_CAMERA_REQUEST_SENT: "nest.camera.request_sent",
  NEST_CAMERA_REQUEST_APPROVED: "nest.camera.request_approved",
  NEST_CAMERA_REQUEST_DECLINED: "nest.camera.request_declined",
} as const;

function nestEnabled(): boolean {
  return env.enableConnectNest !== false;
}

function canLinkNestAgency(user: UserContext): boolean {
  if (canAdminVision(user, user.agencyId)) return true;
  const r = String(user.role);
  return (
    r === "supervisor" ||
    r === "CAMPUS_SUPERVISOR" ||
    r === "VENUE_SUPERVISOR" ||
    r === "TRANSIT_SUPERVISOR"
  );
}

function providersTail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "cameras" && parts[i + 1] === "providers");
  if (idx < 0) return [];
  return parts.slice(idx + 2);
}

function redirect(url: string, statusCode = 302) {
  return { statusCode, headers: { location: url }, body: "" };
}

function html(event: APIGatewayProxyEventV2, body: string, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...wyzePublicCorsHeaders(event),
    },
    body,
  };
}

function parseRadiusMeters(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  const value = Number.isFinite(parsed) ? parsed : 500;
  return Math.min(2000, Math.max(100, value));
}

function parseBody(event: {
  isBase64Encoded?: boolean;
  body?: string | null;
}): string {
  if (event.isBase64Encoded && event.body) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return event.body ?? "{}";
}

function normalizeUsPhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return trimmed.replace(/\s+/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return trimmed;
}

const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const NEST_INVALID_LINK = "This link is no longer valid.";

async function auditNest(params: {
  type: (typeof NEST_AUDIT_EVENT_TYPES)[keyof typeof NEST_AUDIT_EVENT_TYPES];
  agencyId: string;
  actorId: string;
  details: Record<string, unknown>;
  incidentId?: string;
  resourceId?: string;
}): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: params.agencyId,
      actorId: params.actorId,
      incidentId: params.incidentId,
      type: params.type,
      details: params.details,
      createdAt: new Date().toISOString(),
      resourceType: "unknown",
      resourceId: params.resourceId ?? params.actorId,
    });
  } catch (err) {
    console.warn("[nest/audit] write failed", err);
  }
}

async function nestConsentLanding(event: APIGatewayProxyEventV2, plainToken: string) {
  try {
    const request = await peekNestConsentRequest(plainToken);
    if (!request) return html(event, consentPage("Link invalid", NEST_INVALID_LINK), 400);

    if (request.requestStatus !== "SENT" || new Date(request.expiresAt).getTime() <= Date.now()) {
      return html(event, consentPage("Already closed", "This request is no longer active."));
    }

    const minutes = request.requestedDurationMinutes;
    const basePath = `/api/cameras/providers/nest/consent/${encodeURIComponent(plainToken)}`;
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
    console.error("[nest/consent-landing]", err);
    return html(event, consentPage("Something went wrong", "Please try the link again."), 500);
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...wyzePublicCorsHeaders(event),
        "Access-Control-Allow-Origin":
          wyzePublicCorsHeaders(event)["Access-Control-Allow-Origin"] ?? "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
      body: "",
    };
  }

  const tail = providersTail(event.rawPath ?? "");

  // ── Public routes (no JWT) ─────────────────────────────────────────────────

  if (method === "GET" && tail[0] === "nest" && tail[1] === "callback") {
    const code = event.queryStringParameters?.code?.trim() ?? "";
    const state = event.queryStringParameters?.state?.trim() ?? "";
    const fallback = nestAccountLinkUrl();

    if (!code || !state) return redirect(`${fallback}?nest=error`);

    try {
      const result = await nestHandleCallback(code, state);
      const linkBase = result.returnUrl || fallback;
      await auditNest({
        type:
          result.kind === "citizen"
            ? NEST_AUDIT_EVENT_TYPES.NEST_CITIZEN_REGISTERED
            : NEST_AUDIT_EVENT_TYPES.NEST_ACCOUNT_LINKED,
        agencyId: result.agencyId,
        actorId: result.kind === "citizen" ? "system:nest-oauth" : "system:nest-oauth",
        details: { kind: result.kind },
      });
      return redirect(`${linkBase}?nest=connected`);
    } catch (err) {
      console.error("[nest/callback]", err);
      return redirect(`${fallback}?nest=error`);
    }
  }

  if (method === "GET" && tail[0] === "nest" && tail[1] === "c" && tail[2]) {
    return nestConsentLanding(event, tail[2]);
  }

  if (
    (method === "POST" || method === "GET") &&
    tail[0] === "nest" &&
    tail[1] === "consent" &&
    tail[3]
  ) {
    const plainToken = tail[2] ?? "";
    const decision =
      tail[3] === "approve" ? "APPROVED" : tail[3] === "decline" ? "DECLINED" : null;

    if (!plainToken || !decision) {
      return html(event, consentPage("Link invalid", NEST_INVALID_LINK), 400);
    }

    try {
      const resolved = await resolveNestConsentToken(plainToken, decision);
      if (!resolved) return html(event, consentPage("Link invalid", NEST_INVALID_LINK), 404);

      await auditNest({
        type:
          decision === "APPROVED"
            ? NEST_AUDIT_EVENT_TYPES.NEST_CAMERA_REQUEST_APPROVED
            : NEST_AUDIT_EVENT_TYPES.NEST_CAMERA_REQUEST_DECLINED,
        agencyId: resolved.agencyId,
        actorId: "system:nest-consent",
        incidentId: resolved.incidentId,
        details: { decision },
        resourceId: resolved.incidentId,
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
      console.error("[nest/consent]", err);
      return html(event, consentPage("Something went wrong", "Please try the link again."), 500);
    }
  }

  if (method === "POST" && tail[0] === "nest" && tail[1] === "citizen" && tail[2] === "register") {
    if (!nestEnabled()) {
      return wyzePublicJson(event, 403, { error: "Nest camera connect is not enabled" });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(parseBody(event));
    } catch {
      return wyzePublicJson(event, 400, { error: "Invalid JSON body" });
    }
    const parsed = nestCitizenRegisterBodySchema.safeParse(raw);
    if (!parsed.success) {
      return wyzePublicJson(event, 400, { error: "agencyId, phone, address, lat, and lng are required" });
    }
    const phone = normalizeUsPhone(parsed.data.phone);
    if (!E164.test(phone)) {
      return wyzePublicJson(event, 400, { error: "Phone must be E.164 (e.g. +15551234567)" });
    }
    const agency = await agencyRepo.get(parsed.data.agencyId.trim());
    if (!agency) {
      return wyzePublicJson(event, 404, { error: "Unknown agency" });
    }
    try {
      const { oauthUrl, state } = await nestBuildCitizenOAuthUrl({
        agencyId: parsed.data.agencyId.trim(),
        phone,
        address: parsed.data.address.trim(),
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        email: parsed.data.email,
      });
      return wyzePublicJson(event, 200, { oauthUrl, state });
    } catch (err) {
      if (err instanceof RCError) {
        return wyzePublicJson(event, err.statusCode, { error: err.message });
      }
      console.error("[nest/citizen/register]", err);
      return wyzePublicJson(event, 500, { error: "Internal error" });
    }
  }

  // ── Authenticated routes ───────────────────────────────────────────────────

  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

  const pwd = operationalPasswordBlock(user);
  if (pwd) return pwd;

  if (!nestEnabled()) {
    return jsonStatus({ error: "Nest camera connect is not enabled" }, 403);
  }

  try {
    if (method === "POST" && tail[0] === "nest" && tail[1] === "connect") {
      if (!canLinkNestAgency(user)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      const parsed = nestConnectBodySchema.safeParse(JSON.parse(parseBody(event)));
      if (!parsed.success) {
        return jsonStatus({ error: "projectId, clientId, and clientSecret are required" }, 400);
      }
      const { oauthUrl, state } = await nestBuildOAuthUrl(
        user.agencyId,
        parsed.data.projectId.trim(),
        parsed.data.clientId.trim(),
        parsed.data.clientSecret.trim(),
      );
      return jsonStatus({ oauthUrl, state }, 200);
    }

    if (method === "POST" && tail[0] === "nest" && tail[1] === "disconnect") {
      if (!canLinkNestAgency(user)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      await deleteNestToken(user.agencyId);
      await auditNest({
        type: NEST_AUDIT_EVENT_TYPES.NEST_ACCOUNT_UNLINKED,
        agencyId: user.agencyId,
        actorId: user.userId,
        details: {},
      });
      return jsonStatus({ ok: true }, 200);
    }

    if (method === "GET" && tail[0] === "nest" && tail[1] === "status") {
      if (!canViewVision(user, user.agencyId)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      const token = await loadNestToken(user.agencyId);
      return jsonStatus(
        {
          connected: Boolean(token?.accessToken && token.projectId),
          projectId: token?.projectId ?? null,
        },
        200,
      );
    }

    if (method === "GET" && tail[0] === "nest" && tail[1] === "agency-cameras") {
      const agencyIdParam = event.queryStringParameters?.agencyId?.trim();
      if (agencyIdParam && agencyIdParam !== user.agencyId && user.role !== "rcsuperadmin") {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      if (!canViewVision(user, user.agencyId)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      const cameras = await listAgencyNestCameras(user.agencyId);
      return jsonStatus({ cameras }, 200);
    }

    if (method === "POST" && tail[0] === "nest" && tail[1] === "stream-token") {
      const parsed = streamTokenBodySchema.safeParse(JSON.parse(parseBody(event)));
      if (!parsed.success) {
        return jsonStatus({ error: "deviceId is required" }, 400);
      }
      if (parsed.data.agencyId && parsed.data.agencyId !== user.agencyId) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      if (!canRequestVisionAccess(user, user.agencyId)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      const { token } = await getValidNestAccess(user.agencyId);
      return jsonStatus(
        {
          agencyId: user.agencyId,
          deviceId: parsed.data.deviceId,
          projectId: parsed.data.projectId ?? token.projectId,
          streamMode: "webrtc",
          expiresAt: token.expiresAt,
        },
        200,
      );
    }

    if (method === "POST" && tail[0] === "nest" && tail[1] === "answer-stream") {
      const parsed = answerStreamBodySchema.safeParse(JSON.parse(parseBody(event)));
      if (!parsed.success) {
        return jsonStatus({ error: "deviceId and offerSdp are required" }, 400);
      }
      if (parsed.data.agencyId && parsed.data.agencyId !== user.agencyId) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      if (!canRequestVisionAccess(user, user.agencyId)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      const { token, accessToken } = await getValidNestAccess(user.agencyId);
      const result = await nestSdmClient.generateWebRtcStream(
        token.projectId,
        parsed.data.deviceId,
        accessToken,
        parsed.data.offerSdp,
      );
      return jsonStatus(
        {
          answerSdp: result.answerSdp,
          mediaSessionId: result.mediaSessionId,
          streamToken: result.mediaSessionId,
          expiresAt: result.expiresAt,
        },
        200,
      );
    }

    if (method === "POST" && tail[0] === "nest" && tail[1] === "stop-stream") {
      const parsed = stopStreamBodySchema.safeParse(JSON.parse(parseBody(event)));
      if (!parsed.success) {
        return jsonStatus({ error: "deviceId and mediaSessionId are required" }, 400);
      }
      if (!canRequestVisionAccess(user, user.agencyId)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }
      const { token, accessToken } = await getValidNestAccess(user.agencyId);
      await nestSdmClient.stopWebRtcStream(
        token.projectId,
        parsed.data.deviceId,
        parsed.data.mediaSessionId,
        accessToken,
      );
      return jsonStatus({ ok: true }, 200);
    }

    if (method === "GET" && tail[0] === "nest" && tail[1] === "available-cameras") {
      const incidentId = event.queryStringParameters?.incidentId?.trim() ?? "";
      if (!incidentId) return jsonStatus({ error: "incidentId is required" }, 400);
      if (!canRequestVisionAccess(user, user.agencyId)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }

      const incidentResult = await requireActiveIncident(incidentId, user);
      if (!incidentResult.ok) {
        return jsonStatus({ error: incidentResult.message }, incidentResult.statusCode);
      }

      const radiusMeters = parseRadiusMeters(event.queryStringParameters?.radiusMeters);
      const { latitude, longitude } = incidentCoordinates(incidentResult.incident);
      const cameras = await listCitizenNestNearIncident(
        user.agencyId,
        latitude,
        longitude,
        radiusMeters,
        incidentId,
      );
      return jsonStatus({ success: true, data: { incidentId, radiusMeters, cameras } }, 200);
    }

    if (method === "POST" && tail[0] === "nest" && tail[1] === "request-camera-access") {
      const parsed = requestAccessBodySchema.safeParse(JSON.parse(parseBody(event)));
      if (!parsed.success) {
        return jsonStatus({ error: "Invalid request body" }, 400);
      }
      if (!canRequestVisionAccess(user, user.agencyId)) {
        return jsonStatus({ error: "Forbidden" }, 403);
      }

      const incidentResult = await requireActiveIncident(parsed.data.incidentId, user);
      if (!incidentResult.ok) {
        return jsonStatus({ error: incidentResult.message }, incidentResult.statusCode);
      }

      const agency = await agencyRepo.get(user.agencyId);
      const result = await createNestConsentRequest({
        agencyId: user.agencyId,
        incidentId: parsed.data.incidentId,
        deviceId: parsed.data.deviceId,
        requestedDurationMinutes: parsed.data.requestedDurationMinutes,
        agencyName: agency?.name ?? user.agencyId,
      });

      await auditNest({
        type:
          result.status === "SENT"
            ? NEST_AUDIT_EVENT_TYPES.NEST_CAMERA_REQUEST_SENT
            : NEST_AUDIT_EVENT_TYPES.NEST_CAMERA_REQUEST_CREATED,
        agencyId: user.agencyId,
        actorId: user.userId,
        incidentId: parsed.data.incidentId,
        details: { status: result.status, deviceId: parsed.data.deviceId },
        resourceId: result.requestId,
      });

      return jsonStatus(
        { requestId: result.requestId, status: result.status },
        result.status === "SENT" ? 201 : 202,
      );
    }

    if (method === "GET" && tail.length === 0) {
      return jsonStatus(
        {
          providers: [
            {
              id: "nest",
              label: "Google Nest",
              connectPath: "/api/cameras/providers/nest/connect",
            },
          ],
        },
        200,
      );
    }

    return jsonStatus({ error: "Not found" }, 404);
  } catch (err) {
    if (err instanceof RCError) {
      return jsonStatus({ error: err.message }, err.statusCode);
    }
    console.error("[cameras/providers]", err);
    return jsonStatus({ error: "Internal error" }, 500);
  }
};
