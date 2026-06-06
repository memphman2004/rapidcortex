import { describe, expect, it } from "vitest";
import {
  parseWebhookSignatureVariants,
  signRcLiteWebhookBody,
  verifyRcLiteWebhookSignature,
} from "./webhook-signing.js";

describe("rc-lite webhook signing", () => {
  it("verifies payloads using constant-time comparison", () => {
    const secret = "whsec_fixture";
    const raw = '{"type":"cad_export.ready"}';
    const timestamp = Math.floor(Date.now() / 1000);
    const hex = signRcLiteWebhookBody(secret, timestamp, raw);

    expect(
      verifyRcLiteWebhookSignature(secret, timestamp, raw, parseWebhookSignatureVariants(`v1=${hex}`), {
        toleranceSec: 60,
      }).ok,
    ).toBe(true);

    expect(
      verifyRcLiteWebhookSignature(secret, timestamp + 10_000, raw, [`${hex}`], {
        toleranceSec: 120,
      }).ok,
    ).toBe(false);
  });

  it("parses comma-delivered signature envelopes (hex payloads only)", () => {
    expect(parseWebhookSignatureVariants("v1=abc123, v9=beefcafefeedabcd")).toEqual(["abc123", "beefcafefeedabcd"]);
  });
});
