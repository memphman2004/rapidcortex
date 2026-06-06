import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { acknowledgeTraumaFlagBodySchema } from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
  badRequestFromZod,
} from "../../lib/response.js";
import { WellnessService } from "../../services/wellnessService.js";
import { env } from "../../lib/env.js";

const wellness = new WellnessService();
const authz = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableDispatcherWellness || !env.traumaFlagsTable) {
      return serviceUnavailable(
        "Dispatcher wellness monitoring is not enabled for this deployment",
      );
    }
    const flagId = event.pathParameters?.flagId;
    if (!flagId) return badRequest("flagId required");

    const parsed = acknowledgeTraumaFlagBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!authz.canAccessSupervisorRoutes(user)) return forbidden();

    await wellness.acknowledge(flagId, user);
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "WELLNESS_DISABLED") {
      return serviceUnavailable(
        "Dispatcher wellness monitoring is not enabled for this deployment",
      );
    }
    return serverError();
  }
};
