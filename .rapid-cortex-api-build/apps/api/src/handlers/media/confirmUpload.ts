import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { isLikelyPublicAccessToken } from "../../lib/publicToken.js";
import { badRequest, notFound, ok, serverError, serviceUnavailable } from "../../lib/response.js";
import { MediaService } from "../../services/mediaService.js";

const service = new MediaService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "INCIDENT_MEDIA_DISABLED" || msg === "INCIDENT_MEDIA_TABLE_NOT_CONFIGURED") {
    return serviceUnavailable("Incident media is not enabled for this deployment");
  }
  if (msg === "MEDIA_EXPIRED") return badRequest("Link expired");
  if (msg === "S3_KEY_MISMATCH") return badRequest("Invalid upload key");
  if (msg === "OBJECT_NOT_FOUND") return badRequest("Upload not found in storage yet");
  return serverError();
}

export async function confirmUploadHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound();
    const body = JSON.parse(event.body ?? "{}");
    const media = await service.confirmUpload(token, body);
    return ok({ media });
  } catch (e) {
    return mapErr(e);
  }
}
