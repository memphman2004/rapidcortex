import { describe, it, expect, vi, beforeEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";

const {
  mockPut,
  mockGet,
  mockQueryByAgency,
  mockQueryByAgencyAndTargetUser,
  mockUpdateRevoked,
  mockAuditCreate,
  mockSend,
} = vi.hoisted(() => ({
  mockPut: vi.fn(),
  mockGet: vi.fn(),
  mockQueryByAgency: vi.fn(),
  mockQueryByAgencyAndTargetUser: vi.fn(),
  mockUpdateRevoked: vi.fn(),
  mockAuditCreate: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = mockAuditCreate;
  },
}));

vi.mock("../../repositories/accessOverrideRepository.js", () => ({
  AccessOverrideRepository: class {
    put = mockPut;
    get = mockGet;
    queryByAgency = mockQueryByAgency;
    queryByAgencyAndTargetUser = mockQueryByAgencyAndTargetUser;
    updateRevoked = mockUpdateRevoked;
  },
}));

vi.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: class {
    send = mockSend;
  },
  AdminGetUserCommand: class {
    declare input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
  AdminUpdateUserAttributesCommand: class {
    declare input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
  ListUsersCommand: class {
    declare input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  },
}));

import { AccessOverrideService } from "../accessOverrideService.js";

function apiEvent(extra?: Partial<APIGatewayProxyEventV2>): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "POST /api/agency-admin/overrides",
    rawPath: "/api/agency-admin/overrides",
    rawQueryString: "",
    headers: { "user-agent": "vitest" },
    requestContext: {
      requestId: "req-test-1",
      http: { sourceIp: "203.0.113.50" },
    },
    ...(extra ?? {}),
  } as APIGatewayProxyEventV2;
}

function cognitoAttrs(agencyId: string, sub = "target-sub", email = "target@agency-a.example") {
  return [
    { Name: "sub", Value: sub },
    { Name: "email", Value: email },
    { Name: "custom:agencyId", Value: agencyId },
    { Name: "given_name", Value: "Target" },
    { Name: "family_name", Value: "User" },
  ];
}

describe("AccessOverrideService (integration with mocked persistence)", () => {
  const svc = new AccessOverrideService();

  const adminSameAgency = {
    userId: "admin-sub",
    agencyId: "agency-a",
    role: "agencyadmin",
    email: "admin@agency-a.example",
  } satisfies UserContext;

  const dispatcher = {
    userId: "disp-sub",
    agencyId: "agency-a",
    role: "dispatcher",
    email: "disp@agency-a.example",
  } satisfies UserContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditCreate.mockResolvedValue(undefined);
    mockPut.mockResolvedValue(undefined);
    mockUpdateRevoked.mockResolvedValue(undefined);
    mockQueryByAgencyAndTargetUser.mockResolvedValue([]);
    mockSend.mockImplementation(async (cmd: unknown) => {
      const c = cmd as {
        constructor: { name: string };
        input?: Record<string, unknown>;
      };
      if (c.constructor.name.includes("AdminGetUser")) {
        const username = String(c.input?.Username ?? "");
        if (username === "evil-other-agency-target") {
          return {
            Username: username,
            UserAttributes: cognitoAttrs("agency-b", "other-agency-sub"),
          };
        }
        return {
          Username: username || "cognito-u",
          UserAttributes: cognitoAttrs("agency-a"),
        };
      }
      if (c.constructor.name.includes("AdminUpdateUserAttributes")) return {};
      return {};
    });
  });

  it("agency admin grants override for user in same agency and writes audit ACCESS_OVERRIDE_GRANTED", async () => {
    const out = await svc.grant(
      adminSameAgency,
      {
        targetUserId: "subject-username-or-sub",
        overrideType: "feature",
        grantedRoleOrPermission: "feature:silent_text",
        reason: "Temporary coverage gap",
      },
      apiEvent(),
    );

    expect(out.agencyId).toBe("agency-a");
    expect(out.status).toBe("active");
    expect(mockPut).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);

    const auditArg = mockAuditCreate.mock.calls[0][0];
    expect(auditArg.type).toBe("access.override.granted");
    expect(auditArg.details).toMatchObject({
      eventType: "ACCESS_OVERRIDE_GRANTED",
      action: "grant",
      actorEmail: adminSameAgency.email,
      targetUserId: "target-sub",
    });
    expect(auditArg.resourceId).toBe("target-sub");
    expect(mockUpdateRevoked).not.toHaveBeenCalled();
  });

  it("does not permit grant when target is in another agency", async () => {
    mockSend.mockImplementation(async (cmd: unknown) => {
      const c = cmd as {
        constructor: { name: string };
        input?: Record<string, unknown>;
      };
      if (c.constructor.name.includes("AdminGetUser")) {
        return {
          Username: String(c.input?.Username ?? "u"),
          UserAttributes: cognitoAttrs("agency-z", "bogus"),
        };
      }
      return {};
    });

    await expect(
      svc.grant(
        adminSameAgency,
        {
          targetUserId: "agent-user-one",
          overrideType: "feature",
          grantedRoleOrPermission: "feature:silent_text",
          reason: "Should not succeed",
        },
        apiEvent(),
      ),
    ).rejects.toMatchObject({ message: "FORBIDDEN" });
    expect(mockPut).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("non-admin receives FORBIDDEN on grant", async () => {
    await expect(
      svc.grant(
        dispatcher,
        {
          targetUserId: "any",
          overrideType: "feature",
          grantedRoleOrPermission: "feature:silent_text",
          reason: "Should not authorize",
        },
        apiEvent(),
      ),
    ).rejects.toMatchObject({ message: "FORBIDDEN" });
  });

  it("blocks self-grant by matching sub / email", async () => {
    await expect(
      svc.grant(
        { ...adminSameAgency, userId: "target-sub", email: "target@agency-a.example" },
        {
          targetUserId: "target-sub",
          overrideType: "feature",
          grantedRoleOrPermission: "feature:silent_text",
          reason: "Self grant attempt",
        },
        apiEvent(),
      ),
    ).rejects.toMatchObject({ message: "SELF_GRANT_FORBIDDEN" });

    mockSend.mockImplementation(async () => ({
      Username: "u",
      UserAttributes: cognitoAttrs(
        "agency-a",
        "different-sub-but-same-email",
        "same@agency-a.example",
      ),
    }));

    await expect(
      svc.grant(
        { ...adminSameAgency, email: "same@agency-a.example", userId: "actor-distinct" },
        {
          targetUserId: "cognito-other-user-key",
          overrideType: "feature",
          grantedRoleOrPermission: "feature:silent_text",
          reason: "Email match counts as self",
        },
        apiEvent(),
      ),
    ).rejects.toMatchObject({ message: "SELF_GRANT_FORBIDDEN" });
  });

  it("revoke persists audit ACCESS_OVERRIDE_REVOKED and clears active status ", async () => {
    mockGet.mockImplementation(async () => ({
      overrideId: "ovr_test",
      agencyId: "agency-a",
      targetUserKey: `target-sub#ovr_test`,
      targetUserId: "target-sub",
      targetUserEmail: "target@agency-a.example",
      targetUserName: "TU",
      grantedRoleOrPermission: "feature:silent_text",
      overrideType: "feature",
      reason: "orig",
      status: "active",
      grantedByUserId: "admin-sub",
      grantedByName: "admin@agency-a.example",
      grantedAt: new Date().toISOString(),
      expiresAt: null,
      revokedByUserId: null,
      revokedAt: null,
      revokeReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    mockGet.mockReset();
    mockGet
      .mockResolvedValueOnce({
        overrideId: "ovr_test",
        agencyId: "agency-a",
        targetUserKey: "target-sub#ovr_test",
        targetUserId: "target-sub",
        targetUserEmail: "target@agency-a.example",
        targetUserName: "TU",
        grantedRoleOrPermission: "feature:silent_text",
        overrideType: "feature",
        reason: "orig",
        status: "active",
        grantedByUserId: "admin-sub",
        grantedByName: "admin@agency-a.example",
        grantedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: null,
        revokedByUserId: null,
        revokedAt: null,
        revokeReason: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        overrideId: "ovr_test",
        agencyId: "agency-a",
        targetUserKey: "target-sub#ovr_test",
        targetUserId: "target-sub",
        targetUserEmail: "target@agency-a.example",
        targetUserName: "TU",
        grantedRoleOrPermission: "feature:silent_text",
        overrideType: "feature",
        reason: "orig",
        status: "revoked",
        grantedByUserId: "admin-sub",
        grantedByName: "admin@agency-a.example",
        grantedAt: "2026-01-01T00:00:00.000Z",
        expiresAt: null,
        revokedByUserId: "admin-sub",
        revokedAt: "2026-01-03T12:00:00.000Z",
        revokeReason: "Compliance review",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T12:00:00.000Z",
      });

    const out = await svc.revoke(
      adminSameAgency,
      "ovr_test",
      { reason: "Compliance review" },
      apiEvent(),
    );

    expect(out.status).toBe("revoked");
    expect(mockUpdateRevoked).toHaveBeenCalledWith("ovr_test", expect.objectContaining({ status: "revoked" }));
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    const revokeAudit = mockAuditCreate.mock.calls[0][0];
    expect(revokeAudit.type).toBe("access.override.revoked");
    expect(revokeAudit.details).toMatchObject({
      eventType: "ACCESS_OVERRIDE_REVOKED",
      action: "revoke",
      overrideId: "ovr_test",
    });
  });

  it("list with status active omits logically expired overrides", async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    mockQueryByAgency.mockResolvedValue([
      {
        overrideId: "ovr_active",
        agencyId: "agency-a",
        targetUserKey: "t1#ovr_active",
        targetUserId: "t1",
        targetUserEmail: "a@x",
        targetUserName: "A",
        grantedRoleOrPermission: "feature:video_assist",
        overrideType: "feature",
        reason: "r",
        status: "active",
        grantedByUserId: "x",
        grantedByName: "x@x",
        grantedAt: new Date().toISOString(),
        expiresAt: null,
        revokedByUserId: null,
        revokedAt: null,
        revokeReason: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        overrideId: "ovr_logical_expired",
        agencyId: "agency-a",
        targetUserKey: "t2#ovr_logical_expired",
        targetUserId: "t2",
        targetUserEmail: "b@x",
        targetUserName: "B",
        grantedRoleOrPermission: "feature:video_assist",
        overrideType: "feature",
        reason: "r",
        status: "active",
        grantedByUserId: "x",
        grantedByName: "x@x",
        grantedAt: new Date().toISOString(),
        expiresAt: past,
        revokedByUserId: null,
        revokedAt: null,
        revokeReason: null,
        createdAt: "",
        updatedAt: "",
      },
    ]);

    const { items } = await svc.list(adminSameAgency, { status: "active" });

    expect(items.map((i) => i.overrideId)).toEqual(["ovr_active"]);
  });
});
