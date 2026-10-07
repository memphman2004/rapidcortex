import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { VideoAssistService } from "../services/videoAssistService.js";

const service = new VideoAssistService();
const authz = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "VIDEO_ASSIST_TABLE_NOT_CONFIGURED")
    return serviceUnavailable("Video assist is not configured");
  if (msg === "SESSION_EXPIRED") return jsonStatus({ error: "session_expired" }, 410);
  if (msg === "SESSION_CANCELED" || msg === "SESSION_ENDED")
    return jsonStatus({ error: "session_closed" }, 409);
  if (msg === "FORBIDDEN_SIGNAL") return forbidden("Invalid signal for this channel");
  if (msg === "TENANT_MISMATCH") return forbidden("Tenant mismatch");
  if (msg === "MISSING_PUBLIC_BASE_URL" || msg === "MISSING_PUBLIC_URL") {
    return badRequest(
      "Caller link base URL is not configured. Set VIDEO_ASSIST_PUBLIC_BASE_URL or pass publicAppBaseUrl.",
    );
  }
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    authz.assertCanPerform(user, "workspace.live_video");
    // INTENTIONAL: defense-in-depth secondary gate. assertCanPerform above is the
    // primary matrix-permission gate; canDispatch + !auditor remains as a belt-and-
    // suspenders backstop in case the matrix is misconfigured for a future role.
    if (!authz.canDispatch(user) || user.role === "auditor") {
      return forbidden("Role cannot use video assist");
    }

    const incidentId = event.pathParameters?.id;
    const sessionId = event.pathParameters?.sessionId;
    if (!incidentId) return notFound("Missing incident id");

    if (routeKey === "POST /api/incidents/{id}/video-assist/sessions") {
      const body = JSON.parse(event.body ?? "{}");
      const out = await service.createSession(incidentId, user, body);
      return ok(out, 201);
    }

    if (!sessionId) return notFound("Missing session id");

    if (routeKey === "GET /api/incidents/{id}/video-assist/sessions/{sessionId}") {
      const s = await service.getDispatcherSession(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "GET /api/incidents/{id}/video-assist/sessions/{sessionId}/events") {
      const s = await service.listEvents(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/video-assist/sessions/{sessionId}/resend") {
      const s = await service.resendSms(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/video-assist/sessions/{sessionId}/cancel") {
      const s = await service.cancelSession(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/video-assist/sessions/{sessionId}/signal") {
      const body = JSON.parse(event.body ?? "{}");
      const s = await service.postDispatcherSignal(incidentId, sessionId, user, body);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/video-assist/sessions/{sessionId}/live") {
      const s = await service.markLiveFromDispatcher(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "GET /api/incidents/{id}/video-assist/sessions") {
      const list = await service.listSessionsBrief(incidentId, user);
      return ok(list);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
