import { describe, expect, it } from "vitest";
import type { UserContext } from "rapid-cortex-shared/types";
import { canViewIQReporting } from "./analytics-authz";

function user(role: string, agencyId = "agency-1"): UserContext {
  return {
    userId: "u1",
    agencyId,
    role: role as UserContext["role"],
    email: "ops@example.com",
  };
}

describe("canViewIQReporting", () => {
  it("allows supervisor and agency admin in-tenant", () => {
    expect(canViewIQReporting(user("supervisor"), "agency-1")).toBe(true);
    expect(canViewIQReporting(user("agencyadmin"), "agency-1")).toBe(true);
    expect(canViewIQReporting(user("agencyit"), "agency-1")).toBe(true);
  });

  it("allows campus/venue/transit/hospital supervisor-admin roles", () => {
    expect(canViewIQReporting(user("CAMPUS_ADMIN"), "agency-1")).toBe(true);
    expect(canViewIQReporting(user("venue_supervisor"), "agency-1")).toBe(true);
    expect(canViewIQReporting(user("TRANSIT_SUPERVISOR"), "agency-1")).toBe(true);
    expect(canViewIQReporting(user("HOSPITAL_ADMIN"), "agency-1")).toBe(true);
    expect(canViewIQReporting(user("hospital_supervisor"), "agency-1")).toBe(true);
  });

  it("denies dispatcher and other front-line roles even in-tenant", () => {
    expect(canViewIQReporting(user("dispatcher"), "agency-1")).toBe(false);
    expect(canViewIQReporting(user("call_taker"), "agency-1")).toBe(false);
    expect(canViewIQReporting(user("CAMPUS_SECURITY"), "agency-1")).toBe(false);
    expect(canViewIQReporting(user("VENUE_OPERATOR"), "agency-1")).toBe(false);
    expect(canViewIQReporting(user("TRANSIT_OPERATOR"), "agency-1")).toBe(false);
    expect(canViewIQReporting(user("HOSPITAL_STAFF"), "agency-1")).toBe(false);
    expect(canViewIQReporting(user("hospital_coord"), "agency-1")).toBe(false);
  });

  it("denies cross-agency access for tenant roles", () => {
    expect(canViewIQReporting(user("supervisor"), "other")).toBe(false);
  });

  it("allows rcsuperadmin across agencies", () => {
    expect(canViewIQReporting(user("rcsuperadmin", "platform"), "agency-1")).toBe(true);
  });
});
