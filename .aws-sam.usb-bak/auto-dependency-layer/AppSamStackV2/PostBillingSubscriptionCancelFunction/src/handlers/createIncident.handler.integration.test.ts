import { describe, it, expect } from "vitest";
import { handler } from "./createIncident.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "./handlerTestUtils.js";

describe("createIncident handler", () => {
  it("returns 401 when unauthenticated even if body fails schema (no schema leakage to anonymous clients)", async () => {
    const res = await invokeHttpHandler(handler, {
      version: "2.0",
      rawPath: "/api/incidents",
      routeKey: "POST /api/incidents",
      rawQueryString: "",
      headers: {},
      requestContext: {} as never,
      body: JSON.stringify({}),
      isBase64Encoded: false,
    });
    expect(res.statusCode).toBe(401);
  });

  it("forbids auditor before persistence", async () => {
    const res = await invokeHttpHandler(handler, {
      ...makeAuthenticatedEvent({
        role: "auditor",
        agencyId: "agency-a",
        rawPath: "/api/incidents",
        routeKey: "POST /api/incidents",
      }),
      body: JSON.stringify({ title: "Smoke incident title", source: "manual" }),
    });
    expect(res.statusCode).toBe(403);
  });
});
