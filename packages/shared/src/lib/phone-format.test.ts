import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, normalizePhoneE164, qrNfcCallButtonLabel } from "./phone-format.js";

describe("normalizePhoneE164", () => {
  it("normalizes 10-digit US numbers", () => {
    expect(normalizePhoneE164("8085428061")).toBe("+18085428061");
    expect(normalizePhoneE164("(706) 555-1234")).toBe("+17065551234");
  });

  it("preserves existing E.164", () => {
    expect(normalizePhoneE164("+17065551234")).toBe("+17065551234");
  });
});

describe("formatPhoneDisplay", () => {
  it("formats US E.164 numbers", () => {
    expect(formatPhoneDisplay("+17065551234")).toBe("(706) 555-1234");
    expect(formatPhoneDisplay("7065551234")).toBe("(706) 555-1234");
  });

  it("returns input when not standard US length", () => {
    expect(formatPhoneDisplay("+442079460123")).toBe("+442079460123");
  });
});

describe("qrNfcCallButtonLabel", () => {
  it("maps verticals to labels", () => {
    expect(qrNfcCallButtonLabel("campus")).toBe("Call Campus Security");
    expect(qrNfcCallButtonLabel("venue")).toBe("Call Venue Security");
  });
});
