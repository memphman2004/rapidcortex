/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

/**
 * Citizen Ring owner identity key.
 *
 * Uses Ring Partner API Account ID (`GET /v1/users/me` → `data.id`), which is stable across
 * OAuth token rotation and revoke-and-reconnect. Do not key on refresh tokens or access tokens.
 *
 * @see https://developer.amazon.com/docs/ring/api-documentation.html (Users API)
 */
export function deriveCitizenRingAccountId(agencyId: string, ringPartnerAccountId: string): string {
  const accountId = ringPartnerAccountId.trim();
  if (!accountId) {
    throw new Error("Ring partner account id is required");
  }
  return `ring:${agencyId}:citizen:${accountId}`;
}
