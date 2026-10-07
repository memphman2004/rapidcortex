import { requiresOperationalPasswordRenewal, type UserContext } from "rapid-cortex-shared";
import { jsonStatus, unauthorized } from "./response.js";

/**
 * Blocks operational/API traffic when JWT indicates mandatory password rotation.
 * Call after `getUserContext` + `isUserAccountActive` (returns 401 when user is null).
 */
export function operationalPasswordBlock(user: UserContext | null) {
  if (!user) {
    return unauthorized();
  }
  if (requiresOperationalPasswordRenewal(user)) {
    return jsonStatus(
      {
        error: "password_change_required",
        message: "Password update is required before continuing.",
      },
      403,
    );
  }
  return null;
}
