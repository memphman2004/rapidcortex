import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRingEnabled, RingOAuthService } from "../../lib/ring-integration.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson, ringRedirect } from "./ring-api-response.js";

const oauth = new RingOAuthService();
const accounts = new RingAccountRepository();
const OAUTH_STATE_TTL_SECONDS = 600;

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) {
      return ringJson({ success: false, error: "Unauthorized" }, 401);
    }
    if (!isUserAccountActive(user)) {
      return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) {
      return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
    }

    if (!isRingEnabled()) {
      return ringJson({ success: false, error: "Ring integration is not enabled." }, 403);
    }

    const { url, state } = await oauth.buildAuthorizationUrl(user.agencyId, user.userId);
    await accounts.saveOAuthState(user.agencyId, user.userId, state, OAUTH_STATE_TTL_SECONDS);

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_OAUTH_INITIATED,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: {},
    });

    return ringRedirect(url);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_login_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to start Ring authorization." }, 500);
  }
};
