import { describe, expect, it } from "vitest";
import {
  createBrowserPinpointLinkBodySchema,
  createPinpointLinkBodySchema,
} from "./schemas.js";

describe("createPinpointLinkBodySchema", () => {
  it("requires E.164 phone for SMS channel", () => {
    expect(() => createPinpointLinkBodySchema.parse({})).toThrow();
    const parsed = createPinpointLinkBodySchema.parse({ callerPhoneE164: "+15551234567" });
    expect(parsed.callerPhoneE164).toBe("+15551234567");
  });
});

describe("createBrowserPinpointLinkBodySchema", () => {
  it("accepts browser channel without phone (no SMS)", () => {
    const parsed = createBrowserPinpointLinkBodySchema.parse({
      channel: "browser",
      consentGrantedAt: "2026-10-14T12:00:00.000Z",
    });
    expect(parsed.channel).toBe("browser");
    expect(parsed.callerPhoneE164).toBeUndefined();
  });

  it("accepts optional callback phone on browser channel", () => {
    const parsed = createBrowserPinpointLinkBodySchema.parse({
      channel: "browser",
      callerPhoneE164: "+15551234567",
    });
    expect(parsed.callerPhoneE164).toBe("+15551234567");
  });

  it("rejects non-browser channel", () => {
    expect(() =>
      createBrowserPinpointLinkBodySchema.parse({ channel: "sms" }),
    ).toThrow();
  });
});
