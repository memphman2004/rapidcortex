import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { triageOverrideBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
  badRequestFromZod,
} from "../../lib/response.js";
import { TriageService } from "../../services/triageService.js";
import { env } from "../../lib/env.js";

const triage = new TriageService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableNonEmergencyTriage) {
      return serviceUnavailable("Non-emergency triage is not enabled for this deployment");
    }
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const parsed = triageOverrideBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    try {
      const next = await triage.override(incidentId, user, parsed.data.bucket, parsed.data.reason);
      return ok({ triage: next });
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode;
      if (sc === 404) return notFound("No triage snapshot for this incident");
      throw e;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
