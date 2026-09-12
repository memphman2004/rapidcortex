/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { handler as handleDelete } from "./homeowner-delete.js";
import { handler as handleLink } from "./homeowner-link.js";
import { handler as handleVerify } from "./homeowner-verify.js";
import { RING_INTEGRATION_ENABLED, ringIntegrationDisabledResponse } from "./ring-api-response.js";

/**
 * Public homeowner surface: POST /link, GET /verify, POST /delete-account.
 * One Lambda keeps stack-4 template size under the SAM transform proxy.
 */
export const handler: APIGatewayProxyHandlerV2 = (event, context, callback) => {
  // RING_DISABLED — integration suspended pending Ring developer program approval
  if (!RING_INTEGRATION_ENABLED) {
    return ringIntegrationDisabledResponse(event);
  }
  const path = `${event.rawPath ?? ""} ${event.requestContext?.http?.path ?? ""}`;
  if (path.includes("/homeowner/verify")) {
    return handleVerify(event, context, callback);
  }
  if (path.includes("/homeowner/delete-account")) {
    return handleDelete(event, context, callback);
  }
  return handleLink(event, context, callback);
};
