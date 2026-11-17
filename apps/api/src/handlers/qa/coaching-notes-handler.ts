import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  createCoachingNoteBodySchema,
  listCoachingNotesQuerySchema,
  patchCoachingNoteBodySchema,
} from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { CoachingNotesService } from "../../services/coachingNotesService.js";

const service = new CoachingNotesService();
const auth = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "COACHING_NOTES_DISABLED") return serviceUnavailable("Coaching notes are not enabled");
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const routeKey = event.routeKey ?? "";
    const noteId = event.pathParameters?.noteId;

    if (routeKey === "POST /api/qa/coaching-notes") {
      auth.assertCanPerform(user, "qa.coaching_create");
      let _b1: unknown; try { _b1 = JSON.parse(event.body ?? "{}"); } catch { return badRequest("Invalid JSON body"); }
      const parsed = createCoachingNoteBodySchema.safeParse(_b1);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.create(user, parsed.data);
      return ok(created, 201);
    }

    if (routeKey === "GET /api/qa/coaching-notes") {
      auth.assertCanPerform(user, "qa.coaching_view");
      const q = listCoachingNotesQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!q.success) return badRequestFromZod(q.error);
      const items = await service.list(user, q.data);
      return ok({ items });
    }

    if (routeKey === "PATCH /api/qa/coaching-notes/{noteId}") {
      auth.assertCanPerform(user, "qa.coaching_create");
      if (!noteId) return notFound();
      let _b2: unknown; try { _b2 = JSON.parse(event.body ?? "{}"); } catch { return badRequest("Invalid JSON body"); }
      const parsed = patchCoachingNoteBodySchema.safeParse(_b2);
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const updated = await service.patch(user, noteId, parsed.data);
      return ok(updated);
    }

    if (routeKey === "DELETE /api/qa/coaching-notes/{noteId}") {
      auth.assertCanPerform(user, "qa.coaching_create");
      if (!noteId) return notFound();
      await service.remove(user, noteId);
      return { statusCode: 204, headers: {}, body: "" };
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
