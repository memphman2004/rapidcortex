import { describe, it, expect } from "vitest";
import { buildSmsBody, type RingOwnerNotificationInput } from "./ringOwnerNotificationService.js";

/**
 * The original consent SMS ran 808 characters over six segments with three long
 * `execute-api.amazonaws.com` links. US carriers dropped it after Twilio had already returned
 * 201, so it looked delivered in CloudWatch. These bounds keep that from regressing.
 */

const GSM7_SINGLE = 160;
const GSM7_CONCATENATED = 153;
const MAX_SEGMENTS = 2;

function segmentCount(body: string): number {
  if (body.length <= GSM7_SINGLE) return 1;
  return Math.ceil(body.length / GSM7_CONCATENATED);
}

const baseInput: RingOwnerNotificationInput = {
  ownerUserId: "owner-1",
  agencyId: "agency-1",
  agencyName: "Columbus Police Department",
  incidentId: "inc-1",
  incidentCategoryLabel: "Disturbance / Noise",
  deviceName: "Living room",
  requestedDurationMinutes: 30,
  consentUrl:
    "https://7c70vqd1p5.execute-api.us-east-1.amazonaws.com/api/integrations/ring/c/AbCdEfGhIjKlMnOpQrStUv",
  approveUrl: "https://example.test/approve",
  declineUrl: "https://example.test/decline",
};

describe("buildSmsBody", () => {
  it("fits within two GSM-7 segments on the raw execute-api hostname", () => {
    const body = buildSmsBody(baseInput);
    expect(segmentCount(body)).toBeLessThanOrEqual(MAX_SEGMENTS);
  });

  it("carries exactly one link so carriers do not read it as spam", () => {
    const body = buildSmsBody(baseInput);
    expect(body.match(/https?:\/\//g)).toHaveLength(1);
    expect(body).toContain(baseInput.consentUrl);
  });

  it("stays ASCII — a single non-GSM-7 character halves the per-segment budget", () => {
    const body = buildSmsBody({
      ...baseInput,
      agencyName: "Columbus Police Department",
    });
    // eslint-disable-next-line no-control-regex
    expect(/^[\x00-\x7F]*$/.test(body)).toBe(true);
    expect(body).not.toContain("™");
  });

  it("falls back to the approve link when no landing URL is supplied", () => {
    const body = buildSmsBody({ ...baseInput, consentUrl: undefined });
    expect(body).toContain(baseInput.approveUrl);
  });

  it("keeps an opt-out instruction for A2P compliance", () => {
    expect(buildSmsBody(baseInput)).toContain("STOP");
  });
});
