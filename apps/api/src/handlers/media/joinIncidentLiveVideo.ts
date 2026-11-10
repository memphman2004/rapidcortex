import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { notFound, ok, unauthorized } from "../../lib/response.js";
import { requireAddon } from "../../middleware/requireAddon.js";
import { LiveVideoService } from "../../services/liveVideoService.js";
import { mapLiveVideoError } from "./liveVideoErrors.js";

const service = new LiveVideoService();
const requireLiveVideoKvsAddon = requireAddon("caller_media.live_video_kvs");

export async function joinIncidentLiveVideoHandler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireLiveVideoKvsAddon(event, user);
    if (addonGate) return addonGate;
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return notFound();
    return ok(await service.joinIncidentLiveVideo(incidentId, user));
  } catch (e) {
    return mapLiveVideoError(e);
  }
}
