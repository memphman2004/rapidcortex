/** Stored in DynamoDB (`ACCESS_OVERRIDES_TABLE`). */
export type AccessOverrideType = "role" | "permission" | "feature" | "incident-access";

export type AccessOverrideStatus = "active" | "revoked" | "expired";

export interface AccessOverrideRecord {
  overrideId: string;
  agencyId: string;
  /** Partition key for querying by user within agency: `${targetUserId}#${overrideId}` */
  targetUserKey: string;
  targetUserId: string;
  targetUserEmail: string;
  /** Optional display name from Cognito */
  targetUserName: string;
  grantedRoleOrPermission: string;
  overrideType: AccessOverrideType;
  reason: string;
  status: AccessOverrideStatus;
  grantedByUserId: string;
  grantedByName: string;
  grantedAt: string;
  expiresAt?: string | null;
  revokedByUserId?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
  createdAt: string;
  updatedAt: string;
}
