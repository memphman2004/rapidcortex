import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  diversionConfirmBodySchema,
  diversionStartBodySchema,
  diversionUtteranceBodySchema,
} from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import {
  badRequest,
  badRequestFromZod,
  jsonStatus,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { confirm, processUtterance, startSession } from "../../services/ng911/diversionService.js";

function parseBody(raw: string | undefined): unknown {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return null;
  }
}

function getDiversionKey(event: Parameters<APIGatewayProxyHandlerV2>[0]): string | undefined {
  return (
    event.headers?.["x-diversion-key"] ??
    event.headers?.["X-Diversion-Key"] ??
    event.headers?.["X-Diversion-key"]
  );
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("VALIDATION:")) return badRequest(message.slice("VALIDATION:".length));
  if (message === "DIVERSION_NOT_CONFIGURED") {
    return serviceUnavailable("Non-emergency diversion is not configured for this agency");
  }
  if (message === "UNAUTHORIZED_KEY") return unauthorized("Invalid diversion key");
  if (message === "SESSION_NOT_FOUND") return notFound("Session not found");
  if (message === "SESSION_CLOSED") return jsonStatus({ error: "session_closed" }, 409);
  if (message === "NOT_FOUND") return notFound();
  console.error("[ng911.diversionPublic]", error);
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableNg911Assist || !env.ng911AssistTable) {
      return withCorrelationHeaders(
        event,
        serviceUnavailable("Non-emergency diversion is not enabled for this deployment"),
      );
    }

    const agencyId = event.pathParameters?.agencyId?.trim();
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));

    const publicKey = getDiversionKey(event);
    const path = event.rawPath ?? "";
    const method = event.requestContext.http.method.toUpperCase();
    const body = parseBody(event.body);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));

    if (method === "POST" && path.endsWith("/start")) {
      const parsed = diversionStartBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await startSession(agencyId, publicKey, parsed.data);
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "POST" && path.endsWith("/utterance")) {
      const parsed = diversionUtteranceBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await processUtterance(agencyId, publicKey, parsed.data);
      return withCorrelationHeaders(event, ok(result));
    }

    if (method === "POST" && path.endsWith("/confirm")) {
      const parsed = diversionConfirmBodySchema.safeParse(body);
      if (!parsed.success) return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
      const result = await confirm(agencyId, publicKey, parsed.data);
      return withCorrelationHeaders(event, ok(result));
    }

    return withCorrelationHeaders(event, notFound("Unknown route"));
  } catch (error) {
    return withCorrelationHeaders(event, mapError(error));
  }
};
