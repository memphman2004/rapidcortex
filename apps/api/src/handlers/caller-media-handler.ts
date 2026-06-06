import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  callerMediaSendLinkBodySchema,
  callerMediaUploadUrlBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { MediaService } from "../services/mediaService.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new MediaService();
const requireCallerMediaPhotoAddon = requireAddon("caller_media.photo.");
const requireCallerMediaVideoAddon = requireAddon("caller_media.video.");
const requireCallerMediaSmsAddon = requireAddon("caller_media.sms_link");

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "INCIDENT_MEDIA_DISABLED" || msg === "INCIDENT_MEDIA_TABLE_NOT_CONFIGURED") {
    return serviceUnavailable("Caller media is not enabled");
  }
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "FORBIDDEN_ROLE" || msg === "TENANT_MISMATCH") return forbidden();
  if (msg.startsWith("VALIDATION:")) return badRequest(msg.slice("VALIDATION:".length));
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const incidentId = event.pathParameters?.incidentId ?? event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const routeKey = event.routeKey ?? "";
    const mediaId = event.pathParameters?.mediaId;

    if (routeKey === "POST /api/incidents/{incidentId}/media/upload-url") {
      const parsed = callerMediaUploadUrlBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const addonGate =
        parsed.data.mediaType === "video"
          ? await requireCallerMediaVideoAddon(event, user)
          : await requireCallerMediaPhotoAddon(event, user);
      if (addonGate) return addonGate;
      const out = await service.issueDispatcherUploadUrl(incidentId, user, parsed.data);
      return ok(out, 201);
    }

    if (routeKey === "POST /api/incidents/{incidentId}/media/send-link") {
      const parsed = callerMediaSendLinkBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const addonGate = await requireCallerMediaSmsAddon(event, user);
      if (addonGate) return addonGate;
      const out = await service.sendMediaLink(incidentId, user, parsed.data);
      return ok(out, 201);
    }

    if (routeKey === "GET /api/incidents/{incidentId}/media") {
      const out = await service.listForIncident(incidentId, user);
      return ok(out);
    }

    if (routeKey === "DELETE /api/incidents/{incidentId}/media/{mediaId}") {
      if (!mediaId) return notFound();
      await service.softDeleteMedia(incidentId, mediaId, user);
      return { statusCode: 204, headers: {}, body: "" };
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
