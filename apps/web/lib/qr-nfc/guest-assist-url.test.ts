import { describe, expect, it } from "vitest";
import { guestAssistUrl, guestAssistVertical, isSafeGuestAssistBackPath } from "./guest-assist-url";

describe("guestAssistUrl", () => {
  it("maps unknown verticals to venue and asks Guest Assist for topics-only", () => {
    expect(guestAssistVertical("911")).toBe("venue");
    expect(guestAssistVertical("hospital")).toBe("venue");
    expect(guestAssistVertical("transit")).toBe("transit");
    const url = guestAssistUrl({
      vertical: "transit",
      agencyName: "MARTA",
      location: "Five Points",
      agencyId: "marta-1",
      backPath: "/report/01hxyz?medium=nfc",
    });
    expect(url.startsWith("/rc-guest-assist.html?")).toBe(true);
    const qs = new URLSearchParams(url.split("?")[1]);
    expect(qs.get("v")).toBe("transit");
    expect(qs.get("name")).toBe("MARTA");
    expect(qs.get("loc")).toBe("Five Points");
    expect(qs.get("agency")).toBe("marta-1");
    expect(qs.get("topics")).toBe("1");
    expect(qs.get("back")).toBe("/report/01hxyz?medium=nfc");
  });

  it("rejects open-redirect back paths", () => {
    expect(isSafeGuestAssistBackPath("//evil.example")).toBe(false);
    expect(isSafeGuestAssistBackPath("https://evil.example")).toBe(false);
    expect(isSafeGuestAssistBackPath("/login")).toBe(false);
    expect(isSafeGuestAssistBackPath("/report/abc")).toBe(true);
  });
});
