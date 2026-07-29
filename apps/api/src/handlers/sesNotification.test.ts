import { describe, expect, it, vi } from "vitest";

vi.mock("@aws-sdk/client-sesv2", () => {
  const send = vi.fn(async () => ({}));
  return {
    SESv2Client: class {
      send = send;
    },
    PutSuppressedDestinationCommand: class {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

import { processSesNotificationBody } from "../handlers/sesNotification.js";

describe("processSesNotificationBody", () => {
  it("suppresses permanent hard bounces", async () => {
    const result = await processSesNotificationBody({
      notificationType: "Bounce",
      bounce: {
        bounceType: "Permanent",
        bouncedRecipients: [{ emailAddress: "bad@example.gov" }],
      },
      mail: { messageId: "m1" },
    });
    expect(result.suppressed).toEqual(["bad@example.gov"]);
    expect(result.skipped).toEqual([]);
  });

  it("does not suppress transient bounces", async () => {
    const result = await processSesNotificationBody({
      eventType: "Bounce",
      bounce: {
        bounceType: "Transient",
        bouncedRecipients: [{ emailAddress: "temp@example.gov" }],
      },
    });
    expect(result.suppressed).toEqual([]);
    expect(result.skipped).toEqual(["temp@example.gov"]);
  });

  it("suppresses complaints", async () => {
    const result = await processSesNotificationBody({
      notificationType: "Complaint",
      complaint: {
        complainedRecipients: [{ emailAddress: "angry@example.gov" }],
        complaintFeedbackType: "abuse",
      },
    });
    expect(result.suppressed).toEqual(["angry@example.gov"]);
  });
});
