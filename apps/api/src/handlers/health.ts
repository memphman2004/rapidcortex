import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ok } from "../lib/response.js";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  return ok({
    status: "ok",
    service: "rapid-cortex-api",
    deploymentStage: process.env.DEPLOYMENT_STAGE?.trim() || "unknown",
    /** Set in CI/CD or Lambda console for traceability (optional). */
    revision: process.env.REVISION?.trim() || process.env.GIT_SHA?.trim() || undefined,
  });
};
