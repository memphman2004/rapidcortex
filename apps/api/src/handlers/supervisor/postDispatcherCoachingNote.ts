import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { postDispatcherCoachingNoteBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  unauthorized,
  notFound,
  badRequestFromZod,
} from "../../lib/response.js";
import { DispatcherPerformanceService } from "../../services/dispatcherPerformanceService.js";

const service = new DispatcherPerformanceService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const parsed = postDispatcherCoachingNoteBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    await service.postCoachingNote(user, parsed.data);
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    if (error instanceof Error && error.message === "FEATURE_DISABLED") {
      return notFound("Coaching notes disabled");
    }
    return serverError();
  }
};
