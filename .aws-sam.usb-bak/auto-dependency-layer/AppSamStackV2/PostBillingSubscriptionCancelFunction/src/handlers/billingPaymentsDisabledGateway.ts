import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { jsonStatus } from "../lib/response.js";

const BODY = {
  error: "payments_disabled",
  message: "Rapid Cortex payments are handled through agency procurement workflows.",
} as const;

/**
 * Deprecated card-processing HTTP surface. Responses are deterministic 410 so deploys remove live payment wiring.
 */
export const handler: APIGatewayProxyHandlerV2 = async () => jsonStatus(BODY, 410);
