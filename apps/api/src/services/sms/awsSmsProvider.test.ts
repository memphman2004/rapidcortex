import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendWithAwsSns } from "./awsSmsProvider.js";

const send = vi.fn();

vi.mock("@aws-sdk/client-sns", () => ({
  SNSClient: class {
    send = send;
  },
  PublishCommand: class {
    constructor(public readonly input: unknown) {}
  },
}));

describe("sendWithAwsSns", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("short-circuits when useSimulator is true", async () => {
    const r = await sendWithAwsSns({
      toPhoneE164: "+15555550100",
      messageBody: "x",
      agencyId: "a",
      incidentId: "i",
      region: "us-east-1",
      useSimulator: true,
      messageType: "media_upload",
    });
    expect(r.status).toBe("sent");
    expect(r.messageId).toBe("aws-simulator");
    expect(send).not.toHaveBeenCalled();
  });

  it("returns sent when SNS publish succeeds", async () => {
    send.mockResolvedValue({ MessageId: "msg-123" });
    const r = await sendWithAwsSns({
      toPhoneE164: "+15555550100",
      messageBody: "x",
      agencyId: "a",
      incidentId: "i",
      region: "us-east-1",
      useSimulator: false,
      messageType: "media_upload",
    });
    expect(r.status).toBe("sent");
    expect(r.messageId).toBe("msg-123");
  });

  it("fails with non-retryable INVALID_E164 when destination is not E.164", async () => {
    const r = await sendWithAwsSns({
      toPhoneE164: "555-1212",
      messageBody: "x",
      agencyId: "a",
      incidentId: "i",
      region: "us-east-1",
      useSimulator: false,
      messageType: "media_upload",
    });
    expect(r.status).toBe("failed");
    expect(r.errorCode).toBe("INVALID_E164");
    expect(r.retryable).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("classifies invalid parameter as non-retryable failure", async () => {
    send.mockRejectedValue({ name: "InvalidParameter", message: "Invalid parameter: PhoneNumber" });
    const r = await sendWithAwsSns({
      toPhoneE164: "+15555550100",
      messageBody: "x",
      agencyId: "a",
      incidentId: "i",
      region: "us-east-1",
      useSimulator: false,
      messageType: "live_video",
    });
    expect(r.status).toBe("failed");
    expect(r.retryable).toBe(false);
    expect(r.errorCode).toBe("InvalidParameter");
  });
});
