import { describe, expect, it } from "vitest";
import { rcLiteRouteNeedsIdempotentHeader, resolveRcLiteRoute, RC_LITE_V1_ROUTES } from "./v1-registry.js";

describe("resolveRcLiteRoute", () => {
  it("matches intelligence + CAD export stubs", () => {
    expect(resolveRcLiteRoute(["intelligence", "analyze-incident"], "POST")?.scope).toBe("intelligence:write");
    expect(resolveRcLiteRoute(["cad", "export"], "POST")?.productModule).toBe("cad_export");
    expect(resolveRcLiteRoute(["cad", "export", "x7", "status"], "GET")?.path).toBe("cad/export/:id/status");
  });

  it("returns null when method mismatches", () => {
    expect(resolveRcLiteRoute(["intelligence", "analyze-incident"], "GET")).toBe(null);
  });

  it("signals idempotent requirements for destructive routes only", () => {
    const intel = RC_LITE_V1_ROUTES.find((r) => r.path === "intelligence/analyze-incident")!;
    expect(rcLiteRouteNeedsIdempotentHeader(intel, "POST")).toBe(true);
    expect(rcLiteRouteNeedsIdempotentHeader(intel, "GET")).toBe(false);
    const webhook = RC_LITE_V1_ROUTES.find((r) => r.path === "webhooks/endpoints")!;
    expect(rcLiteRouteNeedsIdempotentHeader(webhook, "POST")).toBe(true);
    expect(rcLiteRouteNeedsIdempotentHeader(webhook, "GET")).toBe(false);
  });
});
