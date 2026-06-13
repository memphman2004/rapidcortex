import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, qrNfcCallButtonLabel } from "./phone-format.js";

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
