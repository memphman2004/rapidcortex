import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const mockRun = vi.fn();

vi.mock("../../services/sopService.js", () => ({
  SopService: class {
    runDetectionAndPersist = mockRun;
  },
}));

describe("detectIncidentType handler", () => {
  let prevSop: string | undefined;

  beforeEach(() => {
    mockRun.mockReset();
    prevSop = process.env.ENABLE_SOP_PROTOCOL_AI;
  });

  afterEach(() => {
    if (prevSop === undefined) delete process.env.ENABLE_SOP_PROTOCOL_AI;
    else process.env.ENABLE_SOP_PROTOCOL_AI = prevSop;
    vi.resetModules();
  });

  it("returns 503 when ENABLE_SOP_PROTOCOL_AI is not true", async () => {
    delete process.env.ENABLE_SOP_PROTOCOL_AI;
    vi.resetModules();
    const { handler } = await import("./detectIncidentType.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-1" },
        rawPath: "/api/incidents/inc-1/protocols/sop/detect",
        routeKey: "POST /api/incidents/{id}/protocols/sop/detect",
        body: "{}",
      }),
    );
    expect(res.statusCode).toBe(503);
  });

  it("returns 401 when unauthenticated and feature enabled", async () => {
    process.env.ENABLE_SOP_PROTOCOL_AI = "true";
    vi.resetModules();
    const { handler } = await import("./detectIncidentType.js");
    const { invokeHttpHandler } = await import("../handlerTestUtils.js");
    const event = {
      version: "2.0",
      routeKey: "POST /api/incidents/{id}/protocols/sop/detect",
      rawPath: "/api/incidents/inc-1/protocols/sop/detect",
      rawQueryString: "",
      pathParameters: { id: "inc-1" },
      headers: {},
      requestContext: {},
      body: "{}",
      isBase64Encoded: false,
    } as unknown as APIGatewayProxyEventV2;
    const res = await invokeHttpHandler(handler, event);
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when SopService returns null (tenant / incident guard)", async () => {
    process.env.ENABLE_SOP_PROTOCOL_AI = "true";
    vi.resetModules();
    mockRun.mockResolvedValue(null);
    const { handler } = await import("./detectIncidentType.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-foreign" },
        rawPath: "/api/incidents/inc-foreign/protocols/sop/detect",
        routeKey: "POST /api/incidents/{id}/protocols/sop/detect",
        body: "{}",
      }),
    );
    expect(res.statusCode).toBe(403);
  });
});
