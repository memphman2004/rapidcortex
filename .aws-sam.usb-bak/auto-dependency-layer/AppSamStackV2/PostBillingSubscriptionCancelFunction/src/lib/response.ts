import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { ZodError } from "zod";
import { getNetworkDenialFromEvent } from "../middleware/network-access.js";
import { validationErrorMessageForClient } from "./zod-client-error.js";

export function ok<T>(body: T, statusCode = 200) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function badRequest(message: string) {
  return ok({ error: message }, 400);
}

/** Prefer over `badRequest(parsed.error.message)` for Zod failures. */
export function badRequestFromZod(err: ZodError) {
  return badRequest(validationErrorMessageForClient(err));
}

export function conflict(message: string) {
  return ok({ error: message }, 409);
}

export function unauthorized(message = "Unauthorized") {
  if (message === "User account is not active.") {
    return ok({ error: message }, 403);
  }
  return ok({ error: message }, 401);
}

/** Prefer over bare `unauthorized()` when `getUserContext` may have recorded a network denial. */
export function authFailure(
  event: APIGatewayProxyEventV2,
  message = "Unauthorized",
): APIGatewayProxyResultV2 {
  const denial = getNetworkDenialFromEvent(event);
  if (denial) return denial;
  return unauthorized(message);
}

export function serviceUnavailable(message = "Service unavailable") {
  return ok({ error: message }, 503);
}

export function notFound(message = "Not found") {
  return ok({ error: message }, 404);
}

export function serverError(message = "Internal server error") {
  return ok({ error: message }, 500);
}

export function jsonStatus<T>(body: T, statusCode: number) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function forbidden(message = "Forbidden") {
  return ok({ error: message }, 403);
}
