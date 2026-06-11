import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { withCorrelationHeaders } from "../lib/correlation.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../lib/response.js";
import { SmsRoutingService } from "../services/smsRoutingService.js";

const service = new SmsRoutingService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN") return forbidden();
  if (msg === "SMS_ROUTING_TABLE_NOT_CONFIGURED") return notFound("SMS routing not configured");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const routeKey = event.routeKey ?? "";
    const phoneNumber = event.pathParameters?.phoneNumber;

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }

    if (routeKey === "GET /api/sms-routing") {
      const agencyId = event.queryStringParameters?.agencyId?.trim();
      if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));
      const result = await service.listForAgency(agencyId, user);
      return withCorrelationHeaders(event, ok(result));
    }

    if (routeKey === "POST /api/sms-routing") {
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const record = await service.register(body, user);
      return withCorrelationHeaders(event, ok({ item: record }, 201));
    }

    if (routeKey === "PATCH /api/sms-routing/{phoneNumber}") {
      if (!phoneNumber) return withCorrelationHeaders(event, badRequest("phoneNumber required"));
      let body: unknown;
      try {
        body = JSON.parse(event.body ?? "{}");
      } catch {
        return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      }
      const record = await service.patch(decodeURIComponent(phoneNumber), body, user);
      return withCorrelationHeaders(event, ok({ item: record }));
    }

    if (routeKey === "DELETE /api/sms-routing/{phoneNumber}") {
      if (!phoneNumber) return withCorrelationHeaders(event, badRequest("phoneNumber required"));
      const result = await service.deactivate(decodeURIComponent(phoneNumber), user);
      return withCorrelationHeaders(event, ok(result));
    }

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (e) {
    if (e && typeof e === "object" && "issues" in e) {
      return withCorrelationHeaders(event, badRequestFromZod(e as never));
    }
    return withCorrelationHeaders(event, mapErr(e));
  }
};
