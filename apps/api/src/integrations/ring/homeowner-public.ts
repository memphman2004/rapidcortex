import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { handler as handleLink } from "./homeowner-link.js";
import { handler as handleVerify } from "./homeowner-verify.js";

/**
 * Public homeowner surface: POST /link (Appstore + consent signup) and GET /verify (email confirm).
 * One Lambda keeps stack-4 template size under the SAM transform proxy.
 */
export const handler: APIGatewayProxyHandlerV2 = (event, context, callback) => {
  const path = `${event.rawPath ?? ""} ${event.requestContext?.http?.path ?? ""}`;
  if (path.includes("/homeowner/verify")) {
    return handleVerify(event, context, callback);
  }
  return handleLink(event, context, callback);
};
