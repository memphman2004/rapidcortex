import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { joinLiveVideoPayloadSchema } from "rapid-cortex-shared";
import { isLikelyPublicAccessToken } from "../../lib/publicToken.js";
import { badRequest, notFound, ok, badRequestFromZod } from "../../lib/response.js";
import { LiveVideoService } from "../../services/liveVideoService.js";
import { mapLiveVideoError } from "./liveVideoErrors.js";

const service = new LiveVideoService();

export async function joinLiveSessionHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound();
    const raw = JSON.parse(event.body ?? "{}");
    const parsed = joinLiveVideoPayloadSchema.safeParse(raw);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    return ok(await service.joinLiveSession(token, parsed.data));
  } catch (e) {
    return mapLiveVideoError(e);
  }
}
