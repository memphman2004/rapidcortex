import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockListByAgency } = vi.hoisted(() => ({ mockListByAgency: vi.fn() }));

vi.mock("../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    listByAgency = mockListByAgency;
  },
}));

import { handler } from "./listAuditEvents.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "./handlerTestUtils.js";

describe("listAuditEvents handler", () => {
  beforeEach(() => {
    mockListByAgency.mockReset();
  });

  it("returns 403 for dispatcher", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        rawPath: "/api/audit-events",
        routeKey: "GET /api/audit-events",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("returns normalized events for admin", async () => {
    mockListByAgency.mockResolvedValue([
      {
        eventId: "e1",
        agencyId: "agency-a",
        actorId: "u1",
        type: "incident.created",
        details: { password: "secret" },
        createdAt: new Date().toISOString(),
        resourceType: "incident",
        resourceId: "inc1",
      },
    ]);
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "agencyadmin",
        agencyId: "agency-a",
        rawPath: "/api/audit-events",
        routeKey: "GET /api/audit-events",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as {
      items: Array<{ details?: Record<string, unknown> }>;
    };
    expect(body.items[0]?.details?.password).toBe("[redacted]");
  });
});
