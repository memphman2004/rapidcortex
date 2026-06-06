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
import { AGENCY_ROLE_SCHEMA } from "rapid-cortex-shared";
import { AdminUserService } from "../services/adminUserService.js";

const service = new AdminUserService();

const bodySchema = z
  .object({
    username: z.string().min(1),
    agencyId: z.string().min(1).optional(),
    role: z.union([AGENCY_ROLE_SCHEMA, z.literal("rcsuperadmin"), z.literal("rcadmin"), z.literal("rcitadmin")]).optional(),
    passwordChangeRequired: z.boolean().optional(),
  })
  .refine((d) => d.agencyId != null || d.role != null || d.passwordChangeRequired != null, {
    message: "Provide agencyId, role, and/or passwordChangeRequired to update",
  });

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);

    const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const outcome = await service.updateAttributes(user, parsed.data);

    const requestId =
      (event.requestContext as { http?: { requestId?: string }; requestId?: string })?.requestId ??
      event.requestContext?.requestId ??
      "";

    const didRoleAgencyPatch =
      parsed.data.agencyId !== undefined || parsed.data.role !== undefined;

    if (outcome.didUpdateCognito && didRoleAgencyPatch) {
      await writeUserManagementAudit(user, AUDIT_EVENT_TYPES.ADMIN_USER_UPDATE, {
        targetUsername: parsed.data.username,
        agencyId: parsed.data.agencyId,
        role: parsed.data.role,
      });
    }

    if (outcome.passwordRequirementAudit) {
      await writeUserManagementAudit(
        user,
        AUDIT_EVENT_TYPES.PASSWORD_CHANGE_REQUIRED_SET,
        {
          actorUserId: user.userId,
          actorRole: user.role,
          targetUserId: outcome.passwordRequirementAudit.targetUserId,
          targetAgencyId: outcome.passwordRequirementAudit.targetAgencyId,
          timestamp: new Date().toISOString(),
          outcome: "success",
          requestId,
        },
        outcome.passwordRequirementAudit.targetUserId,
      );
    }

    if (!outcome.didUpdateCognito) {
      return ok({ ok: true, noop: true });
    }
    return ok({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return notFound("User not found");
    }
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
