import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("postAgencySopUploadUrl handler", () => {
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env.ENABLE_SOP_PROTOCOL_AI;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ENABLE_SOP_PROTOCOL_AI;
    else process.env.ENABLE_SOP_PROTOCOL_AI = prev;
    vi.resetModules();
  });

  it("returns 503 when SOP feature is disabled", async () => {
    delete process.env.ENABLE_SOP_PROTOCOL_AI;
    vi.resetModules();
    const { handler } = await import("./postAgencySopUploadUrl.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "agencyadmin",
        agencyId: "agency-a",
        pathParameters: { id: "agency-a" },
        rawPath: "/api/agencies/agency-a/sop/upload-url",
        routeKey: "POST /api/agencies/{id}/sop/upload-url",
        body: "{}",
      }),
    );
    expect(res.statusCode).toBe(503);
  });

  it("returns 403 for dispatcher (admin-only route)", async () => {
    process.env.ENABLE_SOP_PROTOCOL_AI = "true";
    vi.resetModules();
    const { handler } = await import("./postAgencySopUploadUrl.js");
    const { invokeHttpHandler, makeAuthenticatedEvent } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "agency-a" },
        rawPath: "/api/agencies/agency-a/sop/upload-url",
        routeKey: "POST /api/agencies/{id}/sop/upload-url",
        body: "{}",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    process.env.ENABLE_SOP_PROTOCOL_AI = "true";
    vi.resetModules();
    const { handler } = await import("./postAgencySopUploadUrl.js");
    const { invokeHttpHandler } = await import("../handlerTestUtils.js");
    const res = await invokeHttpHandler(handler, {
      version: "2.0",
      routeKey: "POST /api/agencies/{id}/sop/upload-url",
      rawPath: "/api/agencies/agency-a/sop/upload-url",
      pathParameters: { id: "agency-a" },
      headers: {},
      requestContext: {},
      body: "{}",
      isBase64Encoded: false,
    } as never);
    expect(res.statusCode).toBe(401);
  });
});
