import { describe, expect, it } from "vitest";
import { evaluateClosureGate } from "./rcs-closure-gate.js";

describe("rcs closure gate", () => {
  it("allows a normal close once a unit has arrived", () => {
    const result = evaluateClosureGate({ state: "UNIT_ARRIVED", requesterCanOverride: false });
    expect(result).toEqual({ allowed: true, overridden: false });
  });

  it("rejects closing an already-closed call", () => {
    const result = evaluateClosureGate({ state: "CLOSED", requesterCanOverride: true });
    expect(result).toEqual({ allowed: false, statusCode: 409, reason: "RCS_CALL_ALREADY_CLOSED" });
  });

  it("returns 409 when not yet arrived and no override is supplied", () => {
    const result = evaluateClosureGate({ state: "MONITORING", requesterCanOverride: true });
    expect(result).toEqual({ allowed: false, statusCode: 409, reason: "RCS_CLOSURE_REQUIRES_UNIT_ARRIVAL" });
  });

  it("returns 403 when a dispatcher supplies an override (not permitted)", () => {
    const result = evaluateClosureGate({
      state: "MONITORING",
      requesterCanOverride: false,
      override: { badge: "1234", reason: "Caller confirmed safe via callback, canceling unit response." },
    });
    expect(result).toEqual({ allowed: false, statusCode: 403, reason: "RCS_CLOSURE_OVERRIDE_FORBIDDEN" });
  });

  it("returns 400 when the override reason is under 20 characters", () => {
    const result = evaluateClosureGate({
      state: "MONITORING",
      requesterCanOverride: true,
      override: { badge: "1234", reason: "too short" },
    });
    expect(result).toEqual({ allowed: false, statusCode: 400, reason: "RCS_CLOSURE_OVERRIDE_INVALID" });
  });

  it("returns 400 when the badge is missing", () => {
    const result = evaluateClosureGate({
      state: "MONITORING",
      requesterCanOverride: true,
      override: { badge: "", reason: "Caller confirmed safe via callback, canceling unit response." },
    });
    expect(result).toEqual({ allowed: false, statusCode: 400, reason: "RCS_CLOSURE_OVERRIDE_INVALID" });
  });

  it("allows a supervisor override with a valid badge and reason >= 20 chars", () => {
    const result = evaluateClosureGate({
      state: "MONITORING",
      requesterCanOverride: true,
      override: { badge: "1234", reason: "Caller confirmed safe via callback, canceling unit response." },
    });
    expect(result).toEqual({ allowed: true, overridden: true });
  });
});
