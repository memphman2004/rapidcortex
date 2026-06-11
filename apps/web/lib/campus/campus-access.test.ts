import { describe, expect, it } from "vitest";
import {
  canAccessCampusUsersOrSettings,
  normalizeCampusCode,
  resolveCampusAgencyIdFromCode,
} from "./campus-access";

describe("campus access", () => {
  it("normalizes campus codes", () => {
    expect(normalizeCampusCode("lincoln-high")).toBe("LINCOLNHIGH");
  });

  it("resolves agencyId from campus code", () => {
    const agencies = [
      {
        agencyId: "test-campus-lincoln-high",
        name: "Lincoln High",
        type: "campus",
        status: "active",
        config: { agencyId: "test-campus-lincoln-high" },
      },
    ] as never[];
    expect(resolveCampusAgencyIdFromCode(agencies, "LINCOLNHIGH")).toBe("test-campus-lincoln-high");
  });

  it("allows CAMPUS_ADMIN only for matching campus code", () => {
    expect(
      canAccessCampusUsersOrSettings(
        { role: "campus_admin", agencyId: "test-campus-lincoln-high" },
        "LINCOLNHIGH",
      ),
    ).toBe(true);
    expect(
      canAccessCampusUsersOrSettings(
        { role: "campus_admin", agencyId: "test-campus-lincoln-high" },
        "OTHER",
      ),
    ).toBe(false);
  });

  it("denies non-admin campus roles", () => {
    expect(
      canAccessCampusUsersOrSettings(
        { role: "campus_supervisor", agencyId: "test-campus-lincoln-high" },
        "LINCOLNHIGH",
      ),
    ).toBe(false);
  });

  it("allows RC internal operators cross-tenant", () => {
    expect(
      canAccessCampusUsersOrSettings({ role: "rcadmin", agencyId: "__platform__" }, "ANY"),
    ).toBe(true);
    expect(
      canAccessCampusUsersOrSettings({ role: "rcitadmin", agencyId: "__platform__" }, "ANY"),
    ).toBe(true);
    expect(
      canAccessCampusUsersOrSettings({ role: "rcsuperadmin", agencyId: "__platform__" }, "ANY"),
    ).toBe(true);
  });
});
