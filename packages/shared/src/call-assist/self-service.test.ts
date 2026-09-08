import { describe, expect, it } from "vitest";
import {
  buildSelfServiceSmsBody,
  callerRequestedSmsLink,
  resolveSelfServiceLink,
  shouldOfferOnlineReportingSms,
} from "./self-service.js";

describe("Call Assist SMS self-service", () => {
  it("offers only when eligible with a portal URL", () => {
    expect(
      shouldOfferOnlineReportingSms({
        onlineReportingEligible: true,
        portalUrl: "https://reports.example.gov",
        alreadyOffered: false,
        emergencyDetected: false,
      }),
    ).toBe(true);
    expect(
      shouldOfferOnlineReportingSms({
        onlineReportingEligible: true,
        portalUrl: "",
        alreadyOffered: false,
        emergencyDetected: false,
      }),
    ).toBe(false);
    expect(
      shouldOfferOnlineReportingSms({
        onlineReportingEligible: true,
        portalUrl: "https://reports.example.gov",
        alreadyOffered: false,
        emergencyDetected: true,
      }),
    ).toBe(false);
  });

  it("builds a tokenized link when a public base URL exists", () => {
    const tokenized = resolveSelfServiceLink({
      publicBaseUrl: "https://app.example.gov/",
      token: "tok_abc",
      portalUrl: "https://portal.example.gov",
    });
    expect(tokenized.tokenized).toBe(true);
    expect(tokenized.link).toBe("https://app.example.gov/call-assist/report/tok_abc");
    const direct = resolveSelfServiceLink({
      publicBaseUrl: "",
      token: "tok_abc",
      portalUrl: "https://portal.example.gov",
    });
    expect(direct.tokenized).toBe(false);
    expect(direct.link).toBe("https://portal.example.gov");
  });

  it("keeps SMS copy non-emergency", () => {
    const body = buildSelfServiceSmsBody({
      agencyDisplayName: "Metro ECC",
      link: "https://app.example.gov/call-assist/report/t",
    });
    expect(body).toContain("not for emergencies");
    expect(body).toContain("dial 911");
    expect(callerRequestedSmsLink("please text me a link")).toBe(true);
  });
});
