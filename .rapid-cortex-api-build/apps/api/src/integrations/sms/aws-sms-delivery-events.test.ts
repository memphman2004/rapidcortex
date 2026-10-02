import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SNSEvent } from "aws-lambda";
import { handler } from "./aws-sms-delivery-events.js";

function snsEvent(message: unknown): SNSEvent {
  return {
    Records: [
      {
        Sns: { Message: typeof message === "string" ? message : JSON.stringify(message) },
      },
    ],
  } as unknown as SNSEvent;
}

describe("aws-sms-delivery-events", () => {
  let info: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a successful delivery at info", async () => {
    await handler(
      snsEvent({ eventType: "TEXT_DELIVERED", messageId: "m1", messageStatus: "DELIVERED" }),
      {} as never,
      () => {},
    );
    expect(error).not.toHaveBeenCalled();
    expect(JSON.parse(info.mock.calls[0]![0] as string)).toMatchObject({
      eventType: "TEXT_DELIVERED",
      messageId: "m1",
    });
  });

  it("logs a carrier block at error so filtering is visible", async () => {
    await handler(
      snsEvent({ eventType: "TEXT_BLOCKED", messageId: "m2", messageStatus: "BLOCKED" }),
      {} as never,
      () => {},
    );
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.parse(error.mock.calls[0]![0] as string).eventType).toBe("TEXT_BLOCKED");
  });

  it("redacts the recipient but keeps our own sending number", async () => {
    await handler(
      snsEvent({
        eventType: "TEXT_DELIVERED",
        messageId: "m3",
        destinationPhoneNumber: "+15555550100",
        originationPhoneNumber: "+17065550111",
      }),
      {} as never,
      () => {},
    );
    const logged = JSON.parse(info.mock.calls[0]![0] as string);
    expect(logged.destinationMasked).toBe("***0100");
    expect(JSON.stringify(logged)).not.toContain("+15555550100");
    expect(logged.sender).toBe("+17065550111");
  });

  it("does not throw on an unparseable event", async () => {
    await expect(handler(snsEvent("nope"), {} as never, () => {})).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
