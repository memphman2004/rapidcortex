import { describe, expect, it } from "vitest";
import {
  evaluateExternalRoute,
  externalRouteConfigIssues,
  recommendRoute,
  withExternalRouteDefaults,
} from "./routing.js";
import { kcpdExternalAgencySeed } from "./kcpd-tenant-seed.js";

describe("outside-agency routing runtime", () => {
  it("marks a directory row incomplete without PSTN or SIP", () => {
    const issues = externalRouteConfigIssues(
      withExternalRouteDefaults({
        agencyId: "a1",
        externalAgencyId: "x",
        externalAgencyName: "Parks",
        phoneNumber: "",
        description: "",
        transferType: "WARM",
        callerExperienceScript: "transferring",
        transferSummaryTemplate: "{issue}",
        enabled: true,
        triageClassifications: ["PARKING"],
      }),
    );
    expect(issues).toContain("missing_pstn_and_sip");
  });

  it("falls back to a human when the destination is after hours with human policy", () => {
    const rec = recommendRoute({
      classification: "PUBLIC_WORKS",
      externalAgencies: [
        {
          ...kcpdExternalAgencySeed("a1")[2]!,
          hoursAllDay: false,
          hours: [{ day: new Date().getDay(), closed: true, openMinutes: 0, closeMinutes: 0 }],
          afterHoursPolicy: "human",
        },
      ],
    });
    expect(rec.destinationType).toBe("CALL_TAKER");
    expect(rec.runtimeDisposition).toBe("after_hours");
  });

  it("rejects call types the destination does not accept", () => {
    const decision = evaluateExternalRoute({
      route: kcpdExternalAgencySeed("a1")[2]!,
      classification: "PARKING",
    });
    expect(decision.disposition).toBe("type_not_accepted");
  });

  it("treats SIP-only destinations as ready when call types and script exist", () => {
    const route = withExternalRouteDefaults({
      agencyId: "a1",
      externalAgencyId: "sip-parks",
      externalAgencyName: "Parks SIP",
      phoneNumber: "",
      sipUri: "sip:parks@psap.example",
      description: "",
      transferType: "WARM",
      callerExperienceScript: "I'm transferring you to Parks.",
      transferSummaryTemplate: "{issue}",
      enabled: true,
      triageClassifications: ["PARKING"],
      acceptedCallTypes: ["PARKING"],
    });
    expect(externalRouteConfigIssues(route)).toEqual([]);
    expect(route.configurationStatus).toBe("ready");
    expect(
      evaluateExternalRoute({ route, classification: "PARKING" }).disposition,
    ).toBe("proceed");
  });

  it("blocks fallback policy until a fallback PSTN or SIP is configured", () => {
    const issues = externalRouteConfigIssues(
      withExternalRouteDefaults({
        agencyId: "a1",
        externalAgencyId: "x",
        externalAgencyName: "Parks",
        phoneNumber: "8165550100",
        description: "",
        transferType: "WARM",
        callerExperienceScript: "transferring",
        transferSummaryTemplate: "{issue}",
        enabled: true,
        triageClassifications: ["PARKING"],
        acceptedCallTypes: ["PARKING"],
        transferFailurePolicy: "fallback",
      }),
    );
    expect(issues).toContain("missing_fallback_destination");
  });
});
