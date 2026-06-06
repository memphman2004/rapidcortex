import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  badRequest,
  forbidden,
  jsonStatus,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../lib/response.js";
import { getMultilingualConfigBlockResponse } from "../voice/multilingualLambdaEnv.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { MultilingualCallService } from "../services/multilingualCallService.js";
import { env } from "../lib/env.js";

const service = new MultilingualCallService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.languageSessionsTable)
      return serviceUnavailable("Multilingual voice is not configured");
    const cfgBlock = getMultilingualConfigBlockResponse();
    if (cfgBlock) {
      return jsonStatus(
        {
          error: "Multilingual voice is misconfigured",
          code: cfgBlock.code,
          issues: cfgBlock.issues,
        },
        503,
      );
    }
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const status = await service.getStatus(incidentId, user);
    return ok(status);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
