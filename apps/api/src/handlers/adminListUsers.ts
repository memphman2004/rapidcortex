import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { forbidden, ok, serverError, serviceUnavailable, unauthorized } from "../lib/response.js";
import { AdminUserService } from "../services/adminUserService.js";

const service = new AdminUserService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const items = await service.list(user);
    return ok({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    if (error instanceof Error && error.message === "COGNITO_NOT_CONFIGURED") {
      return serviceUnavailable("Cognito user pool is not configured on this deployment");
    }
    const name = error instanceof Error ? error.name : "";
    if (name === "AccessDeniedException" || name === "NotAuthorizedException") {
      console.error(
        JSON.stringify({
          msg: "admin_list_users_cognito_denied",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return serviceUnavailable("User directory is temporarily unavailable.");
    }
    console.error(
      JSON.stringify({
        msg: "admin_list_users_error",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return serverError();
  }
};
