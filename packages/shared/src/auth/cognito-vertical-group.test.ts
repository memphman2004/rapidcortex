import { describe, expect, it } from "vitest";
import { cognitoVerticalGroupFromUser } from "./cognito-vertical-group.js";

describe("cognitoVerticalGroupFromUser", () => {
  it("maps platform agency and RC-internal roles", () => {
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "__platform__", role: "rcsuperadmin" }),
    ).toBe("vertical_platform");
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "test-agency", role: "rcadmin" }),
    ).toBe("vertical_platform");
  });

  it("maps campus/venue/transit/hospital by agencyId substring or role prefix", () => {
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "test-campus-uga", role: "dispatcher" }),
    ).toBe("vertical_campus");
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "uga", role: "CAMPUS_ADMIN" }),
    ).toBe("vertical_campus");
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "test-venue-mbs", role: "venue_operator" }),
    ).toBe("vertical_venue");
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "test-transit-hvt", role: "transit_security" }),
    ).toBe("vertical_transit");
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "test-hospital-1", role: "hospital_staff" }),
    ).toBe("vertical_hospital");
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "kcpd", role: "call_assist_operator" }),
    ).toBe("vertical_call_assist");
  });

  it("maps remaining tenant users to 911 PSAP", () => {
    expect(
      cognitoVerticalGroupFromUser({
        agencyId: "test-agency",
        role: "dispatcher",
        email: "dispatcher@appsondemand.net",
      }),
    ).toBe("vertical_911");
    expect(
      cognitoVerticalGroupFromUser({ agencyId: "pa-erie", role: "supervisor" }),
    ).toBe("vertical_911");
  });

  it("skips users with no agency and no vertical role", () => {
    expect(cognitoVerticalGroupFromUser({ agencyId: "", role: "dispatcher" })).toBeNull();
  });
});
