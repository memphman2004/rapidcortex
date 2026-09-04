import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  cognitoSend,
  getLinkedAccount,
  deleteLinkedAccount,
  deleteOAuthState,
  deleteTokens,
  deleteLinkedDevices,
  auditRingEvent,
  listByAgencyId,
  markExpired,
  deleteOwner,
} = vi.hoisted(() => ({
  cognitoSend: vi.fn(),
  getLinkedAccount: vi.fn(),
  deleteLinkedAccount: vi.fn(),
  deleteOAuthState: vi.fn(),
  deleteTokens: vi.fn(),
  deleteLinkedDevices: vi.fn(),
  auditRingEvent: vi.fn(),
  listByAgencyId: vi.fn(),
  markExpired: vi.fn(),
  deleteOwner: vi.fn(),
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

vi.mock("../../repositories/ringCitizenOwnerRepository.js", () => ({
  RingCitizenOwnerRepository: class {
    delete = deleteOwner;
  },
}));

vi.mock("../../repositories/ringHomeownerParticipantRepository.js", () => ({
  RingHomeownerParticipantRepository: class {
    listByAgencyId = listByAgencyId;
    markExpired = markExpired;
  },
}));

vi.mock("./ring-audit.js", () => ({
  auditRingEvent: (...args: unknown[]) => auditRingEvent(...args),
  AUDIT_EVENT_TYPES: {
    RING_ACCOUNT_UNLINKED: "ring.account.unlinked",
    RING_USER_ACCOUNT_DELETED: "ring.user.account_deleted",
  },
}));

vi.mock("./ring-tables.js", () => ({
  configureRingEmergencyTables: () => undefined,
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

import { deleteHomeownerAccount } from "./homeowner-account-delete.js";

describe("deleteHomeownerAccount", () => {
  beforeEach(() => {
    cognitoSend.mockReset();
    getLinkedAccount.mockReset();
    deleteLinkedAccount.mockReset();
    deleteOAuthState.mockReset();
    deleteTokens.mockReset();
    deleteLinkedDevices.mockReset();
    auditRingEvent.mockReset();
    listByAgencyId.mockReset();
    markExpired.mockReset();
    deleteOwner.mockReset();
    listByAgencyId.mockResolvedValue([]);
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
      userId: "user-sub-1",
      secretsManagerTokenKey: "rapid-cortex/connect/ring/test-agency/u1",
    });
    deleteTokens.mockResolvedValue(undefined);
    deleteLinkedDevices.mockResolvedValue(2);
    deleteOAuthState.mockResolvedValue(undefined);
    deleteLinkedAccount.mockResolvedValue(undefined);
    auditRingEvent.mockResolvedValue(undefined);

    await deleteHomeownerAccount({
      userId: "user-sub-1",
      email: "owner@example.com",
      agencyId: "test-agency",
    });

    expect(deleteTokens).toHaveBeenCalledWith("rapid-cortex/connect/ring/test-agency/u1");
    expect(deleteLinkedDevices).toHaveBeenCalledWith("test-agency", "user-sub-1");
    expect(deleteLinkedAccount).toHaveBeenCalledWith("test-agency", "user-sub-1");
    const cmdNames = cognitoSend.mock.calls.map((c) => (c[0] as { constructor: { name: string } }).constructor.name);
    expect(cmdNames).toContain("AdminDisableUserCommand");
    expect(cmdNames).toContain("AdminDeleteUserCommand");
    expect(auditRingEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ring.user.account_deleted" }),
    );
  });
});
