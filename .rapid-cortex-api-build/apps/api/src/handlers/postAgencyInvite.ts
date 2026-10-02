import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createInviteBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
  badRequestFromZod,
} from "../lib/response.js";
import { UserProvisioningService } from "../services/userProvisioningService.js";

const service = new UserProvisioningService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const agencyId = event.pathParameters?.id;
    if (!agencyId) return notFound("Agency id required");
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const parsed = createInviteBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const invite = await service.createInvite(user, agencyId, parsed.data);
    return ok(invite, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
