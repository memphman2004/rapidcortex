import type { APIGatewayProxyEventV2 } from "aws-lambda";

const CORS_ALLOWED_ORIGINS = new Set([
  "https://www.rapidcortex.us",
  "https://rapidcortex.us",
  "https://app.rapidcortex.us",
  "https://app-staging.rapidcortex.us",
  "https://report.rapidcortex.us",
]);

export function wyzePublicCorsHeaders(
  event: APIGatewayProxyEventV2,
  methods = "GET,POST,OPTIONS",
): Record<string, string> {
  const headers = event.headers ?? {};
  const origin = (headers.origin || headers.Origin || "").trim();
  const allowed = CORS_ALLOWED_ORIGINS.has(origin) || origin.startsWith("http://localhost");
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "content-type,authorization,accept,origin",
    Vary: "Origin",
  };
}

export function wyzePublicJson(
  event: APIGatewayProxyEventV2,
  statusCode: number,
  body: unknown,
  methods = "GET,POST,OPTIONS",
) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...wyzePublicCorsHeaders(event, methods),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  };
}
