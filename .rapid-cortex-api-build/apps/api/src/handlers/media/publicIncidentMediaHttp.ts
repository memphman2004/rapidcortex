import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { notFound } from "../../lib/response.js";
import { confirmUploadHandler } from "./confirmUpload.js";
import { getIncidentMediaPublicMetaHandler, getUploadUrlHandler } from "./getUploadUrl.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const routeKey = event.routeKey ?? "";
  if (routeKey === "GET /api/public/incident-media/t/{token}") {
    return getIncidentMediaPublicMetaHandler(event);
  }
  if (routeKey === "POST /api/public/incident-media/t/{token}/upload-url") {
    return getUploadUrlHandler(event);
  }
  if (routeKey === "POST /api/public/incident-media/t/{token}/confirm") {
    return confirmUploadHandler(event);
  }
  return notFound();
};
