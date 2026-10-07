import { describe, expect, it } from "vitest";
import { handler } from "./seoIntelligenceHttp.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";

describe("seoIntelligenceHttp handler", () => {
  it("returns 403 for dispatcher (admin routes)", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        rawPath: "/api/admin/seo/overview",
        routeKey: "GET /api/admin/seo/overview",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("returns 503 when SEO_TOOL_ENABLED is false", async () => {
    const prev = process.env.SEO_TOOL_ENABLED;
    process.env.SEO_TOOL_ENABLED = "false";
    try {
      const res = await invokeHttpHandler(
        handler,
        makeAuthenticatedEvent({
          role: "agencyadmin",
          agencyId: "agency-a",
          rawPath: "/api/admin/seo/settings",
          routeKey: "GET /api/admin/seo/settings",
        }),
      );
      expect(res.statusCode).toBe(503);
    } finally {
      process.env.SEO_TOOL_ENABLED = prev;
    }
  });
});
