import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { notFound, ok, serverError } from "../../lib/response.js";
import { getPublicCrimeLog } from "../clery-act/service.js";

function pathOf(event: Parameters<APIGatewayProxyHandlerV2>[0]): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableCleryModule) {
      return withCorrelationHeaders(event, {
        statusCode: 404,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "Not found" }),
      });
    }
    const match = pathOf(event).match(/\/api\/public\/crime-log\/([^/]+)\/?$/);
    const slug = match?.[1] ? decodeURIComponent(match[1]) : "";
    if (!slug) return withCorrelationHeaders(event, notFound());
    const payload = await getPublicCrimeLog(slug);
    return withCorrelationHeaders(event, {
      ...ok(payload),
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=60, s-maxage=900",
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "FEATURE_DISABLED")) {
      return withCorrelationHeaders(event, notFound());
    }
    console.error("[public-crime-log]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
