import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import {
  createQaScorecardBodySchema,
  listQaScorecardsQuerySchema,
  patchQaScorecardBodySchema,
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
import { QaScorecardService } from "../../services/qaScorecardService.js";

const service = new QaScorecardService();
const auth = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "QA_SCORECARDS_DISABLED") return serviceUnavailable("QA scorecards are not enabled");
  if (msg === "NOT_FOUND") return notFound();
  if (msg === "FORBIDDEN" || msg === "TENANT_MISMATCH") return forbidden();
  if (msg === "INVALID_STATE") return badRequest("Scorecard must be submitted before acknowledge");
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const routeKey = event.routeKey ?? "";
    const scorecardId = event.pathParameters?.scorecardId;

    if (routeKey === "POST /api/qa/scorecards") {
      auth.assertCanPerform(user, "qa.scorecards_create");
      const parsed = createQaScorecardBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const created = await service.create(user, parsed.data);
      return ok(created, 201);
    }

    if (routeKey === "GET /api/qa/scorecards") {
      auth.assertCanPerform(user, "qa.scorecards_view");
      const q = listQaScorecardsQuerySchema.safeParse(event.queryStringParameters ?? {});
      if (!q.success) return badRequestFromZod(q.error);
      const items = await service.list(user, q.data);
      return ok({ items });
    }

    if (routeKey === "GET /api/qa/scorecards/{scorecardId}") {
      auth.assertCanPerform(user, "qa.scorecards_view");
      if (!scorecardId) return notFound();
      const card = await service.get(user, scorecardId);
      return ok(card);
    }

    if (routeKey === "PATCH /api/qa/scorecards/{scorecardId}") {
      auth.assertCanPerform(user, "qa.scorecards_create");
      if (!scorecardId) return notFound();
      const parsed = patchQaScorecardBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) return badRequestFromZod(parsed.error);
      const updated = await service.patch(user, scorecardId, parsed.data);
      return ok(updated);
    }

    if (routeKey === "POST /api/qa/scorecards/{scorecardId}/acknowledge") {
      auth.assertCanPerform(user, "qa.scorecards_ack");
      if (!scorecardId) return notFound();
      const updated = await service.acknowledge(user, scorecardId);
      return ok(updated);
    }

    return notFound();
  } catch (e) {
    return mapErr(e);
  }
};
