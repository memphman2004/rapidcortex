import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { unauthorized } from "../lib/response.js";
import { handleBillingInvoicesRoute } from "../routes/billing/invoices.js";
import { handleInvoiceItemsRoute } from "../routes/billing/invoice-items.js";
import { handleBillingPaymentsRoute } from "../routes/billing/payments.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
    };
  }

  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if ((event.rawPath ?? "").includes("/payments")) {
    return handleBillingPaymentsRoute(event, user);
  }
  if ((event.rawPath ?? "").includes("/items")) {
    return handleInvoiceItemsRoute(event, user);
  }
  return handleBillingInvoicesRoute(event, user);
};
