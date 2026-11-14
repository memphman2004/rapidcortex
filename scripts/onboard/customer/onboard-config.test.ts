import { describe, expect, it } from "vitest";
import {
  adminProvisioning,
  dayOneSeats,
  defaultAgencyType,
  groupsToEnsure,
  isValidOnboardPassword,
  parseOnboardEnv,
  productVertical,
  type OnboardPlan,
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
  it("builds a campus (highered) day-0 plan from env", () => {
    const plan = parseOnboardEnv(base);
    expect(plan.vertical).toBe("campus");
    expect(plan.agencyType).toBe("campus");
    expect(plan.agencyVertical).toBe("campus");
    expect(plan.orgCode).toBe("EXU");
    expect(plan.institutionType).toBe("highered");
    expect(plan.adminRole).toBe("campus_admin_highered");
    expect(plan.adminGroups).toContain("CAMPUS_ADMIN_HIGHERED");
    expect(plan.adminGroups).toContain("vertical_campus");
    expect(plan.integrationMode).toBe("mock_adapters");
    expect(plan.agencyId).toBe("test-campus-exu");
  });

  it("builds a campus (k12) plan when CAMPUS_INSTITUTION_TYPE=k12", () => {
    const plan = parseOnboardEnv({ ...base, CAMPUS_INSTITUTION_TYPE: "k12" });
    expect(plan.institutionType).toBe("k12");
    expect(plan.adminRole).toBe("campus_admin_k12");
    expect(plan.adminGroups).toContain("CAMPUS_ADMIN_K12");
    expect(plan.adminGroups).toContain("vertical_campus");
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

  it("maps call_assist to core vertical", () => {
    const plan = parseOnboardEnv({
      ...base,
      VERTICAL: "call_assist",
      AGENCY_NAME: "Example Nexiq Center",
      ORG_CODE: "NEXQ",
    });
    expect(plan.agencyVertical).toBe("core");
    expect(plan.agencyType).toBe("municipality");
    expect(plan.adminRole).toBe("call_assist_admin");
    expect(plan.adminGroups).toContain("CALL_ASSIST_ADMIN");
    expect(plan.adminGroups).toContain("vertical_call_assist");
  });

  it("refuses CAD write-back integration mode", () => {
    expect(() => parseOnboardEnv({ ...base, INTEGRATION_MODE: "bidirectional" })).toThrow(
      /fail-closed/,
    );
  });

  it("rejects invalid CAMPUS_INSTITUTION_TYPE", () => {
    expect(() => parseOnboardEnv({ ...base, CAMPUS_INSTITUTION_TYPE: "university" })).toThrow(
      /k12 or highered/,
    );
  });

  it("parses extra users", () => {
    const plan = parseOnboardEnv({
      ...base,
      EXTRA_USERS_JSON: JSON.stringify([{ email: "guard@example.edu", role: "campus_security_highered" }]),
    });
    expect(plan.extraUsers).toEqual([{ email: "guard@example.edu", role: "campus_security_highered" }]);
  });

  it("parses optional seat emails", () => {
    const plan = parseOnboardEnv({
      ...base,
      VERTICAL: "psap",
      AGENCY_ID: "ga-test-911",
      SUPERVISOR_EMAIL: "supervisor@example.gov",
      DISPATCHER_EMAIL: "dispatcher@example.gov",
    });
    expect(plan.seatEmails.supervisorEmail).toBe("supervisor@example.gov");
    expect(plan.seatEmails.dispatcherEmail).toBe("dispatcher@example.gov");
    expect(plan.seatEmails.analystEmail).toBe("");
  });

  it("rejects malformed seat email", () => {
    expect(() => parseOnboardEnv({ ...base, SUPERVISOR_EMAIL: "not-an-email" })).toThrow(
      /SUPERVISOR_EMAIL must be an email/,
    );
  });
});

describe("helpers", () => {
  it("validates Cognito-style passwords", () => {
    expect(isValidOnboardPassword("short")).toBe(false);
    expect(isValidOnboardPassword("ExamplePass2026!")).toBe(true);
  });

  it("defaults types and admin roles per vertical", () => {
    expect(defaultAgencyType("venue")).toBe("venue");
    expect(defaultAgencyType("call_assist")).toBe("municipality");
    expect(productVertical("psap")).toBe("core");
    expect(productVertical("call_assist")).toBe("core");
    expect(adminProvisioning("transit").groups).toContain("TRANSIT_ADMIN");
  });
});

describe("adminProvisioning", () => {
  it("campus highered returns correct role and group", () => {
    const { role, groups } = adminProvisioning("campus", "highered");
    expect(role).toBe("campus_admin_highered");
    expect(groups).toContain("CAMPUS_ADMIN_HIGHERED");
    expect(groups).toContain("vertical_campus");
  });

  it("campus k12 returns k12 role and group", () => {
    const { role, groups } = adminProvisioning("campus", "k12");
    expect(role).toBe("campus_admin_k12");
    expect(groups).toContain("CAMPUS_ADMIN_K12");
    expect(groups).toContain("vertical_campus");
  });

  it("call_assist returns call_assist_admin role", () => {
    const { role, groups } = adminProvisioning("call_assist");
    expect(role).toBe("call_assist_admin");
    expect(groups).toContain("CALL_ASSIST_ADMIN");
    expect(groups).toContain("vertical_call_assist");
  });
});

describe("groupsToEnsure", () => {
  it("hospital includes hospital_coord", () => {
    const groups = groupsToEnsure("hospital");
    expect(groups.map((g) => g.name)).toContain("hospital_coord");
    expect(groups.map((g) => g.name)).toContain("hospitaladmin");
    expect(groups.map((g) => g.name)).toContain("hospitalstaff");
    expect(groups.map((g) => g.name)).toContain("vertical_hospital");
  });

  it("call_assist includes all three CALL_ASSIST groups and vertical marker", () => {
    const groups = groupsToEnsure("call_assist");
    const names = groups.map((g) => g.name);
    expect(names).toContain("CALL_ASSIST_ADMIN");
    expect(names).toContain("CALL_ASSIST_SUPERVISOR");
    expect(names).toContain("CALL_ASSIST_OPERATOR");
    expect(names).toContain("vertical_call_assist");
  });

  it("campus includes both k12 and highered variants", () => {
    const names = groupsToEnsure("campus").map((g) => g.name);
    expect(names).toContain("CAMPUS_ADMIN_K12");
    expect(names).toContain("CAMPUS_ADMIN_HIGHERED");
    expect(names).toContain("vertical_campus");
  });
});

describe("dayOneSeats", () => {
  function minimalPlan(overrides: Partial<OnboardPlan>): OnboardPlan {
    const base: OnboardPlan = {
      vertical: "psap",
      agencyId: "test-agency",
      agencyName: "Test Agency",
      agencyType: "city",
      agencyVertical: "core",
      state: "GA",
      city: "Atlanta",
      region: "Metro Atlanta",
      timezone: "America/New_York",
      primaryContactName: "Admin",
      primaryContactEmail: "admin@example.com",
      adminEmail: "admin@example.com",
      adminRole: "agencyadmin",
      adminGroups: ["agencyadmin", "vertical_911"],
      orgCode: "TEST",
      institutionType: "highered",
      seatEmails: {
        supervisorEmail: "",
        agencyItEmail: "",
        dispatcherEmail: "",
        analystEmail: "",
        auditorEmail: "",
        securityEmail: "",
        operatorEmail: "",
        guestEmail: "",
        coordinatorEmail: "",
        staffEmail: "",
      },
      integrationMode: "mock_adapters",
      planId: "command",
      dryRun: false,
      seedBilling: false,
      seedPlaceholderQr: false,
      extraUsers: [],
    };
    return { ...base, ...overrides };
  }

  it("psap: admin is seat #1 with agencyadmin role", () => {
    const seats = dayOneSeats(minimalPlan({ vertical: "psap", adminGroups: ["agencyadmin", "vertical_911"] }));
    expect(seats[0].role).toBe("agencyadmin");
    expect(seats[0].groups).toContain("agencyadmin");
    expect(seats[0].groups).toContain("vertical_911");
  });

  it("psap: 6 seats total, only admin has email by default", () => {
    const seats = dayOneSeats(minimalPlan({ vertical: "psap", adminGroups: ["agencyadmin", "vertical_911"] }));
    expect(seats).toHaveLength(6);
    expect(seats.filter((s) => s.email).map((s) => s.role)).toEqual(["agencyadmin"]);
  });

  it("psap: supervisor seat filled when email is set", () => {
    const plan = minimalPlan({
      vertical: "psap",
      adminGroups: ["agencyadmin", "vertical_911"],
      seatEmails: {
        ...minimalPlan({}).seatEmails,
        supervisorEmail: "super@example.gov",
      },
    });
    const seats = dayOneSeats(plan);
    const super_ = seats.find((s) => s.role === "supervisor");
    expect(super_?.email).toBe("super@example.gov");
    expect(super_?.groups).toContain("supervisor");
    expect(super_?.groups).toContain("vertical_911");
  });

  it("campus (highered): admin is campus_admin_highered", () => {
    const plan = minimalPlan({
      vertical: "campus",
      agencyVertical: "campus",
      institutionType: "highered",
      adminRole: "campus_admin_highered",
      adminGroups: ["CAMPUS_ADMIN_HIGHERED", "vertical_campus"],
    });
    const seats = dayOneSeats(plan);
    expect(seats[0].role).toBe("campus_admin_highered");
    expect(seats[0].groups).toContain("CAMPUS_ADMIN_HIGHERED");
    expect(seats[0].groups).toContain("vertical_campus");
  });

  it("campus (k12): all seats use k12 suffix", () => {
    const plan = minimalPlan({
      vertical: "campus",
      agencyVertical: "campus",
      institutionType: "k12",
      adminRole: "campus_admin_k12",
      adminGroups: ["CAMPUS_ADMIN_K12", "vertical_campus"],
    });
    const seats = dayOneSeats(plan);
    for (const seat of seats) {
      expect(seat.role).toMatch(/k12$/);
      expect(seat.groups.some((g) => g.includes("K12"))).toBe(true);
    }
  });

  it("call_assist: 3 seats, roles in correct order", () => {
    const plan = minimalPlan({
      vertical: "call_assist",
      agencyVertical: "core",
      adminRole: "call_assist_admin",
      adminGroups: ["CALL_ASSIST_ADMIN", "vertical_call_assist"],
    });
    const seats = dayOneSeats(plan);
    expect(seats).toHaveLength(3);
    expect(seats.map((s) => s.role)).toEqual([
      "call_assist_admin",
      "call_assist_supervisor",
      "call_assist_operator",
    ]);
    expect(seats.map((s) => s.emailEnvKey)).toEqual(["ADMIN_EMAIL", "SUPERVISOR_EMAIL", "OPERATOR_EMAIL"]);
  });

  it("hospital: coordinator is seat #2 with hospital_coord role", () => {
    const plan = minimalPlan({
      vertical: "hospital",
      agencyVertical: "hospital",
      adminRole: "hospitaladmin",
      adminGroups: ["hospitaladmin", "vertical_hospital"],
      seatEmails: {
        ...minimalPlan({}).seatEmails,
        coordinatorEmail: "coordinator@example.com",
      },
    });
    const seats = dayOneSeats(plan);
    expect(seats[1].role).toBe("hospital_coord");
    expect(seats[1].email).toBe("coordinator@example.com");
    expect(seats[1].groups).toContain("hospital_coord");
  });

  it("venue: 5 seats in admin → supervisor → security → operator → guest order", () => {
    const plan = minimalPlan({
      vertical: "venue",
      agencyVertical: "venue",
      adminRole: "venue_admin",
      adminGroups: ["venue_admin", "vertical_venue"],
    });
    const seats = dayOneSeats(plan);
    expect(seats.map((s) => s.role)).toEqual([
      "venue_admin",
      "venue_supervisor",
      "venue_security",
      "venue_operator",
      "venue_guest",
    ]);
  });

  it("transit: 4 seats in admin → supervisor → security → operator order", () => {
    const plan = minimalPlan({
      vertical: "transit",
      agencyVertical: "transit",
      adminRole: "transit_admin",
      adminGroups: ["TRANSIT_ADMIN", "vertical_transit"],
    });
    const seats = dayOneSeats(plan);
    expect(seats.map((s) => s.role)).toEqual([
      "transit_admin",
      "transit_supervisor",
      "transit_security",
      "transit_operator",
    ]);
  });
});
