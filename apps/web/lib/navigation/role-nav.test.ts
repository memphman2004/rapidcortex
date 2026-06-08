import { describe, expect, it } from "vitest";
import { getRoleNav } from "./role-nav";

const ALL_ROLES = [
  "rcsuperadmin",
  "rcadmin",
  "rcitadmin",
  "dispatcher",
  "supervisor",
  "agencyadmin",
  "agencyit",
  "analyst",
  "auditor",
  "CAMPUS_ADMIN",
  "CAMPUS_SUPERVISOR",
  "CAMPUS_SECURITY",
  "CAMPUS_DISPATCH",
  "HOSPITAL_ADMIN",
  "HOSPITAL_COORDINATOR",
  "HOSPITAL_STAFF",
  "VENUE_ADMIN",
  "VENUE_SUPERVISOR",
  "VENUE_SECURITY",
  "VENUE_OPERATOR",
  "VENUE_GUEST_SERVICES",
] as const;

describe("getRoleNav", () => {
  it("returns non-empty sections for all 21 active roles", () => {
    for (const role of ALL_ROLES) {
      const nav = getRoleNav(role, {
        jurisdiction: "test-psap",
        venueCode: "MBS",
        campusCode: "LINCOLNHIGH",
      });
      expect(nav.sections.length).toBeGreaterThan(0);
      expect(nav.sections.some((s) => s.items.length > 0)).toBe(true);
      expect(nav.roleBadge.length).toBeGreaterThan(0);
    }
  });

  it("unknown role falls back to sign-out only", () => {
    const nav = getRoleNav("not-a-real-role", {});
    expect(nav.sections).toHaveLength(1);
    expect(nav.sections[0]?.items).toEqual([
      expect.objectContaining({ id: "signout", href: "/auth/signout" }),
    ]);
  });

  it("maps hospitaladmin to hospital admin nav", () => {
    const nav = getRoleNav("hospitaladmin", {});
    expect(nav.roleBadge).toBe("HOSPITAL ADMIN");
    expect(nav.sections[0]?.items[0]?.href).toBe("/hospital-admin/dashboard");
  });

  it("campus admin users and settings use /app/campus/{code} paths", () => {
    const nav = getRoleNav("CAMPUS_ADMIN", { campusCode: "LINCOLNHIGH" });
    const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/app/campus/LINCOLNHIGH/users");
    expect(hrefs).toContain("/app/campus/LINCOLNHIGH/settings");
  });
});
