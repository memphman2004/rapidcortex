import { afterEach, describe, expect, it } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getUserContext, isUserAccountActive } from "./auth.js";

function makeEvent(claims?: Record<string, string>): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /api/mock",
    rawPath: "/api/mock",
    rawQueryString: "",
    headers: {},
    requestContext: {
      authorizer: claims ? { jwt: { claims } } : undefined,
    } as APIGatewayProxyEventV2["requestContext"],
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe("auth runtime hardening", () => {
  afterEach(() => {
    delete process.env.ALLOW_UNAUTHENTICATED_API;
    delete process.env.DEPLOYMENT_STAGE;
    delete process.env.NODE_ENV;
  });

  it("allows unauthenticated bypass in local development", async () => {
    process.env.ALLOW_UNAUTHENTICATED_API = "true";
    process.env.DEPLOYMENT_STAGE = "dev";
    process.env.NODE_ENV = "development";

    const user = await getUserContext(makeEvent());
    expect(user?.userId).toBe("demo-user");
  });

  it("falls back to HttpApi JWT authorizer claims when Bearer jose verify fails", async () => {
    const user = await getUserContext({
      version: "2.0",
      routeKey: "GET /api/agencies/{id}",
      rawPath: "/api/agencies/test-campus-uga",
      rawQueryString: "",
      headers: { authorization: "Bearer not-a-valid-jwt" },
      requestContext: {
        authorizer: {
          jwt: {
            claims: {
              sub: "campus-admin-1",
              "custom:role": "CAMPUS_ADMIN",
              "custom:agencyId": "test-campus-uga",
              email: "campusadmin@uga.edu",
            },
          },
        },
      } as APIGatewayProxyEventV2["requestContext"],
      isBase64Encoded: false,
    } as APIGatewayProxyEventV2);

    expect(user).not.toBeNull();
    expect(user?.userId).toBe("campus-admin-1");
    expect(user?.agencyId).toBe("test-campus-uga");
  });

  it("treats missing custom:status as active; blocks explicit inactive statuses", async () => {
    const noStatus = await getUserContext(
      makeEvent({
        sub: "u-1",
        "custom:role": "dispatcher",
        "custom:agencyId": "test-agency",
      }),
    );
    const active = await getUserContext(
      makeEvent({
        sub: "u-2",
        "custom:role": "dispatcher",
        "custom:agencyId": "test-agency",
        "custom:status": "active",
      }),
    );
    const inactive = await getUserContext(
      makeEvent({
        sub: "u-3",
        "custom:role": "dispatcher",
        "custom:agencyId": "test-agency",
        "custom:status": "inactive",
      }),
    );
    expect(noStatus).not.toBeNull();
    expect(active).not.toBeNull();
    expect(inactive).toBeNull();
    expect(isUserAccountActive(noStatus!)).toBe(true);
    expect(isUserAccountActive(active!)).toBe(true);
  });
});
