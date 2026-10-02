import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { forbidden, jsonStatus, unauthorized } from "../lib/response.js";
import { getEffectiveSupportedLanguages } from "../languages/language-support-service.js";

const authz = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  // INTENTIONAL: language metadata is a multi-permission lookup (used by both
  // workspace.transcription and workspace.translation paths). No single matrix
  // permission maps cleanly; broad canDispatch correctly authorizes any operational
  // role that would consume STT or translation.
  if (!authz.canDispatch(user)) return forbidden();

  try {
    const data = await getEffectiveSupportedLanguages();
    return jsonStatus(
      {
        ok: true,
        primaryProvider: data.primaryProvider,
        fallbackProvider: data.fallbackProvider,
        defaultLanguage: "en",
        count: data.count,
        languages: data.languages,
        warnings: data.warnings,
      },
      200,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "call_intelligence_languages_error",
        agencyId: user.agencyId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return jsonStatus({ ok: false, error: "language_support_unavailable" }, 500);
  }
};
