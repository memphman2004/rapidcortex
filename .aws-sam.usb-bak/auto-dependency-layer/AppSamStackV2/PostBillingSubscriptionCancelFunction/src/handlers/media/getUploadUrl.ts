import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { isLikelyPublicAccessToken } from "../../lib/publicToken.js";
import {
  badRequest,
  jsonStatus,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";
import { MediaService } from "../../services/mediaService.js";

const service = new MediaService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "INCIDENT_MEDIA_DISABLED" || msg === "INCIDENT_MEDIA_TABLE_NOT_CONFIGURED") {
    return serviceUnavailable("Incident media is not enabled for this deployment");
  }
  if (msg === "MEDIA_EXPIRED") return jsonStatus({ error: "expired" }, 410);
  if (msg === "ALREADY_UPLOADED") return jsonStatus({ error: "already_uploaded" }, 409);
  if (msg === "MEDIA_CLOSED") return jsonStatus({ error: "closed" }, 409);
  return serverError();
}

/** Public: GET metadata for upload page. */
export async function getIncidentMediaPublicMetaHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound();
    const meta = await service.getPublicMeta(token);
    return ok(meta);
  } catch (e) {
    return mapErr(e);
  }
}

/** Public: POST presigned upload URL. */
export async function getUploadUrlHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound();
    const body = JSON.parse(event.body ?? "{}");
    const out = await service.issueUploadUrl(token, body);
    return ok(out);
  } catch (e) {
    return mapErr(e);
  }
}
