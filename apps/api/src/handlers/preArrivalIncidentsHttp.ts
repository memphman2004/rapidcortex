import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { env } from "../lib/env.js";
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
import { listDispatcherChannel, postDispatcherReply } from "../pre-arrival/caller-channel-service.js";
import { preArrivalService } from "../pre-arrival/preArrivalService.js";
import { processEtaEvent } from "../pre-arrival/eta/eta-notification-handler.js";
import { dispatcherEtaUpdateSchema } from "rapid-cortex-shared";

const authz = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "PRE_ARRIVAL_RESTRICTED") {
    return forbidden("Pre-Arrival is not available for this incident type.");
  }
  if (msg === "FORBIDDEN_PERMISSION" || statusCode === 403) return forbidden();
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND" || statusCode === 404) return notFound();
  if (msg === "PRE_ARRIVAL_DISABLED") return serviceUnavailable("Pre-Arrival iQ is not enabled");
  if (msg === "PRE_ARRIVAL_TABLE_NOT_CONFIGURED")
    return serviceUnavailable("Pre-Arrival iQ is not configured");
  if (msg === "TENANT_MISMATCH") return forbidden("Tenant mismatch");
  if (msg === "PRE_ARRIVAL_REASON_REQUIRED") {
    return badRequest("Choose a call reason before sending Pre-Arrival guidance.");
  }
  if (msg === "MISSING_PUBLIC_BASE_URL") {
    return badRequest(
      "Public app URL is not configured. Set PRE_ARRIVAL_PUBLIC_BASE_URL or pass publicAppBaseUrl.",
    );
  }
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enablePreArrivalIq) return serviceUnavailable("Pre-Arrival iQ is not enabled");

    const routeKey = event.routeKey ?? "";

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    authz.assertCanPerform(user, "workspace.caller_media");
    if (!authz.canDispatch(user) || user.role === "auditor") {
      return forbidden("Role cannot use Pre-Arrival iQ");
    }

    const incidentId = event.pathParameters?.id;
    const sessionToken = event.pathParameters?.sessionToken;
    if (!incidentId) return notFound("Missing incident id");

    if (routeKey === "POST /api/incidents/{id}/pre-arrival/eta") {
      const parsed = dispatcherEtaUpdateSchema.safeParse({
        ...JSON.parse(event.body ?? "{}"),
        dispatcherId: user.userId,
      });
      if (!parsed.success) return badRequest(parsed.error.message);
      const result = await processEtaEvent({
        incidentId,
        agencyId: user.agencyId,
        etaMinutes: parsed.data.etaMinutes,
        trigger: "dispatcher_manual",
      });
      return ok(result);
    }

    if (routeKey === "GET /api/incidents/{id}/pre-arrival/sessions") {
      const list = await preArrivalService.listSessions(incidentId, user.agencyId);
      return ok({ sessions: list });
    }

    if (routeKey === "POST /api/incidents/{id}/pre-arrival/sessions") {
      const body = JSON.parse(event.body ?? "{}");
      const out = await preArrivalService.createSession(incidentId, user, body);
      return ok(out, 201);
    }

    if (!sessionToken) return notFound("Missing session token");

    if (routeKey === "GET /api/incidents/{id}/pre-arrival/sessions/{sessionToken}") {
      const s = await preArrivalService.getDispatcherSession(incidentId, sessionToken, user.agencyId);
      return ok(s);
    }

    if (routeKey === "GET /api/incidents/{id}/pre-arrival/sessions/{sessionToken}/channel") {
      if (!sessionToken) return notFound("Missing session token");
      return ok(await listDispatcherChannel(incidentId, sessionToken, user.agencyId));
    }

    if (routeKey === "POST /api/incidents/{id}/pre-arrival/sessions/{sessionToken}/channel") {
      if (!sessionToken) return notFound("Missing session token");
      const message = await postDispatcherReply(
        incidentId,
        sessionToken,
        user.agencyId,
        user.userId,
        JSON.parse(event.body ?? "{}"),
      );
      return ok(message, 201);
    }

    if (routeKey === "POST /api/incidents/{id}/pre-arrival/sessions/{sessionToken}/end") {
      const s = await preArrivalService.endSession(incidentId, sessionToken, user.agencyId, user.userId);
      return ok(s);
    }

    return notFound("Unknown route");
  } catch (e) {
    return mapErr(e);
  }
};
