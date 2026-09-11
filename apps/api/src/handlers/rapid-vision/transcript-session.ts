/**
 * Rapid Vision™ — live transcript session API.
 *
 * POST /api/vision/sessions/{sessionId}/transcript/start
 * POST /api/vision/sessions/{sessionId}/transcript/stop
 * GET  /api/incidents/{id}/vision/transcript
 *
 * Auth/response match ring-stream-viewer-token.ts:
 *   getUserContext → isUserAccountActive → operationalPasswordBlock
 *   → isRingAuthorizedRole (or Vision canRequest/canView) → ringJson
 *
 * Session keys: pk INCIDENT#{incidentId} / sk SESSION#{sessionId}
 */
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { InvocationType, InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import {
  canRequestVisionAccess,
  canViewVision,
  visionTranscriptQuerySchema,
  visionTranscriptSessionBodySchema,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { isRingAuthorizedRole } from "../../integrations/ring/ring-auth.js";
import { ringJson } from "../../integrations/ring/ring-api-response.js";
import { requireActiveRingIncident } from "../../integrations/ring/ring-incident.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { visionStore } from "../../rapid-vision/store.js";

const auditRepo = new AuditRepository();
const lambda = new LambdaClient({});

type GateOk = { user: UserContext };
type GateErr = { response: ReturnType<typeof ringJson> };

async function gateTranscriptUser(
  event: APIGatewayProxyEventV2,
  mode: "mutate" | "view",
): Promise<GateOk | GateErr> {
  const user = await getUserContext(event);
  if (!user) return { response: ringJson({ success: false, error: "Unauthorized" }, 401) };
  if (!isUserAccountActive(user)) {
    return { response: ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403) };
  }
  const pwd = operationalPasswordBlock(user);
  if (pwd) {
    return {
      response: ringJson({ success: false, error: "Password update is required before continuing." }, 403),
    };
  }
  if (!env.enableRapidVision || !env.enableRapidVisionTranscript) {
    return { response: ringJson({ success: false, error: "Rapid Vision™ transcript is disabled" }, 503) };
  }
  const allowed =
    isRingAuthorizedRole(user) ||
    (mode === "mutate"
      ? canRequestVisionAccess(user, user.agencyId)
      : canViewVision(user, user.agencyId));
  if (!allowed) return { response: ringJson({ success: false, error: "Forbidden" }, 403) };
  return { user };
}

function parseJsonBody(raw: string | undefined): unknown {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sessionIdFromEvent(event: APIGatewayProxyEventV2): string {
  const fromParams = event.pathParameters?.sessionId?.trim() ?? "";
  if (fromParams) return fromParams;
  const path = event.rawPath ?? event.requestContext?.http?.path ?? "";
  const match = path.match(/\/sessions\/([^/]+)\/transcript\//);
  return match?.[1] ? decodeURIComponent(match[1]).trim() : "";
}

function incidentIdFromEvent(event: APIGatewayProxyEventV2): string {
  const fromPath = event.pathParameters?.id?.trim() ?? "";
  const parsed = parseJsonBody(event.body);
  if (parsed === null) return fromPath;
  const fromBody =
    typeof parsed === "object" &&
    parsed !== null &&
    "incidentId" in parsed &&
    typeof (parsed as { incidentId?: unknown }).incidentId === "string"
      ? (parsed as { incidentId: string }).incidentId.trim()
      : "";
  if (fromBody && fromPath && fromBody !== fromPath) return "";
  return fromBody || fromPath;
}

export async function startHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const gated = await gateTranscriptUser(event, "mutate");
    if ("response" in gated) return gated.response;
    const { user } = gated;

    const sessionId = sessionIdFromEvent(event);
    const body = parseJsonBody(event.body);
    if (body === null) {
      return ringJson({ success: false, error: "Invalid JSON body." }, 400);
    }
    const parsedBody = visionTranscriptSessionBodySchema.safeParse(
      typeof body === "object" && body !== null && "incidentId" in body
        ? body
        : { incidentId: event.pathParameters?.id ?? "" },
    );
    if (!parsedBody.success) {
      return ringJson(
        { success: false, error: "sessionId (path) and incidentId (body) are required." },
        400,
      );
    }
    const incidentId = parsedBody.data.incidentId;
    if (!sessionId || !incidentId) {
      return ringJson(
        { success: false, error: "sessionId (path) and incidentId (body) are required." },
        400,
      );
    }

    const incidentResult = await requireActiveRingIncident(incidentId, user);
    if (!incidentResult.ok) {
      return ringJson({ success: false, error: incidentResult.message }, incidentResult.statusCode);
    }

    const session = await visionStore.getSession(incidentId, sessionId, user.agencyId);
    if (!session) return ringJson({ success: false, error: "Session not found." }, 404);
    if (session.agencyId !== user.agencyId) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }
    if (session.status !== "active") {
      return ringJson({ success: false, error: `Session is ${session.status}, not active.` }, 409);
    }
    if (session.transcriptStatus === "active") {
      return ringJson({ success: false, error: "Transcript is already running for this session." }, 409);
    }

    const kvsRef = (session.kvsStreamArn ?? session.kvsChannelName ?? "").trim();
    if (!kvsRef && !env.visionTranscriptMock) {
      return ringJson(
        {
          success: false,
          error:
            "No KVS stream reference on this session. Media storage must be enabled (kvsStreamArn or kvsChannelName required).",
        },
        422,
      );
    }

    if (!env.visionTranscriptWorkerFunction) {
      return ringJson({ success: false, error: "Transcript worker is not configured" }, 503);
    }

    await visionStore.updateTranscriptStatus({
      incidentId,
      sessionId,
      agencyId: user.agencyId,
      status: "active",
      startedBy: user.userId,
    });

    try {
      await lambda.send(
        new InvokeCommand({
          FunctionName: env.visionTranscriptWorkerFunction,
          InvocationType: InvocationType.Event,
          Payload: Buffer.from(
            JSON.stringify({
              sessionId,
              incidentId,
              agencyId: user.agencyId,
              cameraId: session.cameraId,
            }),
          ),
        }),
      );
    } catch (err) {
      await visionStore.updateTranscriptStatus({
        incidentId,
        sessionId,
        agencyId: user.agencyId,
        status: "stopped",
      });
      console.error(JSON.stringify({ msg: "transcript_worker_invoke_failed", error: String(err) }));
      return ringJson({ success: false, error: "Failed to start transcript." }, 500);
    }

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VISION_TRANSCRIPT_STARTED,
        details: { sessionId, cameraId: session.cameraId, mock: env.visionTranscriptMock },
        createdAt: new Date().toISOString(),
        resourceType: "incident",
        resourceId: sessionId,
      });
    } catch {
      /* audit failure is never fatal */
    }

    return ringJson({
      success: true,
      data: {
        sessionId,
        incidentId,
        transcriptStatus: "active",
        message: "Transcript worker starting. Segments will appear within a few seconds.",
      },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "vision_transcript_start_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Failed to start transcript." }, 500);
  }
}

export async function stopHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const gated = await gateTranscriptUser(event, "mutate");
    if ("response" in gated) return gated.response;
    const { user } = gated;

    const sessionId = sessionIdFromEvent(event);
    const body = parseJsonBody(event.body);
    if (body === null) {
      return ringJson({ success: false, error: "Invalid JSON body." }, 400);
    }
    const parsedBody = visionTranscriptSessionBodySchema.safeParse(
      typeof body === "object" && body !== null && "incidentId" in body
        ? body
        : { incidentId: event.pathParameters?.id ?? "" },
    );
    if (!parsedBody.success) {
      return ringJson(
        { success: false, error: "sessionId (path) and incidentId (body) are required." },
        400,
      );
    }
    const incidentId = parsedBody.data.incidentId;
    if (!sessionId || !incidentId) {
      return ringJson(
        { success: false, error: "sessionId (path) and incidentId (body) are required." },
        400,
      );
    }

    const session = await visionStore.getSession(incidentId, sessionId, user.agencyId);
    if (!session) return ringJson({ success: false, error: "Session not found." }, 404);
    if (session.agencyId !== user.agencyId) {
      return ringJson({ success: false, error: "Forbidden" }, 403);
    }

    await visionStore.updateTranscriptStatus({
      incidentId,
      sessionId,
      agencyId: user.agencyId,
      status: "stopped",
    });

    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VISION_TRANSCRIPT_STOPPED,
        details: { sessionId, cameraId: session.cameraId },
        createdAt: new Date().toISOString(),
        resourceType: "incident",
        resourceId: sessionId,
      });
    } catch {
      /* audit failure is never fatal */
    }

    return ringJson({
      success: true,
      data: { sessionId, incidentId, transcriptStatus: "stopped" },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "vision_transcript_stop_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Failed to stop transcript." }, 500);
  }
}

export async function getHandler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  try {
    const gated = await gateTranscriptUser(event, "view");
    if ("response" in gated) return gated.response;
    const { user } = gated;

    const incidentId = event.pathParameters?.id?.trim() ?? incidentIdFromEvent(event);
    if (!incidentId) {
      return ringJson({ success: false, error: "incidentId path parameter required." }, 400);
    }

    const parsed = visionTranscriptQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!parsed.success) {
      return ringJson({ success: false, error: "Invalid transcript query." }, 400);
    }

    const segments = await visionStore.listTranscriptSegments({
      agencyId: user.agencyId,
      incidentId,
      sessionId: parsed.data.sessionId,
      limit: parsed.data.limit ?? 100,
    });

    return ringJson({
      success: true,
      data: {
        incidentId,
        sessionId: parsed.data.sessionId ?? null,
        segments,
        count: segments.length,
      },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "vision_transcript_get_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Failed to load transcript." }, 500);
  }
}

export function withVisionPathParams(
  event: APIGatewayProxyEventV2,
  extra: Record<string, string>,
): APIGatewayProxyEventV2 {
  return {
    ...event,
    pathParameters: { ...(event.pathParameters ?? {}), ...extra },
  };
}
