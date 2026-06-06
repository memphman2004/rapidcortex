import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  createPostIncidentReviewBodySchema,
  listPostIncidentReviewsQuerySchema,
  patchPostIncidentReviewBodySchema,
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
import { PostIncidentReviewService } from "../services/postIncidentReviewService.js";

const service = new PostIncidentReviewService();
const auth = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "POST_INCIDENT_REVIEWS_DISABLED") return serviceUnavailable("Post-incident reviews are not enabled");
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (msg === "NOT_FINAL") return badRequest("Only finalized reviews can be exported");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const routeKey = event.routeKey ?? "";
    const reviewId = event.pathParameters?.reviewId;

    if (routeKey === "POST /api/reviews") {
      auth.assertCanPerform(user, "command.pir_create");
      const parsed = createPostIncidentReviewBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.create(user, parsed.data);
      return ok(created, 201);
    }

    if (routeKey === "GET /api/reviews") {
      auth.assertCanPerform(user, "command.pir_view");
      const q = listPostIncidentReviewsQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!q.success) return badRequestFromZod(q.error);
      return ok(await service.list(user, q.data.incidentId, q.data.status));
    }

    if (routeKey === "GET /api/reviews/{reviewId}") {
      auth.assertCanPerform(user, "command.pir_view");
      if (!reviewId) return notFound();
      return ok(await service.get(user, reviewId));
    }

    if (routeKey === "PATCH /api/reviews/{reviewId}") {
      auth.assertCanPerform(user, "command.pir_create");
      if (!reviewId) return notFound();
      const parsed = patchPostIncidentReviewBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      return ok(await service.patch(user, reviewId, parsed.data));
    }

    if (routeKey === "GET /api/reviews/{reviewId}/export") {
      auth.assertCanPerform(user, "command.pir_view");
      if (!reviewId) return notFound();
      return ok(await service.export(user, reviewId));
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
