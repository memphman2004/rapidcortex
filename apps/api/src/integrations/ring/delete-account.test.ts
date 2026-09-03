import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";

const {
  getUserContext,
  isUserAccountActive,
  cognitoSend,
  getLinkedAccount,
  deleteLinkedAccount,
  deleteOAuthState,
  deleteTokens,
  deleteLinkedDevices,
  auditRingEvent,
} = vi.hoisted(() => ({
  getUserContext: vi.fn(),
  isUserAccountActive: vi.fn(() => true),
  cognitoSend: vi.fn(),
  getLinkedAccount: vi.fn(),
  deleteLinkedAccount: vi.fn(),
  deleteOAuthState: vi.fn(),
  deleteTokens: vi.fn(),
  deleteLinkedDevices: vi.fn(),
  auditRingEvent: vi.fn(),
}));

vi.mock("../../lib/auth.js", () => ({
  getUserContext: (...args: unknown[]) => getUserContext(...args),
  isUserAccountActive: (...args: unknown[]) => isUserAccountActive(...args),
  ACCOUNT_INACTIVE_MESSAGE: "User account is not active.",
}));

vi.mock("../../lib/operationalPasswordGate.js", () => ({
  operationalPasswordBlock: () => null,
}));

vi.mock("../../lib/env.js", () => ({
  env: {
    region: "us-east-1",
    cognitoUserPoolId: "us-east-1_testpool",
    ringAccountsTable: "RapidCortexRingAccounts-test",
    ringDevicesTable: "RapidCortexRingDevices-test",
  },
}));

vi.mock("../../lib/ring-integration.js", () => ({
  isRingEnabled: () => true,
  RingTokenStore: class {
    deleteTokens = deleteTokens;
  },
  RingDeviceService: class {
    deleteLinkedDevices = deleteLinkedDevices;
  },
}));

vi.mock("../../repositories/ringAccountRepository.js", () => ({
  RingAccountRepository: class {
    getLinkedAccount = getLinkedAccount;
    deleteLinkedAccount = deleteLinkedAccount;
    deleteOAuthState = deleteOAuthState;
  },
}));

vi.mock("./ring-audit.js", () => ({
  auditRingEvent: (...args: unknown[]) => auditRingEvent(...args),
  AUDIT_EVENT_TYPES: {
    RING_ACCOUNT_UNLINKED: "ring.account.unlinked",
    RING_USER_ACCOUNT_DELETED: "ring.user.account_deleted",
  },
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => {
  class UserNotFoundException extends Error {
    name = "UserNotFoundException";
  }
  return {
    CognitoIdentityProviderClient: class {
      send = cognitoSend;
    },
    AdminGetUserCommand: class {
      constructor(public input: unknown) {}
    },
    AdminDisableUserCommand: class {
      constructor(public input: unknown) {}
    },
    AdminDeleteUserCommand: class {
      constructor(public input: unknown) {}
    },
    UserNotFoundException,
  };
});

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
    cognitoSend.mockReset();
    getLinkedAccount.mockReset();
    deleteLinkedAccount.mockReset();
    deleteOAuthState.mockReset();
    deleteTokens.mockReset();
    deleteLinkedDevices.mockReset();
    auditRingEvent.mockReset();
  });

  it("returns 401 when unauthenticated", async () => {
    const out = parse(await handler(makeEvent(null)));
    expect(out.statusCode).toBe(401);
    expect(out.body.success).toBe(false);
  });

  it("returns 403 for agency operator roles", async () => {
    const out = parse(await handler(makeEvent(dispatcher)));
    expect(out.statusCode).toBe(403);
    expect(out.body.error).toMatch(/Device Owner/i);
    expect(cognitoSend).not.toHaveBeenCalled();
  });

  it("disables then deletes the Cognito user and revokes Ring tokens", async () => {
    cognitoSend.mockImplementation(async (cmd: { constructor: { name: string }; input: { Username?: string } }) => {
      const name = cmd.constructor.name;
      if (name === "AdminGetUserCommand") {
        return { Username: cmd.input.Username };
      }
      return {};
    });
    getLinkedAccount.mockResolvedValue({
      agencyId: "test-agency",
      userId: homeowner.userId,
      secretsManagerTokenKey: "rapid-cortex/connect/ring/test-agency/u1",
    });
    deleteTokens.mockResolvedValue(undefined);
    deleteLinkedDevices.mockResolvedValue(2);
    deleteOAuthState.mockResolvedValue(undefined);
    deleteLinkedAccount.mockResolvedValue(undefined);
    auditRingEvent.mockResolvedValue(undefined);

    const out = parse(await handler(makeEvent(homeowner)));
    expect(out.statusCode).toBe(200);
    expect(out.body.success).toBe(true);
    expect(deleteTokens).toHaveBeenCalledWith("rapid-cortex/connect/ring/test-agency/u1");
    expect(deleteLinkedDevices).toHaveBeenCalledWith("test-agency", homeowner.userId);
    expect(deleteLinkedAccount).toHaveBeenCalledWith("test-agency", homeowner.userId);
    expect(cognitoSend).toHaveBeenCalled();
    const cmdNames = cognitoSend.mock.calls.map((c) => c[0].constructor.name);
    expect(cmdNames).toContain("AdminDisableUserCommand");
    expect(cmdNames).toContain("AdminDeleteUserCommand");
  });
});
