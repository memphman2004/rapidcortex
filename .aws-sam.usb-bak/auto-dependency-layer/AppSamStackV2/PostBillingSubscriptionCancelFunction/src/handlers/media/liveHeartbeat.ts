import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { liveHeartbeatPayloadSchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { isLikelyPublicAccessToken } from "../../lib/publicToken.js";
import { badRequest, notFound, ok, unauthorized, badRequestFromZod } from "../../lib/response.js";
import { LiveVideoService } from "../../services/liveVideoService.js";
import { mapLiveVideoError } from "./liveVideoErrors.js";

const service = new LiveVideoService();

export async function liveHeartbeatCallerHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const token = event.pathParameters?.token;
    if (!isLikelyPublicAccessToken(token)) return notFound();
    const raw = JSON.parse(event.body ?? "{}");
    const parsed = liveHeartbeatPayloadSchema.safeParse(raw);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    if (parsed.data.role !== "caller") return badRequest("role must be caller");
    return ok(await service.liveHeartbeatFromCaller(token, parsed.data));
  } catch (e) {
    return mapLiveVideoError(e);
  }
}

export async function liveHeartbeatDispatcherHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return notFound();
    const raw = JSON.parse(event.body ?? "{}");
    const parsed = liveHeartbeatPayloadSchema.safeParse(raw);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    if (parsed.data.role !== "dispatcher") return badRequest("role must be dispatcher");
    return ok(await service.liveHeartbeatFromDispatcher(incidentId, user, parsed.data));
  } catch (e) {
    return mapLiveVideoError(e);
  }
}
