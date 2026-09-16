import { describe, expect, it } from "vitest";
import {
  adminProvisioning,
  defaultAgencyType,
  isValidOnboardPassword,
  parseOnboardEnv,
  productVertical,
} from "./onboard-config";

const base = {
  VERTICAL: "campus",
  AGENCY_NAME: "Example University",
  STATE: "GA",
  CITY: "Athens",
  ADMIN_EMAIL: "safety-admin@example.edu",
  ORG_CODE: "EXU",
  ONBOARD_ADMIN_PASSWORD: "ExamplePass2026!",
};

describe("parseOnboardEnv", () => {
  it("builds a campus day-0 plan from env", () => {
    const plan = parseOnboardEnv(base);
    expect(plan.vertical).toBe("campus");
    expect(plan.agencyType).toBe("campus");
    expect(plan.agencyVertical).toBe("campus");
    expect(plan.orgCode).toBe("EXU");
    expect(plan.adminRole).toBe("campus_admin");
    expect(plan.integrationMode).toBe("mock_adapters");
    expect(plan.agencyId).toBe("test-campus-exu");
  });

  it("uses explicit AGENCY_ID", () => {
    const plan = parseOnboardEnv({ ...base, AGENCY_ID: "uga-athens-safety" });
    expect(plan.agencyId).toBe("uga-athens-safety");
  });

  it("maps hospital to municipality type + hospital vertical", () => {
    const plan = parseOnboardEnv({
      ...base,
      VERTICAL: "hospital",
      AGENCY_NAME: "Example Health",
      ORG_CODE: "EXH",
      HOSPITAL_ID: "hosp-exh",
    });
    expect(plan.agencyType).toBe("municipality");
    expect(plan.agencyVertical).toBe("hospital");
    expect(plan.adminRole).toBe("hospitaladmin");
    expect(plan.hospitalId).toBe("hosp-exh");
  });

  it("maps psap to core vertical", () => {
    const plan = parseOnboardEnv({
      ...base,
      VERTICAL: "psap",
      AGENCY_TYPE: "county",
      AGENCY_ID: "ga-muscogee-911",
    });
    expect(plan.agencyVertical).toBe("core");
    expect(plan.agencyType).toBe("county");
    expect(plan.adminRole).toBe("agencyadmin");
  });

  it("refuses CAD write-back integration mode", () => {
    expect(() => parseOnboardEnv({ ...base, INTEGRATION_MODE: "bidirectional" })).toThrow(
      /fail-closed/,
    );
  });

  it("parses extra users", () => {
    const plan = parseOnboardEnv({
      ...base,
      EXTRA_USERS_JSON: JSON.stringify([
        { email: "guard@example.edu", role: "campus_security" },
      ]),
    });
    expect(plan.extraUsers).toEqual([{ email: "guard@example.edu", role: "campus_security" }]);
  });
});

describe("helpers", () => {
  it("validates Cognito-style passwords", () => {
    expect(isValidOnboardPassword("short")).toBe(false);
    expect(isValidOnboardPassword("ExamplePass2026!")).toBe(true);
  });

  it("defaults types and admin roles per vertical", () => {
    expect(defaultAgencyType("venue")).toBe("venue");
    expect(productVertical("psap")).toBe("core");
    expect(adminProvisioning("transit").groups).toContain("TRANSIT_ADMIN");
  });
});
