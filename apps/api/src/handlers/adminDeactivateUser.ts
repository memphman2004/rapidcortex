import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { z } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { writeUserManagementAudit } from "../lib/writeAdminAudit.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
  badRequestFromZod,
} from "../lib/response.js";
import { AdminUserService } from "../services/adminUserService.js";

const service = new AdminUserService();

const bodySchema = z.object({
  username: z.string().min(1),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    await service.deactivate(user, parsed.data.username);
    await writeUserManagementAudit(user, AUDIT_EVENT_TYPES.ADMIN_USER_DEACTIVATE, {
      targetUsername: parsed.data.username,
    });
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return notFound("User not found");
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    if (error instanceof Error && error.message === "COGNITO_NOT_CONFIGURED") {
      return serviceUnavailable("Cognito user pool is not configured on this deployment");
    }
    return serverError();
  }
};
