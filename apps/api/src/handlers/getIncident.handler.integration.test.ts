import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Incident } from "rapid-cortex-shared";

const { mockResolveIncidentRead } = vi.hoisted(() => ({
  mockResolveIncidentRead: vi.fn(),
}));

vi.mock("../lib/incidentReadAccess.js", () => ({
  resolveIncidentRead: mockResolveIncidentRead,
}));

import { handler } from "./getIncident.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "./handlerTestUtils.js";

describe("getIncident handler", () => {
  beforeEach(() => {
    mockResolveIncidentRead.mockReset();
  });

  it("returns 403-style payload when tenant does not own incident", async () => {
    mockResolveIncidentRead.mockResolvedValue(null);

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc_other" },
        rawPath: "/api/incidents/inc_other",
        routeKey: "GET /api/incidents/{id}",
      }),
    );
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body ?? "{}") as { error?: string };
    expect(body.error).toMatch(/not found|access denied/i);
  });

  it("returns incident when agency matches", async () => {
    const inc: Incident = {
      incidentId: "inc_own",
      agencyId: "agency-a",
      title: "Fire",
      category: "fire",
      urgency: "high",
      status: "active",
      source: "manual",
      confidence: null,
      escalationFlag: false,
      summary: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockResolveIncidentRead.mockResolvedValue({ incident: inc, kind: "owner" });

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc_own" },
        rawPath: "/api/incidents/inc_own",
        routeKey: "GET /api/incidents/{id}",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as Incident;
    expect(body.incidentId).toBe("inc_own");
    expect(body.agencyId).toBe("agency-a");
  });
});
