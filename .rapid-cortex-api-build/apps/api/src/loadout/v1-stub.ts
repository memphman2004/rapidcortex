/**
 * NexCortiQ Loadout — V1 Stub Lambda
 *
 * Thin stub for /v1/* endpoints (REST or HttpApi event shapes).
 * Returns 422 not_implemented by default; smoke accepts 200 or 422.
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
} from "aws-lambda";

const SMOKE_OK_ROUTES = new Set(["/v1/ping", "/v1/health"]);

function resolvePath(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string {
  if ("rawPath" in event && typeof event.rawPath === "string") return event.rawPath;
  const rest = event as APIGatewayProxyEvent;
  return rest.path ?? rest.resource ?? "";
}

function resolveMethod(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string {
  if ("requestContext" in event && "http" in event.requestContext) {
    return (event.requestContext.http.method ?? "GET").toUpperCase();
  }
  return ((event as APIGatewayProxyEvent).httpMethod ?? "GET").toUpperCase();
}

export const handler = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResult> => {
  const path = resolvePath(event);
  const method = resolveMethod(event);

  console.log(JSON.stringify({ event: "v1_stub_invoked", path, method }));

  if (SMOKE_OK_ROUTES.has(path) || method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, echo: true, path }),
    };
  }

  return {
    statusCode: 422,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: false,
      error: "not_implemented",
      message: `${method} ${path} is not yet implemented in this environment.`,
    }),
  };
};
