import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AdminAnalyticsService } from "../../services/adminAnalyticsService.js";

const service = new AdminAnalyticsService();

/**
 * Scheduled + manual: refresh S3 analytics cache for all recently seen agencies.
 * SAM wires this to **EventBridge Schedule only** — if an HTTP route is ever attached, deny it so
 * aggregation cannot be triggered anonymously from the public internet.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event: APIGatewayProxyEventV2) => {
  if (event.requestContext?.http?.method) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Not found" }),
    };
  }
  try {
    await service.aggregateAllAgencies(14);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch {
    return { statusCode: 500, body: JSON.stringify({ ok: false }) };
  }
};
