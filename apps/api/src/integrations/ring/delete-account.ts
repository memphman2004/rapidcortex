/**
 * DELETE /api/user/account
 * Permanently deletes the authenticated Ring Device Owner Cognito account and
 * revokes linked Ring OAuth tokens. Required for Ring developer certification.
 *
 * Homeowners typically delete from the Account Link URL (public email+password).
 * This JWT path remains for a homeowner session if one exists.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { deleteHomeownerAccount } from "./homeowner-account-delete.js";
import { ringJson } from "./ring-api-response.js";

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

    // In-app deletion is the Ring Device Owner (homeowner) self-service path.
    // Agency operator accounts are provisioned/deprovisioned by admins.
    if (String(user.role).trim().toLowerCase() !== "homeowner") {
      return ringJson(
        { success: false, error: "Only Ring Device Owner accounts can be deleted in-app." },
        403,
      );
    }

    await deleteHomeownerAccount({
      userId: user.userId,
      email: user.email,
      agencyId: user.agencyId,
    });

    return ringJson({ success: true, data: { message: "Account deleted." } }, 200);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "delete_account_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to delete account." }, 500);
  }
};
