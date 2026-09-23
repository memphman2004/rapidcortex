import type { APIGatewayProxyResultV2 } from "aws-lambda";

/**
 * `{ success, data?, error? }` JSON envelope used by Rapid Vision™ HTTP handlers.
 * Distinct from `lib/response.ts`, which emits the bare `{ error }` PSAP shape.
 */
export function jsonOk<T>(data: T, statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, data }),
  };
}

export function jsonError(error: string, statusCode: number): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: false, error }),
  };
}
