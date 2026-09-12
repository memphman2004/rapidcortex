/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { RING_INTEGRATION_ENABLED } from "rapid-cortex-shared";
import { ringPublicCorsHeaders } from "./ring-public-cors.js";

export { RING_INTEGRATION_ENABLED };

export const RING_INTEGRATION_DISABLED_BODY = {
  success: false as const,
  error: "Ring camera integration is temporarily unavailable.",
  code: "RING_INTEGRATION_DISABLED",
};

/** 503 payload used by every Ring HTTP handler while the integration is suspended. */
export function ringIntegrationDisabledResponse(
  event?: APIGatewayProxyEventV2,
): APIGatewayProxyResultV2 {
  return {
    statusCode: 503,
    headers: {
      "Content-Type": "application/json",
      ...(event ? ringPublicCorsHeaders(event) : {}),
    },
    body: JSON.stringify(RING_INTEGRATION_DISABLED_BODY),
  };
}

export function ringJson<T>(
  body: { success: boolean; data?: T; error?: string },
  statusCode = 200,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function ringRedirect(location: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 302,
    headers: { Location: location },
    body: "",
  };
}

export function ringHtml(body: string, statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body,
  };
}
