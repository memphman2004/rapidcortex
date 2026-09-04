import { beforeEach, describe, expect, it, vi } from "vitest";

const { cognitoSend, storeHomeownerVerificationToken, sendHomeownerVerificationEmail } = vi.hoisted(
  () => ({
    cognitoSend: vi.fn(),
    storeHomeownerVerificationToken: vi.fn(),
    sendHomeownerVerificationEmail: vi.fn(),
  }),
);

vi.mock("../../lib/env.js", () => ({
  env: {
    region: "us-east-1",
    cognitoUserPoolId: "us-east-1_testpool",
    sesMock: true,
  },
}));

vi.mock("../../lib/ring-integration.js", () => ({
  RING_HOMEOWNER_DEFAULT_AGENCY_ID: "test-agency",
}));

vi.mock("../../lib/assign-cognito-vertical-group.js", () => ({
  assignCognitoVerticalGroup: vi.fn(async () => undefined),
}));

vi.mock("./homeowner-email-verify.js", () => ({
  newHomeownerVerificationToken: () => "v".repeat(32),
  storeHomeownerVerificationToken: (...args: unknown[]) => storeHomeownerVerificationToken(...args),
  sendHomeownerVerificationEmail: (...args: unknown[]) => sendHomeownerVerificationEmail(...args),
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => {
  class UsernameExistsException extends Error {
    name = "UsernameExistsException";
  }
  return {
    CognitoIdentityProviderClient: class {
      send = cognitoSend;
    },
    AdminCreateUserCommand: class {
      constructor(public input: unknown) {}
    },
    AdminSetUserPasswordCommand: class {
      constructor(public input: unknown) {}
    },
    AdminUpdateUserAttributesCommand: class {
      constructor(public input: unknown) {}
    },
    AdminDisableUserCommand: class {
      constructor(public input: unknown) {}
    },
    AdminEnableUserCommand: class {
      constructor(public input: unknown) {}
    },
    AdminGetUserCommand: class {
      constructor(public input: unknown) {}
    },
    InitiateAuthCommand: class {
      constructor(public input: unknown) {}
    },
    ForgotPasswordCommand: class {
      constructor(public input: unknown) {}
    },
    ConfirmForgotPasswordCommand: class {
      constructor(public input: unknown) {}
    },
    UsernameExistsException,
    UserNotFoundException: class extends Error {
      name = "UserNotFoundException";
    },
  };
});

function idTokenFor(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub }), "utf8").toString("base64url");
  return `eyJhbGciOiJub25lIn0.${payload}.x`;
}

describe("authenticateHomeowner signup lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COGNITO_CLIENT_ID = "test-client";
    cognitoSend.mockImplementation(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === "InitiateAuthCommand") {
        return { AuthenticationResult: { IdToken: idTokenFor("user-sub-1") } };
      }
      return {};
    });
  });

  it("creates the user suppressed, then disables until email verification", async () => {
    const { authenticateHomeowner } = await import("./homeowner-cognito.js");
    const result = await authenticateHomeowner({
      email: "owner@example.com",
      password: "RapidCore2027!",
      mode: "signup",
    });

    expect(result.created).toBe(true);
    const created = cognitoSend.mock.calls.find(
      (call) => call[0]?.constructor?.name === "AdminCreateUserCommand",
    )?.[0] as { input: { MessageAction?: string; UserAttributes?: { Name: string; Value: string }[] } };
    expect(created.input.MessageAction).toBe("SUPPRESS");
    expect(created.input.UserAttributes).toEqual(
      expect.arrayContaining([{ Name: "email_verified", Value: "false" }]),
    );

    expect(storeHomeownerVerificationToken).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@example.com",
        cognitoUsername: "owner@example.com",
      }),
    );
    expect(sendHomeownerVerificationEmail).toHaveBeenCalledWith("owner@example.com", "v".repeat(32));

    const disabled = cognitoSend.mock.calls.filter(
      (call) => call[0]?.constructor?.name === "AdminDisableUserCommand",
    );
    expect(disabled).toHaveLength(1);
  });
});

describe("resolveHomeownerForDeletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COGNITO_CLIENT_ID = "test-client";
  });

  it("returns identity for a homeowner without signing in", async () => {
    cognitoSend.mockImplementation(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === "AdminGetUserCommand") {
        return {
          Username: "owner@example.com",
          Enabled: false,
          UserAttributes: [
            { Name: "custom:role", Value: "homeowner" },
            { Name: "custom:agencyId", Value: "test-agency" },
            { Name: "sub", Value: "user-sub-1" },
          ],
        };
      }
      return {};
    });

    const { resolveHomeownerForDeletion } = await import("./homeowner-cognito.js");
    const result = await resolveHomeownerForDeletion("owner@example.com");

    expect(result).toEqual({
      userId: "user-sub-1",
      email: "owner@example.com",
      agencyId: "test-agency",
    });
    const names = cognitoSend.mock.calls.map((c) => (c[0] as { constructor: { name: string } }).constructor.name);
    expect(names).toEqual(["AdminGetUserCommand"]);
  });

  it("returns null for non-homeowner accounts", async () => {
    cognitoSend.mockImplementation(async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === "AdminGetUserCommand") {
        return {
          Username: "dispatcher@appsondemand.net",
          Enabled: true,
          UserAttributes: [{ Name: "custom:role", Value: "dispatcher" }],
        };
      }
      return {};
    });

    const { resolveHomeownerForDeletion } = await import("./homeowner-cognito.js");
    await expect(resolveHomeownerForDeletion("dispatcher@appsondemand.net")).resolves.toBeNull();
  });
});

