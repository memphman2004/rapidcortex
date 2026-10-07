import {
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type AttributeType,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  AGENCY_ASSIGNABLE_ROLES,
  canAdminForcePasswordReset,
  isRcInternalOperator,
  isRcsuperadmin,
  type AgencyRole,
  type UserContext,
  type UserRole,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { normalizeRole } from "../lib/authz.js";

const assignableAgencyRoles: AgencyRole[] = [...AGENCY_ASSIGNABLE_ROLES];

const RC_INTERNAL_ASSIGNABLE_ROLES: UserRole[] = ["rcsuperadmin", "rcadmin", "rcitadmin"];

function cip() {
  return new CognitoIdentityProviderClient({ region: env.region });
}

function attr(attrs: AttributeType[] | undefined, name: string): string {
  const a = attrs?.find((x) => x.Name === name);
  return String(a?.Value ?? "");
}

export type AdminUserRow = {
  username: string;
  email: string;
  agencyId: string;
  role: UserRole;
  enabled: boolean;
  status: string;
};

type TargetProfile = {
  agencyId: string;
  userSub: string | null;
  cognitoUsername: string;
};

export class AdminUserService {
  assertUserManagement(user: UserContext) {
    const allowed =
      user.role === "agencyadmin" ||
      user.role === "agencyit" ||
      isRcInternalOperator(user.role);
    if (!allowed) {
      throw new Error("FORBIDDEN");
    }
    if (!env.cognitoUserPoolId) throw new Error("COGNITO_NOT_CONFIGURED");
  }

  private async getTargetProfile(username: string): Promise<TargetProfile | null> {
    try {
      const out = await cip().send(
        new AdminGetUserCommand({
          UserPoolId: env.cognitoUserPoolId,
          Username: username,
        }),
      );
      const agencyRaw = attr(out.UserAttributes, "custom:agencyId").trim();
      if (!agencyRaw) return null;
      return {
        agencyId: agencyRaw,
        userSub: attr(out.UserAttributes, "sub").trim() || null,
        cognitoUsername: out.Username ?? username,
      };
    } catch {
      return null;
    }
  }

  private assertAgencyAdminTargetsOwnAgency(user: UserContext, targetAgencyId: string | null) {
    if (isRcsuperadmin(user) || user.role === "rcitadmin") return;
    if (!targetAgencyId || targetAgencyId !== user.agencyId) {
      throw new Error("FORBIDDEN");
    }
  }

  private assertAssignableRoleByActor(user: UserContext, role: UserRole) {
    if (assignableAgencyRoles.includes(role as AgencyRole)) return;
    if (RC_INTERNAL_ASSIGNABLE_ROLES.includes(role) && isRcsuperadmin(user)) return;
    throw new Error("INVALID_ROLE");
  }

  async list(user: UserContext): Promise<AdminUserRow[]> {
    this.assertUserManagement(user);
    const out = await cip().send(
      new ListUsersCommand({
        UserPoolId: env.cognitoUserPoolId,
        Limit: 60,
      }),
    );
    const rows: AdminUserRow[] = [];
    for (const u of out.Users ?? []) {
      const attrs = u.Attributes;
      rows.push({
        username: u.Username ?? "",
        email: attr(attrs, "email") || (u.Username ?? ""),
        agencyId: attr(attrs, "custom:agencyId"),
        role: normalizeRole(attr(attrs, "custom:role")),
        enabled: u.Enabled !== false,
        status: u.UserStatus ?? "UNKNOWN",
      });
    }
    if (isRcsuperadmin(user) || user.role === "rcitadmin") return rows;
    return rows.filter((r) => r.agencyId === user.agencyId);
  }

  async create(
    user: UserContext,
    input: { email: string; agencyId: string; role: UserRole; temporaryPassword: string },
  ): Promise<AdminUserRow> {
    this.assertUserManagement(user);
    this.assertAssignableRoleByActor(user, input.role);
    if ((user.role === "agencyadmin" || user.role === "agencyit") && input.agencyId !== user.agencyId) {
      throw new Error("FORBIDDEN");
    }

    await cip().send(
      new AdminCreateUserCommand({
        UserPoolId: env.cognitoUserPoolId,
        Username: input.email,
        UserAttributes: [
          { Name: "email", Value: input.email },
          { Name: "email_verified", Value: "true" },
          { Name: "custom:agencyId", Value: input.agencyId },
          { Name: "custom:role", Value: input.role },
          { Name: "custom:pwdChangeReq", Value: "true" },
        ],
        TemporaryPassword: input.temporaryPassword,
        MessageAction: "SUPPRESS",
      }),
    );

    return {
      username: input.email,
      email: input.email,
      agencyId: input.agencyId,
      role: input.role,
      enabled: true,
      status: "FORCE_CHANGE_PASSWORD",
    };
  }

  /** Updates Cognito user attributes including optional mandatory password-renewal flag. */
  async updateAttributes(
    user: UserContext,
    input: {
      username: string;
      agencyId?: string;
      role?: UserRole;
      passwordChangeRequired?: boolean;
    },
  ): Promise<{
    didUpdateCognito: boolean;
    passwordRequirementAudit?: {
      targetUserId: string;
      targetAgencyId: string;
      targetUsername: string;
    };
  }> {
    this.assertUserManagement(user);
    const target = await this.getTargetProfile(input.username);
    if (!target) throw new Error("USER_NOT_FOUND");
    this.assertAgencyAdminTargetsOwnAgency(user, target.agencyId);

    const attrs: AttributeType[] = [];
    if (input.agencyId != null) {
      if ((user.role === "agencyadmin" || user.role === "agencyit") && input.agencyId !== user.agencyId) {
        throw new Error("FORBIDDEN");
      }
      attrs.push({ Name: "custom:agencyId", Value: input.agencyId });
    }
    if (input.role != null) {
      this.assertAssignableRoleByActor(user, input.role);
      attrs.push({ Name: "custom:role", Value: input.role });
    }
    if (input.passwordChangeRequired != null) {
      if (!canAdminForcePasswordReset(user, { targetAgencyId: target.agencyId })) {
        throw new Error("FORBIDDEN");
      }
      attrs.push({
        Name: "custom:pwdChangeReq",
        Value: input.passwordChangeRequired ? "true" : "false",
      });
    }

    if (attrs.length === 0) return { didUpdateCognito: false };

    await cip().send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: env.cognitoUserPoolId,
        Username: target.cognitoUsername,
        UserAttributes: attrs,
      }),
    );

    const passwordRequirementAudit =
      input.passwordChangeRequired === true
        ? {
            targetUserId: target.userSub ?? input.username,
            targetAgencyId: target.agencyId,
            targetUsername: input.username,
          }
        : undefined;

    return { didUpdateCognito: true, passwordRequirementAudit };
  }

  async deactivate(user: UserContext, username: string): Promise<void> {
    this.assertUserManagement(user);
    const target = await this.getTargetProfile(username);
    if (!target) throw new Error("USER_NOT_FOUND");
    this.assertAgencyAdminTargetsOwnAgency(user, target.agencyId);

    await cip().send(
      new AdminDisableUserCommand({
        UserPoolId: env.cognitoUserPoolId,
        Username: target.cognitoUsername,
      }),
    );
  }

  async activate(user: UserContext, username: string): Promise<void> {
    this.assertUserManagement(user);
    const target = await this.getTargetProfile(username);
    if (!target) throw new Error("USER_NOT_FOUND");
    this.assertAgencyAdminTargetsOwnAgency(user, target.agencyId);

    await cip().send(
      new AdminEnableUserCommand({
        UserPoolId: env.cognitoUserPoolId,
        Username: target.cognitoUsername,
      }),
    );
  }
}
