import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendWithAwsSms } from "./awsSmsProvider.js";

const send = vi.fn();

vi.mock("@aws-sdk/client-pinpoint-sms-voice-v2", () => ({
  PinpointSMSVoiceV2Client: class {
    send = send;
  },
  SendTextMessageCommand: class {
    constructor(public readonly input: Record<string, unknown>) {}
  },
}));

function lastInput(): Record<string, unknown> {
  return (send.mock.calls[0]![0] as { input: Record<string, unknown> }).input;
}

describe("sendWithAwsSms", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("short-circuits when useSimulator is true", async () => {
    const r = await sendWithAwsSms({
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

  it("returns sent when the send succeeds", async () => {
    send.mockResolvedValue({ MessageId: "msg-123" });
    const r = await sendWithAwsSms({
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
    expect(lastInput().MessageType).toBe("TRANSACTIONAL");
  });

  it("sends from the agency's own number when one is resolved", async () => {
    send.mockResolvedValue({ MessageId: "msg-1" });
    await sendWithAwsSms({
      toPhoneE164: "+15555550100",
      messageBody: "x",
      agencyId: "columbus-ga",
      incidentId: "i",
      region: "us-east-1",
      useSimulator: false,
      messageType: "silent_text",
      poolId: "pool-shared",
      agencySenderE164: "+17065550111",
    });
    expect(lastInput().OriginationIdentity).toBe("+17065550111");
  });

  it("falls back to the shared pool when the agency has no number", async () => {
    send.mockResolvedValue({ MessageId: "msg-2" });
    await sendWithAwsSms({
      toPhoneE164: "+15555550100",
      messageBody: "x",
      agencyId: "columbus-ga",
      incidentId: "i",
      region: "us-east-1",
      useSimulator: false,
      messageType: "silent_text",
      poolId: "pool-shared",
    });
    expect(lastInput().OriginationIdentity).toBe("pool-shared");
  });

  it("lets the account auto-select when neither is configured", async () => {
    send.mockResolvedValue({ MessageId: "msg-3" });
    await sendWithAwsSms({
      toPhoneE164: "+15555550100",
      messageBody: "x",
      agencyId: "a",
      incidentId: "i",
      region: "us-east-1",
      useSimulator: false,
      messageType: "silent_text",
    });
    expect(lastInput().OriginationIdentity).toBeUndefined();
  });

  it("attaches the configuration set so delivery events are emitted", async () => {
    send.mockResolvedValue({ MessageId: "msg-4" });
    await sendWithAwsSms({
      toPhoneE164: "+15555550100",
      messageBody: "x",
      agencyId: "a",
      incidentId: "i",
      region: "us-east-1",
      useSimulator: false,
      messageType: "silent_text",
      configurationSetName: "rapid-cortex-sms-dev",
    });
    expect(lastInput().ConfigurationSetName).toBe("rapid-cortex-sms-dev");
  });

  it("fails with non-retryable INVALID_E164 when destination is not E.164", async () => {
    const r = await sendWithAwsSms({
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
    const r = await sendWithAwsSms({
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
