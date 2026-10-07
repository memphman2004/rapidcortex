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
import { SilentTextService } from "../services/silentTextService.js";

const service = new SilentTextService();
const authz = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "SILENT_TEXT_TABLE_NOT_CONFIGURED")
    return serviceUnavailable("Silent text is not configured");
  if (msg === "SESSION_EXPIRED") return jsonStatus({ error: "session_expired" }, 410);
  if (msg === "SESSION_CANCELED" || msg === "SESSION_ENDED")
    return jsonStatus({ error: "session_closed" }, 409);
  if (msg === "TENANT_MISMATCH") return forbidden("Tenant mismatch");
  if (msg === "MISSING_PUBLIC_BASE_URL" || msg === "MISSING_PUBLIC_URL") {
    return badRequest(
      "Public app URL is not configured. Set SILENT_TEXT_PUBLIC_BASE_URL or pass publicAppBaseUrl.",
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
    authz.assertCanPerform(user, "workspace.caller_media");
    // INTENTIONAL: defense-in-depth secondary gate. assertCanPerform above is the
    // primary matrix-permission gate; canDispatch + !auditor remains as a belt-and-
    // suspenders backstop in case the matrix is misconfigured for a future role.
    if (!authz.canDispatch(user) || user.role === "auditor") {
      return forbidden("Role cannot use silent text");
    }

    const incidentId = event.pathParameters?.id;
    const sessionId = event.pathParameters?.sessionId;
    if (!incidentId) return notFound("Missing incident id");

    if (routeKey === "POST /api/incidents/{id}/silent-text/sessions") {
      const body = JSON.parse(event.body ?? "{}");
      const out = await service.createSession(incidentId, user, body);
      return ok(out, 201);
    }

    if (!sessionId) return notFound("Missing session id");

    if (routeKey === "GET /api/incidents/{id}/silent-text/sessions/{sessionId}") {
      const s = await service.getDispatcherSession(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "GET /api/incidents/{id}/silent-text/sessions/{sessionId}/events") {
      const s = await service.listEvents(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "GET /api/incidents/{id}/silent-text/sessions/{sessionId}/messages") {
      const s = await service.listMessages(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/silent-text/sessions/{sessionId}/resend") {
      const s = await service.resendSms(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/silent-text/sessions/{sessionId}/cancel") {
      const s = await service.cancelSession(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/silent-text/sessions/{sessionId}/close") {
      const s = await service.closeSession(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/silent-text/sessions/{sessionId}/message") {
      const body = JSON.parse(event.body ?? "{}");
      const s = await service.postDispatcherMessage(incidentId, sessionId, user, body);
      return ok(s);
    }

    if (routeKey === "POST /api/incidents/{id}/silent-text/sessions/{sessionId}/high-risk") {
      const s = await service.markHighRisk(incidentId, sessionId, user);
      return ok(s);
    }

    if (routeKey === "GET /api/incidents/{id}/silent-text/sessions") {
      const list = await service.listSessionsBrief(incidentId, user);
      return ok(list);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
