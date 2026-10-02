import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

/** Prefer client-provided X-Request-Id for tracing; fall back to API Gateway request id. */
export function getCorrelationId(event: APIGatewayProxyEventV2): string {
  const fromHeader =
    event.headers?.["x-request-id"] ??
    event.headers?.["X-Request-Id"] ??
    event.headers?.["x-correlation-id"] ??
    event.headers?.["X-Correlation-Id"];
  if (fromHeader?.trim()) return fromHeader.trim().slice(0, 128);
  const ctx = event.requestContext as { requestId?: string };
  if (ctx.requestId?.trim()) return ctx.requestId.trim().slice(0, 128);
  return "unknown";
}

export function withCorrelationHeaders(
  event: APIGatewayProxyEventV2,
  result: APIGatewayProxyResultV2,
): APIGatewayProxyResultV2 {
  const id = getCorrelationId(event);
  if (typeof result === "string" || result == null) {
    return result;
  }
  const prior = result.headers;
  const base =
    prior && typeof prior === "object" && !Array.isArray(prior)
      ? { ...(prior as Record<string, string>) }
      : {};
  return {
    ...result,
    headers: {
      ...base,
      "X-Request-Id": id,
    },
  };
}
