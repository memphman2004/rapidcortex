import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { startLanguageSessionBodySchema } from "rapid-cortex-shared";
import {
  badRequest,
  forbidden,
  jsonStatus,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
  badRequestFromZod,
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

    const parsed = startLanguageSessionBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const session = await service.startSession(incidentId, user, parsed.data);
    return ok(session, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message === "LANGUAGE_SESSIONS_TABLE_NOT_CONFIGURED") {
      return serviceUnavailable("Multilingual voice storage is not configured");
    }
    return serverError();
  }
};
