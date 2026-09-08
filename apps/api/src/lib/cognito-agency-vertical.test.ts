import { beforeEach, describe, expect, it, vi } from "vitest";

const { cognitoSend } = vi.hoisted(() => ({ cognitoSend: vi.fn() }));

vi.mock("./env.js", () => ({
  env: {
    region: "us-east-1",
    cognitoUserPoolId: "us-east-1_testpool",
  },
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => {
  return {
    CognitoIdentityProviderClient: class {
      send = cognitoSend;
    },
    AddCustomAttributesCommand: class {
      constructor(public input: unknown) {}
    },
    AdminUpdateUserAttributesCommand: class {
      constructor(public input: unknown) {}
    },
    ListUsersCommand: class {
      constructor(public input: unknown) {}
    },
  };
});

const { syncAgencyVerticalClaims } = await import("./cognito.js");

describe("syncAgencyVerticalClaims", () => {
  beforeEach(() => {
    cognitoSend.mockReset();
  });

  it("writes custom:agencyVertical for users in the agency", async () => {
    cognitoSend.mockImplementation(async (cmd: { constructor: { name: string }; input?: { Username?: string } }) => {
      if (cmd.constructor.name === "AddCustomAttributesCommand") return {};
      if (cmd.constructor.name === "ListUsersCommand") {
        return {
          Users: [
            {
              Username: "alice",
              Attributes: [{ Name: "custom:agencyId", Value: "kcpd" }],
            },
            {
              Username: "bob",
              Attributes: [{ Name: "custom:agencyId", Value: "other" }],
            },
          ],
        };
      }
      return {};
    });

    const n = await syncAgencyVerticalClaims("kcpd", "campus");
    expect(n).toBe(1);
    const updates = cognitoSend.mock.calls
      .map((c) => c[0] as { constructor: { name: string }; input?: { Username?: string; UserAttributes?: { Name: string; Value: string }[] } })
      .filter((c) => c.constructor.name === "AdminUpdateUserAttributesCommand");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.input?.Username).toBe("alice");
    expect(updates[0]?.input?.UserAttributes).toEqual([
      { Name: "custom:agencyVertical", Value: "campus" },
    ]);
  });

  it("ignores unknown operational profiles", async () => {
    await expect(syncAgencyVerticalClaims("kcpd", "hospital")).resolves.toBe(0);
    expect(cognitoSend).not.toHaveBeenCalled();
  });
});
