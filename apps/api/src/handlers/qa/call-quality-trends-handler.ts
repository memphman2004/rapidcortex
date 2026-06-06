import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { getQaTrendsQuerySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { CallQualityTrendsService } from "../../services/callQualityTrendsService.js";

const service = new CallQualityTrendsService();
const auth = new AuthorizationService();

function mapErr(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const statusCode = (e as Error & { statusCode?: number }).statusCode;
  if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
  if (msg === "QA_SCORECARDS_DISABLED") return serviceUnavailable("QA trends require scorecards table");
  if (msg === "FORBIDDEN") return forbidden();
  return serverError();
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    if (event.routeKey !== "GET /api/qa/trends") return notFound();

    auth.assertCanPerform(user, "qa.trends");

    const q = getQaTrendsQuerySchema.safeParse(event.queryStringParameters ?? {});
    if (!q.success) return badRequestFromZod(q.error);
    const data = await service.trends(user, q.data);
    return ok(data);
  } catch (e) {
    return mapErr(e);
  }
};
