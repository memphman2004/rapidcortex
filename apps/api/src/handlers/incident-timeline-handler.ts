import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { postIncidentTimelineNoteBodySchema } from "rapid-cortex-shared";
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
import { IncidentTimelineService } from "../services/incidentTimelineService.js";

const service = new IncidentTimelineService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "TIMELINE_DISABLED") return serviceUnavailable("Incident timeline is not enabled");
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
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
    const rawPath = event.rawPath ?? "";

    if (routeKey === "GET /api/incidents/{incidentId}/timeline/export" || rawPath.endsWith("/timeline/export")) {
      const data = await service.export(user, incidentId);
      return ok(data);
    }

    if (routeKey === "GET /api/incidents/{incidentId}/timeline" || (rawPath.endsWith("/timeline") && event.requestContext.http?.method === "GET")) {
      const items = await service.list(user, incidentId);
      return ok({ items });
    }

    if (routeKey === "POST /api/incidents/{incidentId}/timeline" || (rawPath.endsWith("/timeline") && event.requestContext.http?.method === "POST")) {
      const parsed = postIncidentTimelineNoteBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.addNote(user, incidentId, parsed.data);
      return ok(created, 201);
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
