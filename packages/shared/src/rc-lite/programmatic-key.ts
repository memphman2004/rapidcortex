/** Stored API key rows for RC Lite programmatic access (`rclite_*` secrets, DynamoDB hashed). */

export type RcLiteKeyTier = "dev" | "small" | "medium" | "large" | "enterprise";
export type RcLiteKeyEnv = "live" | "test";

export type RcLiteProgrammaticScope =
  | "incidents:read"
  | "incidents:write"
  | "transcripts:read"
  | "transcripts:write"
  | "ai:read"
  | "translation:read"
  | "translation:write"
  | "media:read"
  | "media:write"
  | "cad:read"
  | "audit:read"
  | "usage:read"
  | "webhooks:read"
  | "webhooks:write";

/** Dynamo + service layer representation (no raw key material). */
export interface RcLiteProgrammaticApiKey {
  keyId: string;
  agencyId: string;
  customerId: string;
  name: string;
  keyHash: string;
  prefix: string;
  env: RcLiteKeyEnv;
  tier: RcLiteKeyTier;
  scopes: RcLiteProgrammaticScope[];
  status: "active" | "revoked" | "suspended";
  monthlyCallLimit: number;
  rateLimitPerMinute: number;
  suspendOnOverage?: boolean;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  notes?: string;
}
