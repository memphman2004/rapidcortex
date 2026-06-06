import type { UserRole } from "../types.js";

export type UserAccountStatus = "invited" | "active" | "suspended" | "disabled";

/**
 * Logical user profile beyond Cognito — future Dynamo `USER#sub` item or sync projection.
 */
export interface UserProfile {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  agencyId: string;
  status: UserAccountStatus;
  cognitoSub: string;
  invitedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  permissionsOverride?: Record<string, unknown>;
}
