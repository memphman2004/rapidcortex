import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { forbidden, notFound, ok, serverError, unauthorized } from "../lib/response.js";
import { BillingService } from "../services/billingService.js";

const service = new BillingService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const agencyId = event.pathParameters?.id;
    if (!agencyId) return notFound("Agency id required");
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const items = await service.listPaymentMethods(user, agencyId);
    return ok({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
