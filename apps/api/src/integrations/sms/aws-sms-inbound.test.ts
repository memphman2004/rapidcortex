import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SNSEvent } from "aws-lambda";

const { routeInboundSms } = vi.hoisted(() => ({ routeInboundSms: vi.fn() }));

vi.mock("../../services/smsInboundRouter.js", () => ({ routeInboundSms }));

const { handler } = await import("./aws-sms-inbound.js");

function snsEvent(message: unknown): SNSEvent {
  return {
    Records: [
      {
        Sns: { Message: typeof message === "string" ? message : JSON.stringify(message) },
      },
    ],
  } as unknown as SNSEvent;
}

const inbound = {
  originationNumber: "+15555550100",
  destinationNumber: "+17065550111",
  messageBody: "HELP room 214",
  inboundMessageId: "inbound-1",
};

describe("aws-sms-inbound", () => {
  beforeEach(() => {
    routeInboundSms.mockReset();
    routeInboundSms.mockResolvedValue("handled");
  });

  it("routes an inbound message using the destination number", async () => {
    await handler(snsEvent(inbound), {} as never, () => {});
    expect(routeInboundSms).toHaveBeenCalledTimes(1);
    expect(routeInboundSms.mock.calls[0]![0]).toMatchObject({
      toPhone: "+17065550111",
      callerPhone: "+15555550100",
      rawBody: "HELP room 214",
    });
  });

  it("normalizes params to the Twilio shape so intake sees one format", async () => {
    await handler(snsEvent(inbound), {} as never, () => {});
    expect(routeInboundSms.mock.calls[0]![0].inboundParams).toMatchObject({
      From: "+15555550100",
      To: "+17065550111",
      Body: "HELP room 214",
      Provider: "aws",
    });
  });

  it("ignores an empty body rather than routing a blank incident", async () => {
    await handler(snsEvent({ ...inbound, messageBody: "   " }), {} as never, () => {});
    expect(routeInboundSms).not.toHaveBeenCalled();
  });

  it("ignores unparseable payloads without throwing", async () => {
    await expect(handler(snsEvent("not json"), {} as never, () => {})).resolves.toBeUndefined();
    expect(routeInboundSms).not.toHaveBeenCalled();
  });

  it("swallows routing errors so SNS does not redeliver into intake twice", async () => {
    routeInboundSms.mockRejectedValue(new Error("intake down"));
    await expect(handler(snsEvent(inbound), {} as never, () => {})).resolves.toBeUndefined();
  });
});
