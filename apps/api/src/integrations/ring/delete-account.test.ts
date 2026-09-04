import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";

const { getUserContext, isUserAccountActive, deleteHomeownerAccount } = vi.hoisted(() => ({
  getUserContext: vi.fn(),
  isUserAccountActive: vi.fn(() => true),
  deleteHomeownerAccount: vi.fn(),
}));

vi.mock("../../lib/auth.js", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  isUserAccountActive: (...args: unknown[]) => isUserAccountActive(...args),
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
}));

vi.mock("../../lib/operationalPasswordGate.js", () => ({
  operationalPasswordBlock: () => null,
}));

vi.mock("./homeowner-account-delete.js", () => ({
  deleteHomeownerAccount: (...args: unknown[]) => deleteHomeownerAccount(...args),
}));

vi.mock("./ring-api-response.js", () => ({
  ringJson: (body: unknown, statusCode = 200) => ({
    statusCode,
    body: JSON.stringify(body),
  }),
}));

import { handler } from "./delete-account.js";

function makeEvent(user: UserContext | null): APIGatewayProxyEventV2 {
  getUserContext.mockResolvedValue(user);
  return {
    version: "2.0",
    routeKey: "DELETE /api/user/account",
    rawPath: "/api/user/account",
    requestContext: {
      http: { method: "DELETE", path: "/api/user/account" },
    } as APIGatewayProxyEventV2["requestContext"],
    headers: {},
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;
}

function parse(result: unknown): { statusCode: number; body: { success: boolean; error?: string } } {
  const res = result as { statusCode: number; body: string };
  return { statusCode: res.statusCode, body: JSON.parse(res.body) as { success: boolean; error?: string } };
}

const homeowner: UserContext = {
  userId: "a4f8d458-c0a1-701c-dd0a-6222ebde6b60",
  agencyId: "test-agency",
  role: "homeowner",
  email: "owner@example.com",
};

const dispatcher: UserContext = {
  userId: "disp-1",
  agencyId: "test-agency",
  role: "dispatcher",
  email: "dispatcher@appsondemand.net",
};

describe("DELETE /api/user/account", () => {
  beforeEach(() => {
    getUserContext.mockReset();
    isUserAccountActive.mockReturnValue(true);
    deleteHomeownerAccount.mockReset();
    deleteHomeownerAccount.mockResolvedValue(undefined);
  });

  it("returns 401 when unauthenticated", async () => {
    const out = parse(await handler(makeEvent(null)));
    expect(out.statusCode).toBe(401);
    expect(out.body.success).toBe(false);
    expect(deleteHomeownerAccount).not.toHaveBeenCalled();
  });

  it("returns 403 for agency operator roles", async () => {
    const out = parse(await handler(makeEvent(dispatcher)));
    expect(out.statusCode).toBe(403);
    expect(out.body.error).toMatch(/Device Owner/i);
    expect(deleteHomeownerAccount).not.toHaveBeenCalled();
  });

  it("deletes the authenticated homeowner account", async () => {
    const out = parse(await handler(makeEvent(homeowner)));
    expect(out.statusCode).toBe(200);
    expect(out.body.success).toBe(true);
    expect(deleteHomeownerAccount).toHaveBeenCalledWith({
      userId: homeowner.userId,
      email: homeowner.email,
      agencyId: homeowner.agencyId,
    });
  });
});
