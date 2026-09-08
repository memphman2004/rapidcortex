import { describe, expect, it } from "vitest";
import { withCallAssistAgencyQuery } from "./call-assist-api";

describe("withCallAssistAgencyQuery", () => {
  it("appends agencyId for RC tenant override", () => {
    expect(withCallAssistAgencyQuery("/api/call-assist/sessions", "kcpd")).toBe(
      "/api/call-assist/sessions?agencyId=kcpd",
    );
    expect(withCallAssistAgencyQuery("/api/call-assist/sessions?status=open", "kcpd")).toBe(
      "/api/call-assist/sessions?status=open&agencyId=kcpd",
    );
  });

  it("omits platform sentinel and empty ids so customer calls stay JWT-scoped", () => {
    expect(withCallAssistAgencyQuery("/api/call-assist/ui-profile")).toBe("/api/call-assist/ui-profile");
    expect(withCallAssistAgencyQuery("/api/call-assist/ui-profile", null)).toBe("/api/call-assist/ui-profile");
    expect(withCallAssistAgencyQuery("/api/call-assist/ui-profile", "__platform__")).toBe(
      "/api/call-assist/ui-profile",
    );
  });
});
