import type { APIGatewayProxyHandlerV2, ScheduledEvent } from "aws-lambda";
import { isAdminRole, isSupervisorOrAdmin } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { env } from "../../lib/env.js";
import { getStaffingForecast } from "../../lib/staffing/forecast-store.js";
import {
  generateStaffingForecastForAgency,
  generateStaffingForecastsScheduled,
} from "../../lib/staffing/generate-service.js";
import { makeId } from "../../lib/ids.js";

function isApiGatewayEvent(
  event: APIGatewayProxyHandlerV2 extends (e: infer E, ...args: infer _A) => infer _R ? E : never,
): event is Parameters<APIGatewayProxyHandlerV2>[0] {
  return typeof event === "object" && event !== null && "requestContext" in event;
}

function isScheduledInvocation(event: unknown): event is ScheduledEvent {
  return typeof event === "object" && event !== null && "source" in event && (event as ScheduledEvent).source === "aws.events";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enablePredictiveStaffing) {
      if (isScheduledInvocation(event)) {
        console.log(JSON.stringify({ type: "staffing.scheduled_skip", reason: "feature_disabled" }));
        return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };
      }
      return serviceUnavailable("Predictive staffing is not enabled for this deployment");
    }
    if (!env.staffingForecastTable) {
      return serviceUnavailable("Staffing forecast table is not configured");
    }

    if (isScheduledInvocation(event)) {
      const result = await generateStaffingForecastsScheduled();
      console.log(JSON.stringify({ type: "staffing.scheduled_complete", ...result }));
      return { statusCode: 200, body: JSON.stringify({ ok: true, ...result }) };
    }

    if (!isApiGatewayEvent(event)) {
      return badRequest("Unsupported event source");
    }

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath ?? event.requestContext.http.path ?? "";

    if (method === "GET" && path.endsWith("/api/staffing/forecast")) {
      if (!isSupervisorOrAdmin(user.role)) return forbidden();
      const startDate = event.queryStringParameters?.startDate?.trim();
      const forecast = await getStaffingForecast(user.agencyId, startDate || undefined);
      return ok(forecast);
    }

    if (method === "POST" && path.endsWith("/api/staffing/forecast/generate")) {
      if (!isAdminRole(user.role)) return forbidden();
      const forecast = await generateStaffingForecastForAgency(user.agencyId, user.userId, user.role);
      if (!forecast) {
        return serviceUnavailable("Staffing forecast is not enabled for this agency");
      }
      return ok({ ok: true, jobId: makeId("staff"), forecast });
    }

    return badRequest("Method not allowed");
  } catch (error) {
    console.error(JSON.stringify({ type: "staffing.forecast_http_error", error: String(error) }));
    return serverError();
  }
};
