import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createInvoiceBodySchema } from "rapid-cortex-shared";
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

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const agencyId = event.pathParameters?.id;
    if (!agencyId) return notFound("Agency id required");
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    const parsed = createInvoiceBodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const profile = await service.createInvoice(user, agencyId, parsed.data);
    return ok(profile, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
