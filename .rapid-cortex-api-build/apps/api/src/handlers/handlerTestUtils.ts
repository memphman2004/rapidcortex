import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";
import type { JWTPayload } from "jose";

const stubContext = {} as Context;

/** Invoke HTTP API v2 handlers in tests (passes stub context + callback). */
export async function invokeHttpHandler(
  handler: APIGatewayProxyHandlerV2,
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  const res = await handler(event, stubContext, () => {});
  if (res == null || typeof res === "string") {
    throw new Error("Handler returned unexpected response shape");
  }
  return res;
}

/** Minimal API Gateway HTTP API v2 event with Cognito JWT authorizer claims (no bearer crypto). */
export function makeAuthenticatedEvent(opts: {
  role: string;
  agencyId: string;
  accountStatus?: string;
  userId?: string;
  email?: string;
  /** ISO timestamp — avoids `PASSWORD_CHANGE_REQUIRED_ON_FIRST_LOGIN` / missing-timestamp churn in handlers. */
  passwordLastChangedAt?: string;
  passwordChangeRequired?: boolean;
  pathParameters?: APIGatewayProxyEventV2["pathParameters"];
  queryStringParameters?: APIGatewayProxyEventV2["queryStringParameters"];
  body?: string;
  rawPath?: string;
  routeKey?: string;
}): APIGatewayProxyEventV2 {
  const claims: JWTPayload = {
    sub: opts.userId ?? "test-user",
    "custom:role": opts.role,
    "custom:agencyId": opts.agencyId,
    "custom:status": opts.accountStatus ?? "active",
    "custom:pwdChangedAt": opts.passwordLastChangedAt ?? new Date().toISOString(),
    "custom:pwdChangeReq": opts.passwordChangeRequired === true ? "true" : "false",
    ...(opts.email ? { email: opts.email } : {}),
  };
  return {
    version: "2.0",
    routeKey: opts.routeKey ?? "GET /api/mock",
    rawPath: opts.rawPath ?? "/api/mock",
    rawQueryString: "",
    pathParameters: opts.pathParameters,
    queryStringParameters: opts.queryStringParameters,
    headers: {},
    requestContext: {
      http: {
        method: (opts.routeKey ?? "GET /api/mock").split(" ")[0] ?? "GET",
        path: opts.rawPath ?? "/api/mock",
      },
      authorizer: {
        jwt: { claims },
      },
    } as unknown as APIGatewayProxyEventV2["requestContext"],
    body: opts.body,
    isBase64Encoded: false,
  };
}

/** API Gateway HTTP API v2 event with no JWT claims and no Bearer header (anonymous caller). */
export function makeUnauthenticatedEvent(opts: {
  routeKey?: string;
  rawPath?: string;
  pathParameters?: APIGatewayProxyEventV2["pathParameters"];
  queryStringParameters?: APIGatewayProxyEventV2["queryStringParameters"];
  headers?: Record<string, string | undefined>;
  body?: string | null;
}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: opts.routeKey ?? "GET /api/incidents",
    rawPath: opts.rawPath ?? "/api/incidents",
    rawQueryString: "",
    pathParameters: opts.pathParameters,
    queryStringParameters: opts.queryStringParameters,
    headers: opts.headers ?? {},
    requestContext: {
      requestId: "vitest-unauth",
      http: {
        method: (opts.routeKey ?? "GET /api/incidents").split(" ")[0] ?? "GET",
        path: opts.rawPath ?? "/api/incidents",
      },
    } as unknown as APIGatewayProxyEventV2["requestContext"],
    body: opts.body ?? undefined,
    isBase64Encoded: false,
  };
}
