import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();

vi.mock("@aws-sdk/client-connect", () => ({
  ConnectClient: class {
    send = send;
  },
  StartOutboundVoiceContactCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

describe("AmazonConnectProvider.startOutboundCallback", () => {
  beforeEach(() => {
    send.mockReset();
    delete process.env.CONNECT_INSTANCE_ID;
    delete process.env.CALL_ASSIST_CONTACT_FLOW_ID;
    delete process.env.CALL_ASSIST_OUTBOUND_CALLER_ID;
  });

  it("does not call Connect when demo", async () => {
    const { AmazonConnectProvider } = await import("./amazon-connect.js");
    const out = await new AmazonConnectProvider().startOutboundCallback({
      destinationNumber: "+18165550123",
      sessionId: "sess-1",
      demo: true,
    });
    expect(out.reason).toBe("mock_outbound");
    expect(send).not.toHaveBeenCalled();
  });

  it("fails closed when outbound env is missing", async () => {
    const { AmazonConnectProvider } = await import("./amazon-connect.js");
    const out = await new AmazonConnectProvider().startOutboundCallback({
      destinationNumber: "+18165550123",
      sessionId: "sess-1",
      demo: false,
    });
    expect(out).toEqual({ ok: false, reason: "connect_outbound_not_configured" });
  });

  it("starts a live outbound contact when configured", async () => {
    process.env.CONNECT_INSTANCE_ID = "instance-1";
    process.env.CALL_ASSIST_CONTACT_FLOW_ID = "flow-1";
    process.env.CALL_ASSIST_OUTBOUND_CALLER_ID = "+18168395256";
    send.mockResolvedValueOnce({ ContactId: "contact-99" });
    const { AmazonConnectProvider } = await import("./amazon-connect.js");
    const out = await new AmazonConnectProvider().startOutboundCallback({
      destinationNumber: "+18165550123",
      sessionId: "sess-1",
      demo: false,
    });
    expect(out).toEqual({ ok: true, contactId: "contact-99", reason: "connect_outbound" });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
