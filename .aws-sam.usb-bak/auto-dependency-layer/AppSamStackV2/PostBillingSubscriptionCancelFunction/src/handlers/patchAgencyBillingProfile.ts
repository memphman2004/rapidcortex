import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { patchAgencyBillingProfileSchema } from "rapid-cortex-shared";
import { AuthorizationService } from "rapid-cortex-security";
import { isRcInternalOperator } from "rapid-cortex-shared";
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
import { BillingService } from "../services/billingService.js";

const service = new BillingService();
const auth = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const agencyId = event.pathParameters?.id;
    if (!agencyId) return notFound("Agency id required");
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!isRcInternalOperator(user.role)) {
      auth.assertCanPerform(user, "billing.manage");
    }
    const parsed = patchAgencyBillingProfileSchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const profile = await service.patchProfile(user, agencyId, parsed.data);
    return ok(profile);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const statusCode = (error as Error & { statusCode?: number }).statusCode;
    if (msg === "FORBIDDEN_PERMISSION" && statusCode === 403) return forbidden();
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
