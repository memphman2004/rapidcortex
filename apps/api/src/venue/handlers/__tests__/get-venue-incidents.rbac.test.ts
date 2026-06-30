import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListVenueIncidents } = vi.hoisted(() => ({
  mockListVenueIncidents: vi.fn(),
}));

vi.mock("../../venue-incident-service.js", () => ({
  listVenueIncidents: mockListVenueIncidents,
}));

import { handler } from "../get-venue-incidents.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../../../handlers/handlerTestUtils.js";
import { status as patchVenueIncidentStatusHandler } from "../../../handlers/venue/venue-incident-updates-handlers.js";

describe("venue incidents RBAC — guest services boundary", () => {
  beforeEach(() => {
    mockListVenueIncidents.mockReset();
    mockListVenueIncidents.mockResolvedValue({
      incidents: [{ id: "MBS-1", status: "open", source: "qr" }],
      cursor: null,
    });
  });

  it.each(["venue_guest", "VENUE_GUEST_SERVICES"] as const)(
    "denies list for %s at the API layer (incidents.view must not inherit from auditor)",
    async (role) => {
      const res = await invokeHttpHandler(
        handler,
        makeAuthenticatedEvent({
          role,
          agencyId: "test-venue-mbs",
          queryStringParameters: { venueCode: "MBS" },
          rawPath: "/api/venue/incidents",
          routeKey: "GET /api/venue/incidents",
        }),
      );

      expect(res.statusCode).toBe(403);
      expect(mockListVenueIncidents).not.toHaveBeenCalled();
    },
  );

  it("allows venue supervisor to list incidents for matching venue code", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "venue_supervisor",
        agencyId: "test-venue-mbs",
        queryStringParameters: { venueCode: "MBS" },
        rawPath: "/api/venue/incidents",
        routeKey: "GET /api/venue/incidents",
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(mockListVenueIncidents).toHaveBeenCalled();
  });

  it.each(["venue_guest", "VENUE_GUEST_SERVICES"] as const)(
    "denies incident status patch (ASSIGN/RESOLVE) for %s",
    async (role) => {
      const res = await invokeHttpHandler(
        patchVenueIncidentStatusHandler,
        makeAuthenticatedEvent({
          role,
          agencyId: "test-venue-mbs",
          pathParameters: { incidentId: "MBS-1" },
          body: JSON.stringify({ status: "assigned" }),
          rawPath: "/api/incidents/MBS-1/status",
          routeKey: "PATCH /api/incidents/{incidentId}/status",
          method: "PATCH",
        }),
      );

      expect(res.statusCode).toBe(403);
    },
  );
});
