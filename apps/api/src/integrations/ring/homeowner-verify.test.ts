import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const { consumeHomeownerVerificationToken, enableVerifiedHomeowner, auditRingEvent } = vi.hoisted(
  () => ({
    consumeHomeownerVerificationToken: vi.fn(),
    enableVerifiedHomeowner: vi.fn(),
    auditRingEvent: vi.fn(),
  }),
);

vi.mock("./homeowner-email-verify.js", () => ({
  consumeHomeownerVerificationToken: (...args: unknown[]) => consumeHomeownerVerificationToken(...args),
  enableVerifiedHomeowner: (...args: unknown[]) => enableVerifiedHomeowner(...args),
  homeownerSignInUrl: () => "https://www.rapidcortex.us/connect/ring/start",
}));

vi.mock("./ring-audit.js", () => ({
  auditRingEvent: (...args: unknown[]) => auditRingEvent(...args),
  AUDIT_EVENT_TYPES: { RING_HOMEOWNER_EMAIL_VERIFIED: "ring.homeowner.email_verified" },
}));

vi.mock("./ring-tables.js", () => ({
  configureRingEmergencyTables: vi.fn(),
}));

function getEvent(token?: string, accept = "application/json"): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "GET /api/public/ring/homeowner/verify",
    rawPath: "/api/public/ring/homeowner/verify",
    rawQueryString: token ? `token=${token}` : "",
    headers: { accept, origin: "https://www.rapidcortex.us" },
    queryStringParameters: token ? { token } : {},
    requestContext: { http: { method: "GET", sourceIp: "1.1.1.1" } },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

describe("homeowner email verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for a missing or unknown token", async () => {
    consumeHomeownerVerificationToken.mockResolvedValue(null);
    const { handler } = await import("./homeowner-verify.js");
    const missing = await handler(getEvent());
    expect(missing).toMatchObject({ statusCode: 403 });
    const unknown = await handler(getEvent("x".repeat(24)));
    expect(unknown).toMatchObject({ statusCode: 403 });
    expect(JSON.parse(String((unknown as { body: string }).body))).toEqual({ error: "Forbidden" });
    expect(enableVerifiedHomeowner).not.toHaveBeenCalled();
  });

  it("enables the Cognito user and deletes the pending token", async () => {
    consumeHomeownerVerificationToken.mockResolvedValue({
      email: "owner@example.com",
      cognitoUsername: "owner@example.com",
      agencyId: "test-agency",
    });
    const { handler } = await import("./homeowner-verify.js");
    const res = await handler(getEvent("y".repeat(24)));
    expect(res).toMatchObject({ statusCode: 200 });
    expect(enableVerifiedHomeowner).toHaveBeenCalledWith("owner@example.com");
    expect(consumeHomeownerVerificationToken).toHaveBeenCalledWith("y".repeat(24));
  });
});
