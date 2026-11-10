import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { requestLiveVideoPayloadSchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { notFound, ok, unauthorized, badRequestFromZod } from "../../lib/response.js";
import { requireAddon } from "../../middleware/requireAddon.js";
import { LiveVideoService } from "../../services/liveVideoService.js";
import { mapLiveVideoError } from "./liveVideoErrors.js";

const service = new LiveVideoService();
const requireLiveVideoKvsAddon = requireAddon("caller_media.live_video_kvs");

export async function requestLiveVideoHandler(
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
    const raw = JSON.parse(event.body ?? "{}");
    const parsed = requestLiveVideoPayloadSchema.safeParse(raw);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const out = await service.requestLiveVideo(incidentId, user, parsed.data);
    return ok(out, 201);
  } catch (e) {
    return mapLiveVideoError(e);
  }
}
