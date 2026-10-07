import { describe, it, expect, vi } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "./addTranscriptChunk.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "./handlerTestUtils.js";

vi.mock("../voice/multilingualLambdaEnv.js", () => ({
  getMultilingualConfigBlockResponse: () => null,
}));

describe("addTranscriptChunk handler", () => {
  it("returns 401 when user context is missing", async () => {
    const event = {
      version: "2.0",
      routeKey: "POST /api/incidents/{id}/transcript",
      rawPath: "/api/incidents/inc-1/transcript",
      rawQueryString: "",
      pathParameters: { id: "inc-1" },
      headers: {},
      requestContext: {},
      body: JSON.stringify({
        speaker: "caller",
        text: "smoke on second floor",
      }),
      isBase64Encoded: false,
    } as unknown as APIGatewayProxyEventV2;
    const res = await invokeHttpHandler(handler, event);
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 when incident id path param is missing", async () => {
    const res = await invokeHttpHandler(handler, {
      ...makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        rawPath: "/api/incidents//transcript",
        routeKey: "POST /api/incidents/{id}/transcript",
        pathParameters: {},
      }),
      body: JSON.stringify({
        speaker: "caller",
        text: "hello",
      }),
    });
    expect(res.statusCode).toBe(400);
  });
});
