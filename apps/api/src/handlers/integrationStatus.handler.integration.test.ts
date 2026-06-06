import { describe, it, expect } from "vitest";
import { handler } from "./integrationStatus.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "./handlerTestUtils.js";

describe("integrationStatus handler", () => {
  it("returns 403 for dispatcher (admin routes)", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        rawPath: "/api/integration/status",
        routeKey: "GET /api/integration/status",
      }),
    );
    expect(res.statusCode).toBe(403);
  });
});
