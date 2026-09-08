import { describe, expect, it } from "vitest";
import { ingestConnectCallerIdentity, intakeFromCallerIdentity } from "./ani-ali.js";
import { identityFromConnectStart } from "../lex/get-agency-for-number.js";

describe("Connect ANI/ALI ingest", () => {
  it("maps Connect customer endpoint and ALI attributes into intake", () => {
    const id = ingestConnectCallerIdentity({
      attributes: {
        "CustomerEndpoint.Address": "+18165550100",
        ALI: "4200 Main Street",
        Apt: "4B",
        City: "Kansas City",
        State: "MO",
        Zip: "64111",
      },
    });
    expect(id.ani).toBe("+18165550100");
    expect(id.apartmentSuite).toBe("4B");
    expect(id.locationSource).toBe("ANI_ALI");
    const intake = intakeFromCallerIdentity(id);
    expect(intake.locationText).toMatch(/4200 Main Street/);
    expect(intake.locationSource).toBe("ANI_ALI");
    expect(intake.callbackNumber).toBe("+18165550100");
  });

  it("reads ANI from the Connect customer endpoint on call start", () => {
    const id = identityFromConnectStart({
      Details: {
        ContactData: {
          CustomerEndpoint: { Address: "+18165550199" },
          Attributes: { ALI: "800 Walnut" },
        },
      },
    });
    expect(id.ani).toBe("+18165550199");
    expect(id.aliAddress).toMatch(/800 Walnut/);
  });
});
