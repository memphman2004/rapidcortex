import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { z } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { writeUserManagementAudit } from "../lib/writeAdminAudit.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
  badRequestFromZod,
} from "../lib/response.js";
import { AGENCY_ROLE_SCHEMA } from "rapid-cortex-shared";
import { AdminUserService } from "../services/adminUserService.js";

const service = new AdminUserService();

const bodySchema = z.object({
  email: z.string().email(),
  agencyId: z.string().min(1),
  role: AGENCY_ROLE_SCHEMA,
  temporaryPassword: z.string().min(12),
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const created = await service.create(user, parsed.data);
    await writeUserManagementAudit(user, AUDIT_EVENT_TYPES.ADMIN_USER_CREATE, {
      email: created.email,
      agencyId: created.agencyId,
      role: created.role,
    });
    return ok(created, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    if (error instanceof Error && error.message === "INVALID_ROLE") {
      return badRequest("Invalid role");
    }
    if (error instanceof Error && error.message === "COGNITO_NOT_CONFIGURED") {
      return serviceUnavailable("Cognito user pool is not configured on this deployment");
    }
    return serverError();
  }
};
