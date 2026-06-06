import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockListFlags = vi.fn();

vi.mock("../../services/wellnessService.js", () => ({
  WellnessService: class {
    listFlags = mockListFlags;
  },
}));

describe("listTraumaFlags handler", () => {
  let prevEn: string | undefined;
  let prevTbl: string | undefined;

  beforeEach(() => {
    mockListFlags.mockReset();
    prevEn = process.env.ENABLE_DISPATCHER_WELLNESS;
    prevTbl = process.env.TRAUMA_FLAGS_TABLE;
  });

  afterEach(() => {
    if (prevEn === undefined) delete process.env.ENABLE_DISPATCHER_WELLNESS;
    else process.env.ENABLE_DISPATCHER_WELLNESS = prevEn;
    if (prevTbl === undefined) delete process.env.TRAUMA_FLAGS_TABLE;
    else process.env.TRAUMA_FLAGS_TABLE = prevTbl;
    vi.resetModules();
  });

  it("returns 503 when wellness is disabled", async () => {
    delete process.env.ENABLE_DISPATCHER_WELLNESS;
    process.env.TRAUMA_FLAGS_TABLE = "test-trauma-flags";
    vi.resetModules();
    const { handler } = await import("./listTraumaFlags.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "commsupervisor",
        agencyId: "agency-a",
        rawPath: "/api/wellness/trauma-flags",
        routeKey: "GET /api/wellness/trauma-flags",
      }),
    );
    expect(res.statusCode).toBe(503);
  });

  it("returns 403 for dispatcher when wellness is enabled", async () => {
    process.env.ENABLE_DISPATCHER_WELLNESS = "true";
    process.env.TRAUMA_FLAGS_TABLE = "test-trauma-flags";
    vi.resetModules();
    const { handler } = await import("./listTraumaFlags.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        rawPath: "/api/wellness/trauma-flags",
        routeKey: "GET /api/wellness/trauma-flags",
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(mockListFlags).not.toHaveBeenCalled();
  });

  it("returns 200 for supervisor and scopes list to caller agency via service", async () => {
    process.env.ENABLE_DISPATCHER_WELLNESS = "true";
    process.env.TRAUMA_FLAGS_TABLE = "test-trauma-flags";
    vi.resetModules();
    mockListFlags.mockResolvedValue([]);
    const { handler } = await import("./listTraumaFlags.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "commsupervisor",
        agencyId: "agency-a",
        rawPath: "/api/wellness/trauma-flags",
        routeKey: "GET /api/wellness/trauma-flags",
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(mockListFlags).toHaveBeenCalledTimes(1);
    const arg = mockListFlags.mock.calls[0]![0] as { agencyId: string };
    expect(arg.agencyId).toBe("agency-a");
  });
});
