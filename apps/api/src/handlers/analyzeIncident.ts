import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import {
  badRequest,
  forbidden,
  jsonStatus,
  ok,
  serverError,
  unauthorized,
} from "../lib/response.js";
import { AnalysisService } from "../services/analysisService.js";
import { NormalizedAiError } from "../ai/normalizedAiError.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new AnalysisService();
const requireAnalysisAddon = requireAddon("ai.");

function resolveRequestId(event: Parameters<APIGatewayProxyHandlerV2>[0]): string | undefined {
  const ctx = event.requestContext as
    | { requestId?: string; http?: { requestId?: string } }
    | undefined;
  return ctx?.requestId ?? ctx?.http?.requestId;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const requestId = resolveRequestId(event);
  try {
    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireAnalysisAddon(event, user);
    if (addonGate) return addonGate;
    const pwd = operationalPasswordBlock(user);
    if (pwd) return pwd;
    const analysis = await service.analyze(incidentId, user, {
      triggerType: "manual",
      requestId,
    });

    return ok(analysis, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    if (error instanceof NormalizedAiError) {
      return jsonStatus(
        {
          success: false,
          analysisStatus: "failed",
          errorCode: error.code,
          message: error.publicMessage,
          requestId,
        },
        error.httpStatus,
      );
    }
    return serverError();
  }
};
