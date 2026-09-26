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
  "TRANSIT_ADMIN",
  "TRANSIT_SUPERVISOR",
  "TRANSIT_SECURITY",
  "TRANSIT_OPERATOR",
  "CALL_ASSIST_ADMIN",
  "CALL_ASSIST_SUPERVISOR",
  "CALL_ASSIST_OPERATOR",
] as const;

describe("getRoleNav", () => {
  it("returns non-empty sections for all active roles in the nav matrix", () => {
    for (const role of ALL_ROLES) {
      const nav = getRoleNav(role, {
        jurisdiction: "test-psap",
        venueCode: "MBS",
        campusCode: "LINCOLNHIGH",
        transitCode: "HVT",
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
    expect(hrefs).toContain("/app/campus/LINCOLNHIGH/onboarding/integrations");
    expect(hrefs).toContain("/app/campus/LINCOLNHIGH/onboarding/intake");
    expect(hrefs).toContain("/app/campus/LINCOLNHIGH/onboarding/checklist");
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

  it("uses indigo accent for transit so it does not match PSAP sky", () => {
    const nav = getRoleNav("TRANSIT_ADMIN", { transitCode: "MARTA" });
    expect(nav.accent).toBe("indigo");
    const hrefs = nav.sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/onboarding/transit/intake?orgCode=MARTA");
  });

  it("uses slate accent for campus and orange for venue", () => {
    expect(getRoleNav("CAMPUS_ADMIN", { campusCode: "UGA" }).accent).toBe("slate");
    expect(getRoleNav("VENUE_ADMIN", { venueCode: "MBS" }).accent).toBe("orange");
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
      expect(hrefs).toContain("/rc-admin/onboarding/campus/intake");
      expect(hrefs).toContain("/rc-admin/onboarding/campus/integrations");
      expect(hrefs).toContain("/rc-admin/onboarding/venue/intake");
      expect(hrefs).toContain("/rc-admin/onboarding/transit/intake");
      expect(hrefs).toContain("/rc-admin/onboarding/checklist/campus");
      expect(hrefs).not.toContain("/onboarding/campus/intake");
    }
  });

  it("puts Call Assist and bot fleet management on all RC internal navs", () => {
    for (const role of ["rcsuperadmin", "rcadmin", "rcitadmin"] as const) {
      const items = getRoleNav(role, {}).sections.flatMap((s) => s.items);
      expect(items.find((i) => i.id === "call-assist")?.href).toBe("/rc-admin/call-assist");
      expect(items.find((i) => i.id === "call-assist")?.label).toBe("Call Assist");
      expect(items.find((i) => i.id === "call-assist")?.exact).toBe(true);
      expect(items.find((i) => i.id === "call-assist-bots")?.href).toBe("/rc-admin/call-assist/bots");
    }
  });

  it("groups all RC internal sidebars under labeled major headings", () => {
    const expectedSuperadmin = [
      "home",
      "training",
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
      "training",
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
    expect(byId["call-assist"]).toBe("/test-psap/call-assist");
    expect(byId.translate).toBe("/test-psap/translate");
  });

  it("adds Translate to venue and campus navs and hides it from guest services", () => {
    const venue = getRoleNav("VENUE_OPERATOR", { venueCode: "MBS" });
    const venueHrefs = venue.sections.flatMap((s) => s.items).map((i) => i.id);
    expect(venueHrefs).toContain("translate");
    const guest = getRoleNav("VENUE_GUEST_SERVICES", { venueCode: "MBS" });
    expect(guest.sections.flatMap((s) => s.items).map((i) => i.id)).not.toContain("translate");
    const campus = getRoleNav("CAMPUS_SECURITY", { campusCode: "LINCOLNHIGH" });
    expect(campus.sections.flatMap((s) => s.items).find((i) => i.id === "translate")?.href).toBe(
      "/app/campus/LINCOLNHIGH/translate",
    );
    const faculty = getRoleNav("CAMPUS_FACULTY", { campusCode: "LINCOLNHIGH" });
    const facultyItem = faculty.sections.flatMap((s) => s.items).find((i) => i.id === "translate");
    expect(facultyItem?.badge).toEqual({ type: "label", text: "VIEW ONLY", color: "slate" });
  });

  it("exposes Call Assist QA to supervisors and analytics on the Call Assist page", () => {
    const supervisor = getRoleNav("supervisor", { jurisdiction: "test-psap" });
    const hrefs = Object.fromEntries(supervisor.sections.flatMap((s) => s.items).map((i) => [i.id, i.href]));
    expect(hrefs["call-assist"]).toBe("/test-psap/call-assist");
    expect(hrefs["call-assist-qa"]).toBe("/test-psap/call-assist/qa");
    expect(hrefs["call-assist-analytics"]).toBeUndefined();
    const admin = getRoleNav("agencyadmin", { jurisdiction: "test-psap" });
    const adminHrefs = Object.fromEntries(admin.sections.flatMap((s) => s.items).map((i) => [i.id, i.href]));
    expect(adminHrefs.compliance).toBe("/test-psap/admin/retention");
    expect(adminHrefs["call-assist-analytics"]).toBeUndefined();
    expect(adminHrefs["cad-bridge"]).toBe("/test-psap/admin/cad/bridge");
    expect(adminHrefs["c2c-hub"]).toBe("/test-psap/admin/cad/c2c");
    const dispatcher = getRoleNav("dispatcher", { jurisdiction: "test-psap" });
    expect(dispatcher.sections.flatMap((s) => s.items).find((i) => i.id === "call-assist-qa")).toBeUndefined();
    // CAD Bridge / C2C Hub / Agency Network are agency-admin configuration — not dispatcher ops.
    expect(dispatcher.sections.flatMap((s) => s.items).find((i) => i.id === "cad-bridge")).toBeUndefined();
    expect(dispatcher.sections.flatMap((s) => s.items).find((i) => i.id === "c2c-hub")).toBeUndefined();
    expect(dispatcher.sections.flatMap((s) => s.items).find((i) => i.id === "cad-mesh")).toBeUndefined();
    expect(supervisor.sections.flatMap((s) => s.items).find((i) => i.id === "c2c-hub")).toBeUndefined();
  });

  it("Call Assist–only nav never includes the 911 dispatcher dashboard", () => {
    const operator = getRoleNav("call_assist_operator", {});
    const hrefs = operator.sections.flatMap((s) => s.items).map((i) => i.href);
    expect(operator.accent).toBe("teal");
    expect(hrefs).toContain("/app/call-assist/operator");
    expect(hrefs.some((h) => h.includes("/dashboard") || h.includes("/dispatcher"))).toBe(false);
    const admin = getRoleNav("CALL_ASSIST_ADMIN", {});
    expect(admin.sections.flatMap((s) => s.items).map((i) => i.href)).toContain("/app/call-assist/admin");
    expect(admin.sections.flatMap((s) => s.items).map((i) => i.href)).toContain("/app/call-assist/users");
    expect(admin.sections.flatMap((s) => s.items).map((i) => i.href)).not.toContain("/app/call-assist/operator");
    const supervisor = getRoleNav("call_assist_supervisor", {});
    const supervisorHrefs = supervisor.sections.flatMap((s) => s.items).map((i) => i.href);
    expect(supervisorHrefs).toContain("/app/call-assist/supervisor");
    expect(supervisorHrefs).toContain("/app/call-assist/qa");
    expect(supervisorHrefs).not.toContain("/app/call-assist/analytics");
    expect(supervisorHrefs).not.toContain("/app/call-assist/admin");
    expect(hrefs).not.toContain("/app/call-assist/qa");
  });

  it("sales contractor nav includes CRM tools and feature-only catalogs", () => {
    const nav = getRoleNav("salescontractor", {});
    const items = nav.sections.flatMap((s) => s.items);
    const hrefs = items.map((i) => i.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/sales",
        "/rc-admin/deployments-map",
        "/rc-admin/leads",
        "/rc-admin/psap-prospects",
        "/rc-admin/contacts",
        "/rc-admin/rapid-iq",
        "/rc-admin/conferences",
        "/sales/pricing-catalog",
        "/sales/service-catalog",
        "/rc-admin/support",
        "/rc-admin/grants",
        "/rc-admin/onboarding/packets",
        "/rc-admin/system-health",
      ]),
    );
    expect(items.find((i) => i.id === "pricing-catalog")?.badge).toEqual({
      type: "label",
      text: "FEATURES",
      color: "slate",
    });
  });

  it("keeps NexiQ in SALES & CRM and does not expose a separate Pipeline nav item", () => {
    for (const role of ["rcsuperadmin", "rcadmin"] as const) {
      const nav = getRoleNav(role, {});
      const items = nav.sections.flatMap((s) => s.items);
      const rapidIq = items.find((i) => i.id === "rapid-iq");
      expect(rapidIq?.href).toBe("/rc-admin/rapid-iq");
      expect(items.find((i) => i.id === "conferences")?.href).toBe("/rc-admin/conferences");
      expect(items.find((i) => i.id === "sales-automation")?.href).toBe("/rc-admin/sales-automation");
      expect(items.find((i) => i.id === "sales-automation")?.label).toBe("Email Campaigns");
      expect(items.find((i) => i.id === "rapid-iq-pipeline")).toBeUndefined();
    }
    const itNav = getRoleNav("rcitadmin", {});
    const itItems = itNav.sections.flatMap((s) => s.items);
    expect(itItems.find((i) => i.id === "rapid-iq-pipeline")).toBeUndefined();
    expect(itItems.find((i) => i.id === "conferences")).toBeUndefined();
    expect(itItems.find((i) => i.id === "sales-automation")).toBeUndefined();
  });

  it("transit admin/supervisor/security expose cameras at /transit/{code}/cameras", () => {
    const code = "HVT";
    const admin = getRoleNav("TRANSIT_ADMIN", { transitCode: code });
    const supervisor = getRoleNav("TRANSIT_SUPERVISOR", { transitCode: code });
    const security = getRoleNav("TRANSIT_SECURITY", { transitCode: code });
    const operator = getRoleNav("TRANSIT_OPERATOR", { transitCode: code });
    expect(admin.sections.flatMap((s) => s.items).find((i) => i.id === "cameras")?.href).toBe(
      "/transit/HVT/cameras",
    );
    expect(supervisor.sections.flatMap((s) => s.items).find((i) => i.id === "cameras")?.href).toBe(
      "/transit/HVT/cameras",
    );
    expect(security.sections.flatMap((s) => s.items).find((i) => i.id === "cameras")?.href).toBe(
      "/transit/HVT/cameras",
    );
    expect(operator.sections.flatMap((s) => s.items).find((i) => i.id === "cameras")).toBeUndefined();
  });

  it("exposes Video Wall next to Cameras for campus, venue, and transit ops roles", () => {
    const campus = getRoleNav("CAMPUS_ADMIN", { campusCode: "UGA" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "video-wall");
    expect(campus?.href).toBe("/app/campus/UGA/video-wall");
    expect(campus?.feature).toBe("rcVideo");
    expect(
      getRoleNav("CAMPUS_COUNSELOR", { campusCode: "UGA" })
        .sections.flatMap((s) => s.items)
        .find((i) => i.id === "video-wall"),
    ).toBeUndefined();
    expect(
      getRoleNav("VENUE_ADMIN", { venueCode: "stadium" })
        .sections.flatMap((s) => s.items)
        .find((i) => i.id === "video-wall")?.href,
    ).toBe("/app/venue/stadium/video-wall");
    expect(
      getRoleNav("VENUE_GUEST_SERVICES", { venueCode: "stadium" })
        .sections.flatMap((s) => s.items)
        .find((i) => i.id === "video-wall"),
    ).toBeUndefined();
    expect(
      getRoleNav("TRANSIT_ADMIN", { transitCode: "HVT" })
        .sections.flatMap((s) => s.items)
        .find((i) => i.id === "video-wall")?.href,
    ).toBe("/transit/HVT/video-wall");
  });

  it("transit admin and supervisor expose QR codes; only admin exposes users", () => {
    const code = "HVT";
    const admin = getRoleNav("TRANSIT_ADMIN", { transitCode: code }).sections.flatMap((s) => s.items);
    const supervisor = getRoleNav("TRANSIT_SUPERVISOR", { transitCode: code }).sections.flatMap(
      (s) => s.items,
    );
    const operator = getRoleNav("TRANSIT_OPERATOR", { transitCode: code }).sections.flatMap(
      (s) => s.items,
    );
    expect(admin.find((i) => i.id === "qr")?.href).toBe("/transit/HVT/qr-codes");
    expect(supervisor.find((i) => i.id === "qr")?.href).toBe("/transit/HVT/qr-codes");
    expect(admin.find((i) => i.id === "users")?.href).toBe("/transit/HVT/users");
    expect(supervisor.find((i) => i.id === "users")).toBeUndefined();
    expect(operator.find((i) => i.id === "qr")).toBeUndefined();
  });

  it("feature-gates Multi-CAD Connector nav for PSAP roles", () => {
    const dispatcher = getRoleNav("dispatcher", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "cad-connector");
    expect(dispatcher?.href).toBe("/test-psap/cad/incidents");
    expect(dispatcher?.feature).toBe("cadConnector");

    const admin = getRoleNav("agencyadmin", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "cad-connector");
    expect(admin?.href).toBe("/test-psap/cad/connectors");
    expect(admin?.feature).toBe("cadConnector");
  });

  it("adds occupant alerts for campus/venue/transit admin and supervisor, not guest services", () => {
    const campus = getRoleNav("CAMPUS_ADMIN", { campusCode: "IU" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "alerts");
    expect(campus?.href).toBe("/app/campus/IU/alerts");
    expect(campus?.feature).toBe("verticalAlerts");

    const guest = getRoleNav("VENUE_GUEST_SERVICES", { venueCode: "MBS" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "alerts");
    expect(guest).toBeUndefined();

    const dispatcher = getRoleNav("dispatcher", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "alerts");
    expect(dispatcher).toBeUndefined();
  });

  it("adds Clery Act compliance nav for campus admin, not dispatcher", () => {
    const campus = getRoleNav("CAMPUS_ADMIN", { campusCode: "IU" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "clery-review");
    expect(campus?.href).toBe("/app/campus/IU/clery/review");
    expect(campus?.feature).toBe("cleryModule");

    const dispatcher = getRoleNav("dispatcher", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "clery-review");
    expect(dispatcher).toBeUndefined();
  });

  it("exposes NexiQ Vision™ on dispatcher media, not supervisor or guest services", () => {
    const dispatcher = getRoleNav("dispatcher", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "rapid-vision");
    expect(dispatcher?.label).toBe("NexiQ Vision™");
    expect(dispatcher?.href).toBe("/test-psap/media?vision=1");
    expect(dispatcher?.feature).toBe("rapidVision");

    const supervisor = getRoleNav("supervisor", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "rapid-vision");
    expect(supervisor).toBeUndefined();

    const guest = getRoleNav("VENUE_GUEST_SERVICES", { venueCode: "MBS" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "rapid-vision");
    expect(guest).toBeUndefined();
  });

  it("exposes Camera AI monitoring to supervisor and agency admin, not dispatcher", () => {
    const supervisor = getRoleNav("supervisor", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "vision-ai");
    expect(supervisor?.href).toBe("/test-psap/supervisor/vision-ai");
    expect(supervisor?.feature).toBe("rapidVisionSceneIntel");

    const admin = getRoleNav("agencyadmin", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "vision-ai");
    expect(admin?.href).toBe("/test-psap/admin/vision-ai");

    const dispatcher = getRoleNav("dispatcher", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "vision-ai");
    expect(dispatcher).toBeUndefined();
  });

  it("exposes Camera AI on campus, venue, and transit consoles", () => {
    const campus = getRoleNav("CAMPUS_ADMIN", { campusCode: "LINCOLNHIGH" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "vision-ai");
    expect(campus?.href).toBe("/app/campus/LINCOLNHIGH/vision-ai");
    expect(campus?.feature).toBe("rapidVisionSceneIntel");

    const venue = getRoleNav("VENUE_SUPERVISOR", { venueCode: "MBS" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "vision-ai");
    expect(venue?.href).toBe("/app/venue/MBS/vision-ai");

    const transit = getRoleNav("TRANSIT_ADMIN", { transitCode: "HVT" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "vision-ai");
    expect(transit?.href).toContain("/vision-ai");
  });

  it("puts Staff Guide on campus, venue, and transit navs but not 911 dispatcher Help", () => {
    const campus = getRoleNav("CAMPUS_ADMIN", { campusCode: "LINCOLNHIGH" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "staff-guide");
    expect(campus?.href).toBe("/app/campus/LINCOLNHIGH/staff-guide");
    expect(campus?.label).toBe("Staff Guide");

    const guest = getRoleNav("VENUE_GUEST_SERVICES", { venueCode: "MBS" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "staff-guide");
    expect(guest?.href).toBe("/app/venue/MBS/staff-guide");

    const transit = getRoleNav("TRANSIT_OPERATOR", { transitCode: "HVT" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "staff-guide");
    expect(transit?.href).toBe("/transit/HVT/staff-guide");

    const dispatcher = getRoleNav("dispatcher", { jurisdiction: "test-psap" })
      .sections.flatMap((s) => s.items)
      .find((i) => i.id === "staff-guide");
    expect(dispatcher).toBeUndefined();
  });
});
