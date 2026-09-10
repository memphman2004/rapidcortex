import { describe, expect, it } from "vitest";
import { canAdminVision, canVerifyVisionObservation, canViewVision } from "./authz.js";
import type { UserContext } from "../types.js";

function user(role: string, agencyId = "a1"): UserContext {
  return { userId: "u1", agencyId, role } as UserContext;
}

describe("Rapid Vision™ authz", () => {
  it("lets dispatchers view and verify in the same agency", () => {
    expect(canViewVision(user("dispatcher"), "a1")).toBe(true);
    expect(canVerifyVisionObservation(user("dispatcher"), "a1")).toBe(true);
    expect(canAdminVision(user("dispatcher"), "a1")).toBe(false);
  });

  it("blocks cross-agency access", () => {
    expect(canViewVision(user("dispatcher"), "other")).toBe(false);
  });

  it("does not grant guest services Vision", () => {
    expect(canViewVision(user("VENUE_GUEST_SERVICES"), "a1")).toBe(false);
  });
});
