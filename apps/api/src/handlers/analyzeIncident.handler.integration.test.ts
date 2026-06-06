import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAnalyze } = vi.hoisted(() => ({ mockAnalyze: vi.fn() }));

vi.mock("../services/analysisService.js", () => ({
  AnalysisService: class {
    analyze = mockAnalyze;
  },
}));

import { handler } from "./analyzeIncident.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "./handlerTestUtils.js";

describe("analyzeIncident handler", () => {
  beforeEach(() => {
    mockAnalyze.mockReset();
  });

  it("maps FORBIDDEN to HTTP 403", async () => {
    mockAnalyze.mockRejectedValue(new Error("FORBIDDEN"));
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-1" },
        rawPath: "/api/incidents/inc-1/analyze",
        routeKey: "POST /api/incidents/{id}/analyze",
      }),
    );
    expect(res.statusCode).toBe(403);
  });
});
