import { describe, expect, it } from "vitest";
import {
  homeownerIdFromPartnerAccount,
  isUnmatchedHomeownerAgency,
  RING_HOMEOWNER_UNMATCHED_AGENCY_ID,
} from "./ring-homeowner-id.js";

describe("ring-homeowner-id", () => {
  it("builds stable hw: homeowner ids", () => {
    expect(homeownerIdFromPartnerAccount("abc-123")).toBe("hw:abc-123");
  });

  it("rejects empty partner account ids", () => {
    expect(() => homeownerIdFromPartnerAccount("  ")).toThrow(/required/i);
  });

  it("treats public sentinel as unmatched", () => {
    expect(isUnmatchedHomeownerAgency(RING_HOMEOWNER_UNMATCHED_AGENCY_ID)).toBe(true);
    expect(isUnmatchedHomeownerAgency(null)).toBe(true);
    expect(isUnmatchedHomeownerAgency("agency-ga-1")).toBe(false);
  });
});
