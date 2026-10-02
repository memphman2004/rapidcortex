import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

/**
 * Health must not import `../lib/response` — that module pulls network-access →
 * DynamoDB SDK → `@aws-sdk/endpoint-cache` → `mnemonist/lru-cache`. A missing
 * transitive dep then crashes the function at init (500) before this handler runs.
 */
export const handler: APIGatewayProxyHandlerV2 = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "ok",
      service: "rapid-cortex-api",
      deploymentStage: process.env.DEPLOYMENT_STAGE?.trim() || "unknown",
      /** Distinguishes HttpApi stacks 1–5 when the same handler is mounted on each. */
      stackId: process.env.HEALTH_STACK_ID?.trim() || undefined,
      /** Set in CI/CD or Lambda console for traceability (optional). */
      revision: process.env.REVISION?.trim() || process.env.GIT_SHA?.trim() || undefined,
    }),
  };
};
