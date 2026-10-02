import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { notFound } from "../../lib/response.js";
import { handler as callerMediaHandler } from "../caller-media-handler.js";
import { listMediaHandler } from "./listMedia.js";
import { requestMediaHandler } from "./requestMedia.js";

async function delegate(
  inner: APIGatewayProxyHandlerV2,
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> {
  const out = await inner(event, context, () => {});
  return out ?? notFound();
}

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  const routeKey = event.routeKey ?? "";
  if (routeKey === "POST /api/incidents/{id}/media/request") {
    return requestMediaHandler(event);
  }
  if (
    routeKey === "POST /api/incidents/{incidentId}/media/upload-url" ||
    routeKey === "POST /api/incidents/{incidentId}/media/send-link" ||
    routeKey === "DELETE /api/incidents/{incidentId}/media/{mediaId}"
  ) {
    return await delegate(callerMediaHandler, event, context);
  }
  if (routeKey === "GET /api/incidents/{id}/media" || routeKey === "GET /api/incidents/{incidentId}/media") {
    return listMediaHandler(event);
  }
  return notFound();
};
