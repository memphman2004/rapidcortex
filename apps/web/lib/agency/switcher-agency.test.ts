import { describe, expect, it } from "vitest";
import {
  agencyInitials,
  canMutateActiveAgency,
  jwtTenantAgencyId,
  matchesSwitcherFilter,
  persistableAgencyId,
  resolveActiveAgencyId,
  switcherVerticalFromTenant,
  toSwitcherAgency,
} from "./switcher-agency";

describe("RC agency switcher mapping", () => {
  it("lets only RC internal operators mutate active agency", () => {
    expect(canMutateActiveAgency("rcsuperadmin")).toBe(true);
    expect(canMutateActiveAgency("rcadmin")).toBe(true);
    expect(canMutateActiveAgency("rcitadmin")).toBe(true);
    expect(canMutateActiveAgency("dispatcher")).toBe(false);
    expect(canMutateActiveAgency("agencyadmin")).toBe(false);
    expect(canMutateActiveAgency("CAMPUS_ADMIN")).toBe(false);
    expect(canMutateActiveAgency(undefined)).toBe(false);
  });

  it("maps core PSAPs to the internal 911 filter and campus/venue to their tabs", () => {
    expect(switcherVerticalFromTenant({ agencyId: "kcpd", type: "city" })).toBe("911");
    expect(switcherVerticalFromTenant({ agencyId: "uga", type: "campus" })).toBe("campus");
    expect(switcherVerticalFromTenant({ agencyId: "mbs", type: "venue" })).toBe("venue");
    expect(switcherVerticalFromTenant({ agencyId: "hvt", type: "transit", vertical: "transit" })).toBe("transit");
  });

  it("filters the RC list like a CRM industry filter without exposing other verticals on 911/campus/venue tabs", () => {
    const agencies = [
      toSwitcherAgency({ agencyId: "kcpd", name: "Kansas City PD", type: "city", status: "active" }),
      toSwitcherAgency({ agencyId: "uga", name: "UGA Police", type: "campus", status: "active" }),
      toSwitcherAgency({ agencyId: "mbs", name: "Mercedes-Benz Stadium", type: "venue", status: "pilot" }),
      toSwitcherAgency({
        agencyId: "hvt",
        name: "Hudson Valley Transit",
        type: "transit",
        status: "active",
        vertical: "transit",
      }),
    ];
    expect(agencies.filter((a) => matchesSwitcherFilter(a, "911", "")).map((a) => a.agencyId)).toEqual(["kcpd"]);
    expect(agencies.filter((a) => matchesSwitcherFilter(a, "campus", "")).map((a) => a.agencyId)).toEqual(["uga"]);
    expect(agencies.filter((a) => matchesSwitcherFilter(a, "all", "kansas")).map((a) => a.agencyId)).toEqual(["kcpd"]);
    expect(agencies.filter((a) => matchesSwitcherFilter(a, "all", "")).map((a) => a.agencyId)).toEqual([
      "kcpd",
      "uga",
      "mbs",
      "hvt",
    ]);
  });

  it("treats JWT __platform__ as unset and keeps customer agency ids read-only", () => {
    expect(persistableAgencyId("__platform__")).toBeNull();
    expect(jwtTenantAgencyId("kcpd")).toBe("kcpd");
    expect(
      resolveActiveAgencyId({ isRcAdmin: true, jwtAgencyId: "__platform__", overrideId: "kcpd" }),
    ).toBe("kcpd");
    expect(
      resolveActiveAgencyId({ isRcAdmin: false, jwtAgencyId: "kcpd", overrideId: "other" }),
    ).toBe("kcpd");
  });

  it("builds two-letter initials", () => {
    expect(agencyInitials("Kansas City PD")).toBe("KC");
    expect(agencyInitials("UGA")).toBe("UG");
  });
});
