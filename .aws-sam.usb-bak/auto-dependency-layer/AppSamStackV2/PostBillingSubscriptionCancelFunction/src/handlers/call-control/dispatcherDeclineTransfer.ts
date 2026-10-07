import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { callIdBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { CallControlService } from "../../services/callControlService.js";

const service = new CallControlService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const parsed = callIdBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const call = await service.declineTransfer(user, parsed.data.callId);
    return ok({ success: true, call });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    if (e instanceof Error && e.message === "NOT_FOUND") return notFound("Call not found");
    if (e instanceof Error && e.message === "NO_PENDING_TRANSFER") {
      return badRequest("No pending transfer for this call");
    }
    return serverError();
  }
};
