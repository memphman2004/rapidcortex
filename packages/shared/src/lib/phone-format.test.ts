import { describe, expect, it } from "vitest";
import {
  formatPhoneDisplay,
  isValidUSPhone,
  maskPhoneInput,
  normalizePhoneE164,
  qrNfcCallButtonLabel,
  toE164,
} from "./phone-format.js";

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

  it("handles empty values", () => {
    expect(formatPhoneDisplay("")).toBe("");
    expect(formatPhoneDisplay(null)).toBe("");
  });
});

describe("toE164", () => {
  it("normalizes US formats", () => {
    expect(toE164("(706) 555-1234")).toBe("+17065551234");
    expect(toE164("+17065551234")).toBe("+17065551234");
  });

  it("returns null for incomplete input", () => {
    expect(toE164("123")).toBeNull();
    expect(toE164("")).toBeNull();
  });
});

describe("maskPhoneInput", () => {
  it("masks progressively", () => {
    expect(maskPhoneInput("706")).toBe("(706");
    expect(maskPhoneInput("7065551234")).toBe("(706) 555-1234");
  });
});

describe("isValidUSPhone", () => {
  it("validates complete US numbers", () => {
    expect(isValidUSPhone("(706) 555-1234")).toBe(true);
    expect(isValidUSPhone("706")).toBe(false);
  });
});

describe("qrNfcCallButtonLabel", () => {
  it("maps verticals to labels", () => {
    expect(qrNfcCallButtonLabel("campus")).toBe("Call Campus Security");
    expect(qrNfcCallButtonLabel("venue")).toBe("Call Venue Security");
  });
});
