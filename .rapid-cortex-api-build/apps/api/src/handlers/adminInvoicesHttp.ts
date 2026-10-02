import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../lib/auth.js";
import { operationalPasswordBlock } from "../lib/operationalPasswordGate.js";
import { unauthorized } from "../lib/response.js";
import { handleAdminInvoicesRoute } from "../routes/billing/admin-invoices.js";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
        "Access-Control-Allow-Headers": "authorization,content-type",
      },
    };
  }

  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  const pwd = operationalPasswordBlock(user);
  if (pwd) return pwd;

  return handleAdminInvoicesRoute(
    {
      rawPath: event.rawPath,
      body: event.body,
      queryStringParameters: event.queryStringParameters,
      pathParameters: event.pathParameters,
      requestContext: event.requestContext,
      isBase64Encoded: event.isBase64Encoded,
    },
    user,
  );
};
