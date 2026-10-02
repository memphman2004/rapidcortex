import { describe, expect, it } from "vitest";
import {
  canAccessCampusTenant,
  campusCodeFromAgencyId,
  normalizeCampusCode,
} from "./campus-access";

describe("campusCodeFromAgencyId", () => {
  it("extracts codes from test-, last-, and plain campus agency ids", () => {
    expect(campusCodeFromAgencyId("test-campus-uga")).toBe("UGA");
    expect(campusCodeFromAgencyId("last-campus-uga")).toBe("UGA");
    expect(campusCodeFromAgencyId("campus-uga")).toBe("UGA");
    expect(campusCodeFromAgencyId("last-campus-lincoln-high")).toBe("LINCOLNHIGH");
  });
});

describe("canAccessCampusTenant", () => {
  it("allows campus admins for matching org codes including last-campus-*", () => {
    expect(
      canAccessCampusTenant(
        { userId: "u1", agencyId: "last-campus-uga", role: "campus_admin", email: "a@b.c" },
        "UGA",
      ),
    ).toBe(true);
    expect(
      canAccessCampusTenant(
        { userId: "u1", agencyId: "test-campus-uga", role: "CAMPUS_ADMIN", email: "a@b.c" },
        "uga",
      ),
    ).toBe(true);
  });

  it("denies mismatched campus codes", () => {
    expect(
      canAccessCampusTenant(
        { userId: "u1", agencyId: "last-campus-uga", role: "campus_admin", email: "a@b.c" },
        "OTHER",
      ),
    ).toBe(false);
  });

  it("normalizes campus codes", () => {
    expect(normalizeCampusCode("lincoln-high")).toBe("LINCOLNHIGH");
  });
});
