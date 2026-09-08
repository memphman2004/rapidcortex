import { describe, expect, it } from "vitest";
import { AuthorizationService } from "./authorization-service.js";
import { canUnfoundCrime, type UserContext, type UserRole } from "rapid-cortex-shared";

function makeUser(role: UserRole, overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: `user-${role}`,
    agencyId: "agency-a",
    role,
    email: `${role}@example.com`,
    ...overrides,
  };
}

describe("Clery Act permissions", () => {
  const auth = new AuthorizationService();

  it("grants review and zone config to campus admin, not security or dispatcher", () => {
    expect(auth.canPerform(makeUser("CAMPUS_ADMIN" as UserRole), "clery.record.review")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_ADMIN" as UserRole), "clery.zones.configure")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_ADMIN" as UserRole), "clery.record.unfound")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY" as UserRole), "clery.record.create")).toBe(true);
    expect(auth.canPerform(makeUser("CAMPUS_SECURITY" as UserRole), "clery.record.review")).toBe(false);
    expect(auth.canPerform(makeUser("dispatcher"), "clery.record.review")).toBe(false);
    expect(auth.canPerform(makeUser("VENUE_GUEST_SERVICES" as UserRole), "clery.record.view")).toBe(false);
  });

  it("does not treat unfound permission as sufficient without a sworn CSA record", () => {
    expect(auth.canPerform(makeUser("CAMPUS_ADMIN" as UserRole), "clery.record.unfound")).toBe(true);
    expect(canUnfoundCrime(null)).toBe(false);
  });
});
