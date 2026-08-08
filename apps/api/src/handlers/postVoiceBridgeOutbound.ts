import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { voiceBridgeOutboundBodySchema } from "rapid-cortex-shared";
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
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { env } from "../lib/env.js";
import { VoiceBridgeService } from "../services/voiceBridgeService.js";
import { TranslationUnavailableError } from "../services/language/translationControlledError.js";
import { VoiceProviderError } from "../voice/providerErrors.js";
import { requireAddon } from "../middleware/requireAddon.js";

const service = new VoiceBridgeService();
const auth = new AuthorizationService();
const requireTranslationAddon = requireAddon("translation.");

/**
 * POST /api/incidents/{id}/voice-bridge/outbound
 *
 * Translate dispatcher English to the caller language and queue playback on the telephony
 * adapter (mock when `VOICE_BRIDGE_TELEPHONY_WEBHOOK_URL` is unset).
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.voiceBridgeEnabled) {
      return serviceUnavailable("Voice bridge is disabled for this deployment");
    }

    const incidentId = event.pathParameters?.id;
    if (!incidentId) return badRequest("Incident ID required");

    const parsed = voiceBridgeOutboundBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const pwd = operationalPasswordBlock(user);
    if (pwd) return pwd;

    const addonGate = await requireTranslationAddon(event, user);
    if (addonGate) return addonGate;
    auth.assertCanPerform(user, "workspace.translation");

    const result = await service.outbound(incidentId, user, parsed.data);
    return ok(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg === "FORBIDDEN") return forbidden();
    if (msg === "VOICE_BRIDGE_DISABLED") return serviceUnavailable("Voice bridge disabled");
    if (msg === "CALLER_LANGUAGE_REQUIRED") {
      return badRequest("Set caller language on the incident or pass targetLanguage");
    }
    if (msg === "CALLER_LANGUAGE_NOT_TRANSLATABLE") {
      return badRequest("Caller language is English — translation not required");
    }
    if (msg.startsWith("TELEPHONY_WEBHOOK_FAILED")) {
      return jsonStatus({ error: "Telephony adapter rejected the playback request" }, 502);
    }
    if (error instanceof TranslationUnavailableError) {
      return jsonStatus(
        {
          error: "Translation is temporarily unavailable. Contact Rapid Cortex support.",
          code: "translation_unavailable",
        },
        503,
      );
    }
    if (error instanceof VoiceProviderError) {
      return jsonStatus({ error: "Translation provider error", code: error.code }, 502);
    }
    console.error("[voice-bridge/outbound]", error instanceof Error ? error.name : "error", msg);
    return serverError();
  }
};
