import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockListByAgency } = vi.hoisted(() => ({ mockListByAgency: vi.fn() }));

vi.mock("../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {
    listByAgency = mockListByAgency;
  },
}));

import { handler } from "./listIncidents.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "./handlerTestUtils.js";

describe("listIncidents handler", () => {
  beforeEach(() => {
    mockListByAgency.mockReset();
  });

  it("requires agencyId query for rcsuperadmin", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "rcsuperadmin",
        agencyId: "platform",
        rawPath: "/api/incidents",
        routeKey: "GET /api/incidents",
      }),
    );
    expect(res.statusCode).toBe(400);
  });

  it("lists for rcsuperadmin when agencyId is provided", async () => {
    mockListByAgency.mockResolvedValue([]);
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "rcsuperadmin",
        agencyId: "platform",
        rawPath: "/api/incidents",
        routeKey: "GET /api/incidents",
        queryStringParameters: { agencyId: "agency-x" },
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
    expect(mockListByAgency).toHaveBeenCalledWith("agency-x");
  });
});
