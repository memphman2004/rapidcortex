import type { APIGatewayProxyResultV2 } from "aws-lambda";

export function ringJson<T>(
  body: { success: boolean; data?: T; error?: string },
  statusCode = 200,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function ringRedirect(location: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 302,
    headers: { Location: location },
    body: "",
  };
}

export function ringHtml(body: string, statusCode = 200): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body,
  };
}
