import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetLatest = vi.fn();

vi.mock("../../services/triageService.js", () => ({
  TriageService: class {
    getLatest = mockGetLatest;
  },
}));

describe("getTriageResult handler", () => {
  let prev: string | undefined;

  beforeEach(() => {
    mockGetLatest.mockReset();
    prev = process.env.ENABLE_NON_EMERGENCY_TRIAGE;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ENABLE_NON_EMERGENCY_TRIAGE;
    else process.env.ENABLE_NON_EMERGENCY_TRIAGE = prev;
    vi.resetModules();
  });

  it("returns 503 when triage feature is disabled", async () => {
    delete process.env.ENABLE_NON_EMERGENCY_TRIAGE;
    vi.resetModules();
    const { handler } = await import("./getTriageResult.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-1" },
        rawPath: "/api/incidents/inc-1/triage",
        routeKey: "GET /api/incidents/{id}/triage",
      }),
    );
    expect(res.statusCode).toBe(503);
  });

  it("returns 401 when unauthenticated and triage enabled", async () => {
    process.env.ENABLE_NON_EMERGENCY_TRIAGE = "true";
    vi.resetModules();
    const { handler } = await import("./getTriageResult.js");
    const { invokeHttpHandler } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(handler, {
      version: "2.0",
      routeKey: "GET /api/incidents/{id}/triage",
      rawPath: "/api/incidents/inc-1/triage",
      pathParameters: { id: "inc-1" },
      headers: {},
      requestContext: {},
      isBase64Encoded: false,
    } as never);
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when TriageService throws FORBIDDEN (cross-agency / missing incident)", async () => {
    process.env.ENABLE_NON_EMERGENCY_TRIAGE = "true";
    vi.resetModules();
    mockGetLatest.mockRejectedValue(new Error("FORBIDDEN"));
    const { handler } = await import("./getTriageResult.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-x" },
        rawPath: "/api/incidents/inc-x/triage",
        routeKey: "GET /api/incidents/{id}/triage",
      }),
    );
    expect(res.statusCode).toBe(403);
  });
});
