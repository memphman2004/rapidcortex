import type { UserRole } from "../types.js";

/**
 * Shape of Cognito ID token claims we map into `UserContext` (subset + string index).
 */
export type CognitoIdTokenClaims = {
  sub: string;
  email?: string;
  "cognito:username"?: string;
  token_use?: "id" | "access";
  "custom:agencyId"?: string;
  "custom:role"?: string;
  [key: string]: unknown;
};

export type ResolvedPrincipal = {
  userId: string;
  email: string;
  agencyId: string;
  role: UserRole;
};
