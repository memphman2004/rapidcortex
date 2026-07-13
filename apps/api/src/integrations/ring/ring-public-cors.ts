import type { APIGatewayProxyEventV2 } from "aws-lambda";

const CORS_ALLOWED_ORIGINS = new Set([
  "https://www.rapidcortex.us",
  "https://rapidcortex.us",
  "https://app.rapidcortex.us",
  "https://report.rapidcortex.us",
]);

export function ringPublicCorsHeaders(
  event: APIGatewayProxyEventV2,
  methods = "GET,POST,OPTIONS",
): Record<string, string> {
  const headers = event.headers ?? {};
  const origin = (headers.origin || headers.Origin || "").trim();
  if (!CORS_ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "content-type,authorization,accept,origin",
    Vary: "Origin",
  };
}

export function ringPublicJson(
  event: APIGatewayProxyEventV2,
  statusCode: number,
  body: unknown,
  methods = "GET,POST,OPTIONS",
) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...ringPublicCorsHeaders(event, methods),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}

export function ringPublicClientIp(event: {
  requestContext?: { http?: { sourceIp?: string } };
}): string {
  return event.requestContext?.http?.sourceIp?.trim() || "unknown";
}
