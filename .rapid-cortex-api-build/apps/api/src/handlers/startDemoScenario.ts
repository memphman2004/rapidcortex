import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { badRequest, ok, serverError, unauthorized } from "../lib/response.js";
import { DemoService } from "../services/demoService.js";

const service = new DemoService();
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const body = JSON.parse(event.body ?? "{}") as { scenarioId?: string };
    if (!body.scenarioId) return badRequest("scenarioId is required");

    return ok(service.startScenario(body.scenarioId), 201);
  } catch {
    return serverError();
  }
};
