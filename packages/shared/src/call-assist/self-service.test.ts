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
  });

  it("rewrites the marketing host to the live app for token pages", () => {
    const rewritten = resolveSelfServiceLink({
      publicBaseUrl: "https://www.rapidcortex.us",
      token: "tok_abc",
      portalUrl: "https://www.kcpd.org/online-reporting",
    });
    expect(rewritten.tokenized).toBe(true);
    expect(rewritten.link).toBe("https://app.rapidcortex.us/call-assist/report/tok_abc");
  });

  it("falls back to the live app host when no public base is set", () => {
    const fallback = resolveSelfServiceLink({
      publicBaseUrl: "",
      token: "tok_abc",
      portalUrl: "https://portal.example.gov",
    });
    expect(fallback.tokenized).toBe(true);
    expect(fallback.link).toBe("https://app.rapidcortex.us/call-assist/report/tok_abc");
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
