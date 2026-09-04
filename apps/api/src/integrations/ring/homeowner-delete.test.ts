import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const { resolveHomeownerForDeletion, deleteHomeownerAccount, consumeRingPublicOAuthRateSlot, isRingEnabled } =
  vi.hoisted(() => ({
    resolveHomeownerForDeletion: vi.fn(),
    deleteHomeownerAccount: vi.fn(),
    consumeRingPublicOAuthRateSlot: vi.fn(async () => true),
    isRingEnabled: vi.fn(() => true),
  }));

vi.mock("../../lib/ring-integration.js", () => ({
  isRingEnabled: () => isRingEnabled(),
}));

vi.mock("./homeowner-cognito.js", () => ({
  resolveHomeownerForDeletion: (...args: unknown[]) => resolveHomeownerForDeletion(...args),
}));

vi.mock("./homeowner-account-delete.js", () => ({
  deleteHomeownerAccount: (...args: unknown[]) => deleteHomeownerAccount(...args),
}));

vi.mock("./ring-consent-rate-limit.js", () => ({
  consumeRingPublicOAuthRateSlot: (...args: unknown[]) => consumeRingPublicOAuthRateSlot(...args),
}));

import { handler } from "./homeowner-delete.js";

function event(body: unknown): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    rawPath: "/api/public/ring/homeowner/delete-account",
    requestContext: {
      http: { method: "POST", path: "/api/public/ring/homeowner/delete-account" },
    } as APIGatewayProxyEventV2["requestContext"],
    headers: { origin: "https://www.rapidcortex.us" },
    body: JSON.stringify(body),
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function parse(result: unknown): {
  statusCode: number;
  body: { success: boolean; error?: string; data?: { message?: string } };
} {
  const res = result as { statusCode: number; body: string };
  return {
    statusCode: res.statusCode,
    body: JSON.parse(res.body) as { success: boolean; error?: string; data?: { message?: string } },
  };
}

describe("POST /api/public/ring/homeowner/delete-account", () => {
  beforeEach(() => {
    resolveHomeownerForDeletion.mockReset();
    deleteHomeownerAccount.mockReset();
    consumeRingPublicOAuthRateSlot.mockResolvedValue(true);
    isRingEnabled.mockReturnValue(true);
  });

  it("returns 400 for invalid email", async () => {
    const out = parse(await handler(event({ email: "not-an-email" })));
    expect(out.statusCode).toBe(400);
    expect(resolveHomeownerForDeletion).not.toHaveBeenCalled();
  });

  it("does not delete unknown or non-homeowner emails", async () => {
    resolveHomeownerForDeletion.mockResolvedValue(null);
    const out = parse(await handler(event({ email: "dispatcher@appsondemand.net" })));
    expect(out.statusCode).toBe(200);
    expect(out.body.success).toBe(true);
    expect(deleteHomeownerAccount).not.toHaveBeenCalled();
  });

  it("deletes a homeowner by email", async () => {
    resolveHomeownerForDeletion.mockResolvedValue({
      userId: "user-sub-1",
      email: "owner@example.com",
      agencyId: "test-agency",
    });
    deleteHomeownerAccount.mockResolvedValue(undefined);
    const out = parse(await handler(event({ email: "owner@example.com" })));
    expect(out.statusCode).toBe(200);
    expect(out.body.data?.message).toBe("Account deleted.");
    expect(deleteHomeownerAccount).toHaveBeenCalledWith({
      userId: "user-sub-1",
      email: "owner@example.com",
      agencyId: "test-agency",
    });
  });
});
