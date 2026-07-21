import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { invokeHttpHandler, makeUnauthenticatedEvent } from "./handlerTestUtils.js";

const { mockDdbSend } = vi.hoisted(() => ({
  mockDdbSend: vi.fn(),
}));

vi.mock("../repositories/baseRepository.js", () => ({
  ddb: { send: mockDdbSend },
}));

vi.mock("../lib/env.js", () => ({
  env: {
    enableInsideTheCortex: true,
    marketingLeadsTable: "rapid-cortex-marketing-leads-test",
  },
}));

import { handler } from "./marketing-unsubscribe.js";

const TOKEN = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("marketing-unsubscribe handler", () => {
  beforeEach(() => {
    mockDdbSend.mockReset();
  });

  it("marks lead unsubscribed via token lookup", async () => {
    mockDdbSend
      .mockResolvedValueOnce({
        Item: { pk: `TOKEN#${TOKEN}`, sk: "UNSUBSCRIBE", email: "alex@psap.example", leadId: "lead-1" },
      })
      .mockResolvedValueOnce({});

    const res = await invokeHttpHandler(
      handler,
      makeUnauthenticatedEvent({
        routeKey: "POST /api/marketing/unsubscribe",
        rawPath: "/api/marketing/unsubscribe",
        body: JSON.stringify({ token: TOKEN }),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toEqual({ success: true });
    expect(mockDdbSend.mock.calls[0]?.[0]).toBeInstanceOf(GetCommand);
    expect(mockDdbSend.mock.calls[1]?.[0]).toBeInstanceOf(UpdateCommand);
    const update = mockDdbSend.mock.calls[1]?.[0] as UpdateCommand;
    const input = update.input as {
      Key: { pk: string; sk: string };
      ExpressionAttributeValues: Record<string, string>;
    };
    expect(input.Key).toEqual({ pk: "LEAD#alex@psap.example", sk: "PROFILE" });
    expect(input.ExpressionAttributeValues[":unsub"]).toBe("unsubscribed");
  });

  it("returns success when token is unknown (no leak)", async () => {
    mockDdbSend.mockResolvedValueOnce({ Item: undefined });
    const res = await invokeHttpHandler(
      handler,
      makeUnauthenticatedEvent({
        routeKey: "POST /api/marketing/unsubscribe",
        rawPath: "/api/marketing/unsubscribe",
        body: JSON.stringify({ token: TOKEN }),
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toEqual({ success: true });
    expect(mockDdbSend).toHaveBeenCalledTimes(1);
  });

  it("rejects non-UUID tokens before Dynamo access", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeUnauthenticatedEvent({
        routeKey: "POST /api/marketing/unsubscribe",
        rawPath: "/api/marketing/unsubscribe",
        body: JSON.stringify({ token: "not-a-token" }),
      }),
    );
    expect(res.statusCode).toBe(400);
    expect(mockDdbSend).not.toHaveBeenCalled();
  });
});
