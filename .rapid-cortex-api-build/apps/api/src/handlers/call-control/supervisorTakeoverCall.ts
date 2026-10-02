import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { takeoverCallBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequestFromZod,
  conflict,
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

    const parsed = takeoverCallBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const result = await service.takeoverCall(user, parsed.data);
    return ok(result);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") return forbidden();
    if (e instanceof Error && e.message === "CALL_NOT_FOUND") return notFound("Call not found");
    if (e instanceof Error && e.message === "TRANSFER_ALREADY_PENDING") {
      return conflict("A transfer is already pending for this call");
    }
    return serverError();
  }
};
