/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 *
 * Infra reactivation also requires CloudFormation `RingEnabled=true`
 * (see infra/nested/stack-app-sam-4.yaml) and a redeploy.
 */

/** Master kill switch for Ring Connect / Ring camera APIs and UI. */
export const RING_INTEGRATION_ENABLED = false;
