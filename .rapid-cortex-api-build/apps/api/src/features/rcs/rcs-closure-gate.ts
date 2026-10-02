import type { RcsCallState } from "rapid-cortex-shared";
import { RCS_CLOSED_STATES } from "rapid-cortex-shared";

export type RcsClosureGateResult =
  | { allowed: true; overridden: boolean }
  | { allowed: false; statusCode: 400 | 403 | 409; reason: string };

/**
 * Closure gate: a call may only close normally once a unit has confirmed on-scene
 * (`UNIT_ARRIVED`). Any earlier state requires a supervisor override with badge + reason
 * (>= 20 chars); dispatchers may never supply an override (`requesterCanOverride=false`).
 */
export function evaluateClosureGate(input: {
  state: RcsCallState;
  requesterCanOverride: boolean;
  override?: { badge?: string; reason?: string };
}): RcsClosureGateResult {
  if (RCS_CLOSED_STATES.includes(input.state)) {
    return { allowed: false, statusCode: 409, reason: "RCS_CALL_ALREADY_CLOSED" };
  }

  if (input.state === "UNIT_ARRIVED") {
    return { allowed: true, overridden: false };
  }

  if (!input.override) {
    return { allowed: false, statusCode: 409, reason: "RCS_CLOSURE_REQUIRES_UNIT_ARRIVAL" };
  }

  if (!input.requesterCanOverride) {
    return { allowed: false, statusCode: 403, reason: "RCS_CLOSURE_OVERRIDE_FORBIDDEN" };
  }

  const badge = input.override.badge?.trim() ?? "";
  const reason = input.override.reason?.trim() ?? "";
  if (!badge || reason.length < 20) {
    return { allowed: false, statusCode: 400, reason: "RCS_CLOSURE_OVERRIDE_INVALID" };
  }

  return { allowed: true, overridden: true };
}
