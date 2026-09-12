/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

/** Extract venue code (e.g. MBS) from agency ids like `test-venue-mbs`. */
export function extractVenueCodeFromAgencyId(agencyId: string): string | null {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?venue-(.+)$/i);
  if (!match?.[1]) return null;
  return match[1].toUpperCase().replace(/-/g, "");
}
