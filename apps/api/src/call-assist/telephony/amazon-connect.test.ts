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
  TransferContactCommand: class {
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

describe("AmazonConnectProvider.transferActiveContact", () => {
  beforeEach(() => {
    send.mockReset();
    delete process.env.CONNECT_INSTANCE_ID;
    delete process.env.CALL_ASSIST_CONTACT_FLOW_ID;
  });

  it("fails closed when Connect transfer env is missing", async () => {
    const { AmazonConnectProvider } = await import("./amazon-connect.js");
    const out = await new AmazonConnectProvider().transferActiveContact({
      contactId: "c-1",
      queueArnOrId: "arn:aws:connect:us-east-1:1:instance/i/queue/q-1",
      demo: false,
    });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("connect_transfer_not_configured");
  });

  it("calls TransferContact with queue id extracted from ARN", async () => {
    process.env.CONNECT_INSTANCE_ID = "instance-1";
    process.env.CALL_ASSIST_CONTACT_FLOW_ID = "flow-1";
    send.mockResolvedValueOnce({ ContactId: "c-1" });
    const { AmazonConnectProvider, connectQueueIdFromArn } = await import("./amazon-connect.js");
    expect(connectQueueIdFromArn("arn:aws:connect:us-east-1:1:instance/i/queue/q-99")).toBe("q-99");
    const out = await new AmazonConnectProvider().transferActiveContact({
      contactId: "c-1",
      queueArnOrId: "arn:aws:connect:us-east-1:1:instance/i/queue/q-99",
      demo: false,
    });
    expect(out).toEqual({ ok: true, contactId: "c-1", reason: "connect_transfer" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("returns mock success for demo transfers", async () => {
    const { AmazonConnectProvider } = await import("./amazon-connect.js");
    const out = await new AmazonConnectProvider().transferActiveContact({
      contactId: "c-demo",
      queueArnOrId: "q-1",
      demo: true,
    });
    expect(out).toEqual({ ok: true, contactId: "c-demo", reason: "mock_transfer" });
    expect(send).not.toHaveBeenCalled();
  });
});
