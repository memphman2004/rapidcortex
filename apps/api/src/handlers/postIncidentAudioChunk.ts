import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { postCallAudioChunkBodySchema } from "rapid-cortex-shared";
import {
  badRequest,
  conflict,
  forbidden,
  jsonStatus,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
  badRequestFromZod,
} from "../lib/response.js";
import { VoiceProviderError } from "../voice/providerErrors.js";
import { getMultilingualConfigBlockResponse } from "../voice/multilingualLambdaEnv.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { MultilingualCallService } from "../services/multilingualCallService.js";
import { env } from "../lib/env.js";

const service = new MultilingualCallService();
const auth = new AuthorizationService();

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

    const parsed = postCallAudioChunkBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    auth.assertCanPerform(user, "workspace.transcription");

    const out = await service.processAudioChunk(incidentId, user, parsed.data);
    return ok(out, out.outcome === "replayed" ? 200 : 201);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    if (error instanceof Error && error.message === "SESSION_NOT_FOUND")
      return badRequest("Session not found");
    if (error instanceof Error && error.message === "DUPLICATE_OR_OUT_OF_ORDER_CHUNK") {
      return conflict("Duplicate or out-of-order audio chunk sequence");
    }
    if (error instanceof VoiceProviderError) {
      return jsonStatus(
        {
          error: error.message,
          code: error.code,
          retryable: error.retryable,
        },
        503,
      );
    }
    return serverError();
  }
};
