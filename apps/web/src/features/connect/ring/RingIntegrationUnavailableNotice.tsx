/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

/**
 * Kept so RING_DISABLED call sites compile. Disabled Ring UI must be omitted
 * entirely — never render an “unavailable” card or grayed-out window.
 */
export function RingIntegrationUnavailableNotice() {
  return null;
}
