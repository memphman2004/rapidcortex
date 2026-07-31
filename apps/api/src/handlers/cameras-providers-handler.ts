import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { env } from "../lib/env.js";
import { jsonStatus, unauthorized } from "../lib/response.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import {
  nestAccountLinkUrl,
  nestBuildOAuthUrl,
  nestHandleCallback,
  RCError,
} from "../integrations/cameras/nest-oauth.js";
import { nestSdmClient } from "../integrations/cameras/nest-sdm.js";
import {
  createNestConsentRequest,
  getValidNestAccess,
  listAgencyNestCameras,
  listCitizenNestNearIncident,
  loadNestToken,
  resolveNestConsentToken,
} from "../integrations/cameras/nest-camera-service.js";
import {
  incidentCoordinates,
  requireActiveRingIncident,
} from "../integrations/ring/ring-incident.js";

const nestConnectBodySchema = z
  .object({
    projectId: z.string().min(1).max(120),
    clientId: z.string().min(1).max(320),
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

function nestEnabled(): boolean {
  return env.enableConnectNest !== false;
}

function providersTail(rawPath: string): string[] {
  const clean = rawPath.split("?")[0] ?? "";
  const parts = clean.split("/").filter(Boolean);
  const idx = parts.findIndex((p, i) => p === "cameras" && parts[i + 1] === "providers");
  if (idx < 0) return [];
  return parts.slice(idx + 2);
}

function redirect(url: string, statusCode = 302) {
  return {
    statusCode,
    headers: { location: url },
    body: "",
  };
}

function parseRadiusMeters(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  const value = Number.isFinite(parsed) ? parsed : 500;
  return Math.min(2000, Math.max(100, value));
}

const agencyRepo = new AgencyRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
    };
  }

  const tail = providersTail(event.rawPath ?? "");

  // OAuth callback — Google redirect, no JWT
  if (method === "GET" && tail[0] === "nest" && tail[1] === "callback") {
    const code = event.queryStringParameters?.code?.trim() ?? "";
    const state = event.queryStringParameters?.state?.trim() ?? "";
    const linkBase = nestAccountLinkUrl();

    if (!code || !state) {
      return redirect(`${linkBase}?nest=error`);
    }

    try {
      await nestHandleCallback(code, state);
      return redirect(`${linkBase}?nest=connected`);
    } catch (err) {
      console.error("[nest/callback]", err);
      return redirect(`${linkBase}?nest=error`);
    }
  }

  // Public consent links (no JWT) — SMS buttons
  if (method === "GET" && tail[0] === "nest" && tail[1] === "consent" && tail[3]) {
    const plainToken = tail[2] ?? "";
    const decision = tail[3] === "approve" ? "APPROVED" : tail[3] === "decline" ? "DECLINED" : null;
    if (!plainToken || !decision) {
      return jsonStatus({ error: "Invalid consent link" }, 400);
    }
    try {
      const resolved = await resolveNestConsentToken(plainToken, decision);
      if (!resolved) return jsonStatus({ error: "Invalid or expired token" }, 404);
      return jsonStatus({ ok: true, status: decision, ...resolved }, 200);
    } catch (err) {
      console.error("[nest/consent]", err);
      return jsonStatus({ error: "Unable to process consent" }, 500);
    }
  }

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
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = nestConnectBodySchema.safeParse(JSON.parse(bodyRaw));
      if (!parsed.success) {
        return jsonStatus({ error: "projectId and clientId are required" }, 400);
      }

      const { oauthUrl, state } = await nestBuildOAuthUrl(
        user.agencyId,
        parsed.data.projectId.trim(),
        parsed.data.clientId.trim(),
      );

      return jsonStatus({ oauthUrl, state }, 200);
    }

    if (method === "GET" && tail[0] === "nest" && tail[1] === "status") {
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
      const cameras = await listAgencyNestCameras(user.agencyId);
      return jsonStatus({ cameras }, 200);
    }

    if (method === "POST" && tail[0] === "nest" && tail[1] === "stream-token") {
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = streamTokenBodySchema.safeParse(JSON.parse(bodyRaw || "{}"));
      if (!parsed.success) {
        return jsonStatus({ error: "deviceId is required" }, 400);
      }
      if (parsed.data.agencyId && parsed.data.agencyId !== user.agencyId) {
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
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = answerStreamBodySchema.safeParse(JSON.parse(bodyRaw || "{}"));
      if (!parsed.success) {
        return jsonStatus({ error: "deviceId and offerSdp are required" }, 400);
      }
      if (parsed.data.agencyId && parsed.data.agencyId !== user.agencyId) {
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
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = stopStreamBodySchema.safeParse(JSON.parse(bodyRaw || "{}"));
      if (!parsed.success) {
        return jsonStatus({ error: "deviceId and mediaSessionId are required" }, 400);
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
      const incidentResult = await requireActiveRingIncident(incidentId, user);
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
      const bodyRaw =
        event.isBase64Encoded && event.body
          ? Buffer.from(event.body, "base64").toString("utf8")
          : (event.body ?? "{}");
      const parsed = requestAccessBodySchema.safeParse(JSON.parse(bodyRaw || "{}"));
      if (!parsed.success) {
        return jsonStatus({ error: "Invalid request body" }, 400);
      }
      const incidentResult = await requireActiveRingIncident(parsed.data.incidentId, user);
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
      return jsonStatus(
        { requestId: result.requestId, status: result.status },
        result.status === "SENT" ? 201 : 202,
      );
    }

    if (method === "GET" && tail.length === 0) {
      return jsonStatus(
        {
          providers: [{ id: "nest", label: "Google Nest", connectPath: "/api/cameras/providers/nest/connect" }],
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
