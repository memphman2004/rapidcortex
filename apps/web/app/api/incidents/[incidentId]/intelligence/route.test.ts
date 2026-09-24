import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const proxyToAuthUpstream = vi.fn(async () => new Response("ok", { status: 200 }));

vi.mock("@/lib/server/auth-upstream-proxy", () => ({
  proxyToAuthUpstream: (...args: unknown[]) => proxyToAuthUpstream(...args),
}));

describe("GET /api/incidents/:incidentId/intelligence", () => {
  beforeEach(() => {
    proxyToAuthUpstream.mockClear();
  });

  it("proxies to NexiQ Vision /vision/intelligence", async () => {
    const { GET } = await import("./route");
    const request = new NextRequest(
      "http://localhost/api/incidents/inc_8d17220b/intelligence",
    );
    await GET(request, { params: Promise.resolve({ incidentId: "inc_8d17220b" }) });
    expect(proxyToAuthUpstream).toHaveBeenCalledWith(
      request,
      "/api/incidents/inc_8d17220b/vision/intelligence",
    );
  });
});
