import type { AgencyRole } from "../types.js";

export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

/**
 * Formal invite — persisted before Cognito user exists (or tracks re-invite).
 */
export interface InviteRecord {
  inviteId: string;
  agencyId: string;
  email: string;
  role: AgencyRole;
  invitedByUserId: string;
  status: InviteStatus;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  /** Opaque server-side reference; replace with KMS-signed JWT in production. */
  invitationSecret?: string;
  createdAt: string;
  updatedAt: string;
}
