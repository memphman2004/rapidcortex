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
  "CAMPUS_COUNSELOR",
  "CAMPUS_FACULTY",
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
  it("returns non-empty sections for all active roles in the nav matrix", () => {
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

  it("maps hospital_coord JWT to coordinator nav", () => {
    const nav = getRoleNav("hospital_coord", {});
    expect(nav.roleBadge).toBe("COORDINATOR");
    expect(nav.sections[0]?.items[0]?.href).toBe("/hospital-admin/dashboard");
  });

  it("campus admin users and settings use /app/campus/{code} paths", () => {
    const nav = getRoleNav("CAMPUS_ADMIN", { campusCode: "LINCOLNHIGH" });
    const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/app/campus/LINCOLNHIGH/users");
    expect(hrefs).toContain("/app/campus/LINCOLNHIGH/settings");
    expect(hrefs).toContain("/onboarding/campus/integrations?orgCode=LINCOLNHIGH");
    expect(hrefs).toContain("/app/campus/LINCOLNHIGH/onboarding/packets");
  });

  it("campus counselor nav is a wellness queue, not a 911 dispatch console", () => {
    const nav = getRoleNav("CAMPUS_COUNSELOR", { campusCode: "IU" });
    const items = nav.sections.flatMap((s) => s.items);
    expect(items.find((i) => i.id === "incidents")?.label).toBe("Wellness Queue");
    expect(items.find((i) => i.id === "incidents")?.href).toBe("/app/campus/IU/incidents");
    expect(items.find((i) => i.id === "cameras")).toBeUndefined();
    expect(items.find((i) => i.id === "eap")).toBeUndefined();
  });

  it("maps hyphenated venue-admin Cognito token to venue console nav", () => {
    const nav = getRoleNav("venue-admin", { venueCode: "MBS" });
    expect(nav.roleBadge).toBe("VENUE ADMIN");
    expect(nav.accent).toBe("orange");
    expect(nav.sections[0]?.items[0]?.href).toBe("/app/venue/MBS");
  });

  it("exposes Leads for all RC internal roles", () => {
    for (const role of ["rcsuperadmin", "rcadmin", "rcitadmin"] as const) {
      const nav = getRoleNav(role, {});
      const leads = nav.sections.flatMap((s) => s.items).find((i) => i.id === "leads");
      expect(leads?.href).toBe("/rc-admin/leads");
      expect(leads?.label).toBe("Leads");
    }
  });

  it("puts onboarding packets on RC superadmin and RC admin nav", () => {
    for (const role of ["rcsuperadmin", "rcadmin"] as const) {
      const hrefs = getRoleNav(role, {}).sections.flatMap((s) => s.items.map((i) => i.href));
      expect(hrefs).toContain("/rc-admin/onboarding/packets");
    }
  });

  it("groups all RC internal sidebars under labeled major headings", () => {
    const expectedSuperadmin = [
      "home",
      "tenants",
      "sales-crm",
      "business",
      "talent",
      "ops",
      "locations",
      "onboarding",
      "infra",
    ];
    const superadmin = getRoleNav("rcsuperadmin", {});
    expect(superadmin.sections.map((s) => s.id)).toEqual(expectedSuperadmin);
    expect(superadmin.sections.every((s) => Boolean(s.label))).toBe(true);
    expect(superadmin.sections.find((s) => s.id === "tenants")?.label).toBe("TENANTS");
    expect(superadmin.sections.find((s) => s.id === "home")?.items.map((i) => i.id)).toEqual([
      "overview",
    ]);

    const admin = getRoleNav("rcadmin", {});
    expect(admin.sections.map((s) => s.id)).toEqual([
      "home",
      "tenants",
      "sales-crm",
      "business",
      "talent",
      "ops",
      "locations",
      "onboarding",
    ]);
    expect(admin.sections.find((s) => s.id === "ops")?.items.map((i) => i.id)).toContain("reports");
    expect(admin.sections.every((s) => Boolean(s.label))).toBe(true);

    const it = getRoleNav("rcitadmin", {});
    expect(it.sections.map((s) => s.id)).toEqual([
      "infra",
      "tenants",
      "sales-crm",
      "talent",
      "locations",
      "audit-settings",
    ]);
    expect(it.sections.every((s) => Boolean(s.label))).toBe(true);
    expect(it.sections.find((s) => s.id === "audit-settings")?.label).toBe("AUDIT & SETTINGS");
  });

  it("dispatcher Intake/Transcription/Incidents land on live dispatcher workspace", () => {
    const nav = getRoleNav("dispatcher", { jurisdiction: "test-psap" });
    const items = nav.sections.flatMap((s) => s.items);
    const byId = Object.fromEntries(items.map((i) => [i.id, i.href]));
    expect(byId.intake).toBe("/test-psap/dispatcher");
    expect(byId.transcription).toBe("/test-psap/dispatcher#cad-transcript");
    expect(byId.incidents).toBe("/test-psap/dispatcher");
    expect(byId.triage).toBe("/test-psap/dispatcher/non-emergency");
  });

  it("keeps Rapid IQ in SALES & CRM and does not expose a separate Pipeline nav item", () => {
    for (const role of ["rcsuperadmin", "rcadmin"] as const) {
      const nav = getRoleNav(role, {});
      const items = nav.sections.flatMap((s) => s.items);
      const rapidIq = items.find((i) => i.id === "rapid-iq");
      expect(rapidIq?.href).toBe("/rc-admin/rapid-iq");
      expect(items.find((i) => i.id === "conferences")?.href).toBe("/rc-admin/conferences");
      expect(items.find((i) => i.id === "rapid-iq-pipeline")).toBeUndefined();
    }
    const itNav = getRoleNav("rcitadmin", {});
    const itItems = itNav.sections.flatMap((s) => s.items);
    expect(itItems.find((i) => i.id === "rapid-iq-pipeline")).toBeUndefined();
    expect(itItems.find((i) => i.id === "conferences")).toBeUndefined();
  });
});
