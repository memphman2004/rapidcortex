import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { translateLanguageSessionBodySchema } from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import {
  badRequest,
  badRequestFromZod,
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
import { VoiceProviderError } from "../voice/providerErrors.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new MultilingualCallService();
const auth = new AuthorizationService();
const requireTranslationAddon = requireAddon("translation.");

/**
 * POST /api/incidents/{id}/language-session/translate
 *
 * Standalone Azure Translator endpoint for translating arbitrary text within an
 * agency-scoped incident/language session. Gated by `workspace.translation` permission
 * per the v2.0 Role Access Matrix; in addition the service verifies agencyId + optional
 * sessionId before invoking the provider. Audit: VOICE_TRANSLATION_APPLIED.
 */
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

    const parsed = translateLanguageSessionBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const addonGate = await requireTranslationAddon(event, user);
    if (addonGate) return addonGate;

    auth.assertCanPerform(user, "workspace.translation");

    const result = await service.translateText(incidentId, user, parsed.data);
    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
    if (msg === "FORBIDDEN") return forbidden();
    if (msg === "SESSION_NOT_FOUND") return jsonStatus({ error: "Session not found" }, 404);
    if (error instanceof VoiceProviderError) {
      return jsonStatus({ error: "Translation provider error", code: error.code }, 502);
    }
    return serverError();
  }
};
