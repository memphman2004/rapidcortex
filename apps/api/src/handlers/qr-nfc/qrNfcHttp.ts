import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  jsonStatus,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { QrNfcService } from "../../qr-nfc/qr-nfc-service.js";

const service = new QrNfcService();

function method(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return (event.requestContext as { http?: { method?: string } }).http?.method ?? "GET";
}

function parseBody(event: Parameters<APIGatewayProxyHandlerV2>[0]): unknown {
  try {
    return JSON.parse(event.body ?? "{}");
  } catch {
    return null;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (method(event) === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
    };
  }

  try {
    const path = event.rawPath ?? "";
    const qrId = event.pathParameters?.qrId?.trim();
    const isGlobal = path.endsWith("/global") || path.includes("/qr-nfc/global");
    const m = method(event);

    if (path.includes("/engage")) {
      return withCorrelationHeaders(event, jsonStatus({ error: "Use public engage handler" }, 405));
    }

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

    if (isGlobal && m === "GET") {
      const agencyId = event.queryStringParameters?.agencyId;
      const vertical = event.queryStringParameters?.vertical as never;
      const activeParam = event.queryStringParameters?.active;
      const active = activeParam === undefined ? undefined : activeParam === "true";
      const items = await service.listGlobal(user, { agencyId, vertical, active });
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (m === "GET" && !qrId) {
      const agencyId = event.queryStringParameters?.agencyId;
      const vertical = event.queryStringParameters?.vertical as never;
      const activeParam = event.queryStringParameters?.active;
      const active = activeParam === undefined ? undefined : activeParam === "true";
      const items = await service.list(user, { agencyId, vertical, active });
      return withCorrelationHeaders(event, ok({ items }));
    }

    if (m === "GET" && qrId) {
      const record = await service.get(user, qrId, event.queryStringParameters?.agencyId);
      if (!record) return withCorrelationHeaders(event, notFound());
      return withCorrelationHeaders(event, ok({ record }));
    }

    if (m === "POST" && !qrId) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const record = await service.create(user, body);
      return withCorrelationHeaders(event, jsonStatus({ record }, 201));
    }

    if (m === "PATCH" && qrId) {
      const body = parseBody(event);
      if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
      const record = await service.update(user, qrId, body);
      if (!record) return withCorrelationHeaders(event, notFound());
      return withCorrelationHeaders(event, ok({ record }));
    }

    if (m === "DELETE" && qrId) {
      const record = await service.deactivate(user, qrId);
      if (!record) return withCorrelationHeaders(event, notFound());
      return withCorrelationHeaders(event, ok({ record }));
    }

    return withCorrelationHeaders(event, jsonStatus({ error: "Not found" }, 404));
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "FORBIDDEN") return withCorrelationHeaders(event, forbidden());
      if (e.message === "NOT_FOUND") return withCorrelationHeaders(event, notFound());
      if (e.message === "VALIDATION" && "zodError" in e) {
        return withCorrelationHeaders(event, badRequestFromZod((e as { zodError: import("zod").ZodError }).zodError));
      }
    }
    console.error("[qr-nfc]", e);
    return withCorrelationHeaders(event, serverError());
  }
};
