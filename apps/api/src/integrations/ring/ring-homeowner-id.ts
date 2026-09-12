/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

/**
 * Sentinel agencyId for device-owner enrollments before a local PSAP is enrolled.
 * Used in OAuth state + Secrets Manager paths; omitted from participant GSI when unmatched.
 */
export const RING_HOMEOWNER_UNMATCHED_AGENCY_ID = "public";

/** Stable homeowner PK from Ring Partner API account id (`GET /v1/users/me` → `data.id`). */
export function homeownerIdFromPartnerAccount(ringPartnerAccountId: string): string {
  const accountId = ringPartnerAccountId.trim();
  if (!accountId) {
    throw new Error("Ring partner account id is required");
  }
  return `hw:${accountId}`;
}

export function isUnmatchedHomeownerAgency(agencyId: string | null | undefined): boolean {
  return !agencyId || agencyId === RING_HOMEOWNER_UNMATCHED_AGENCY_ID;
}
