/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

/** Settings-page placeholder while Ring Connect is suspended. */
export function RingIntegrationUnavailableNotice() {
  return (
    <div
      style={{
        padding: "1rem",
        color: "#888",
        fontSize: "13px",
        border: "1px dashed #ddd",
        borderRadius: "8px",
      }}
    >
      Ring camera integration is temporarily unavailable.
    </div>
  );
}
