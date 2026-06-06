import type { APIGatewayProxyResult } from "aws-lambda";

export function respond(
  statusCode: number,
  body: Record<string, unknown>,
  cors?: boolean,
): APIGatewayProxyResult {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cors) headers["Access-Control-Allow-Origin"] = "*";
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}
