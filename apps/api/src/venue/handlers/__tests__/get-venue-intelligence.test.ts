import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VenueIntelligence } from "../../venue-types.js";

const { mockGetIntelligence, mockAuditCreate } = vi.hoisted(() => ({
  mockGetIntelligence: vi.fn(),
  mockAuditCreate: vi.fn(),
}));

vi.mock("../../venue-intelligence-service.js", () => ({
  VenueIntelligenceService: class {
    getIntelligence = mockGetIntelligence;
  },
}));

vi.mock("../../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = mockAuditCreate;
  },
}));

import { handler } from "../get-venue-intelligence.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../../../handlers/handlerTestUtils.js";

const facilityFixture: VenueIntelligence = {
  facility: {
    pk: "FACILITY#fac-1",
    sk: "PROFILE",
    facilityId: "fac-1",
    agencyId: "agency-a",
    name: "Test Arena",
    address: "100 Main St",
    addressHash: "hash",
    lat: 0,
    lng: 0,
    facilityType: "ARENA",
    floorCount: 2,
    timezone: "America/Chicago",
    status: "ACTIVE",
    emergencyContacts: [],
    cameraRoutingEnabled: false,
    enrolledBy: "admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  assets: [],
  nearestAEDs: [],
  nearestExits: [],
  nearestFirePanel: null,
  stagingAreas: [],
  musterPoints: [],
  relevantPlans: [],
  cameras: [],
  activeOverlays: [],
  responderCheckins: [],
};

describe("getVenueIntelligence handler", () => {
  beforeEach(() => {
    mockGetIntelligence.mockReset();
    mockAuditCreate.mockReset();
    mockAuditCreate.mockResolvedValue(undefined);
  });

  it("returns 403 when user has no incidents.view permission", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "hospitaladmin",
        agencyId: "agency-a",
        queryStringParameters: { address: "100 Main St" },
        rawPath: "/api/venue/intelligence",
        routeKey: "GET /api/venue/intelligence",
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(mockGetIntelligence).not.toHaveBeenCalled();
  });

  it("scopes venue lookup to the authenticated user agencyId (tenant isolation)", async () => {
    mockGetIntelligence.mockResolvedValue(null);

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-b",
        queryStringParameters: { address: "100 Main St" },
        rawPath: "/api/venue/intelligence",
        routeKey: "GET /api/venue/intelligence",
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(mockGetIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({ agencyId: "agency-b", address: "100 Main St" }),
    );
  });

  it("returns 200 with facility payload when auth passes and Dynamo returns data", async () => {
    mockGetIntelligence.mockResolvedValue(facilityFixture);

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        queryStringParameters: { address: "100 Main St", incidentId: "inc-1" },
        rawPath: "/api/venue/intelligence",
        routeKey: "GET /api/venue/intelligence",
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as { intelligence: VenueIntelligence };
    expect(body.intelligence.facility.facilityId).toBe("fac-1");
    expect(mockAuditCreate).toHaveBeenCalled();
  });

  it("returns 200 with null facility when address hash has no match in Dynamo", async () => {
    mockGetIntelligence.mockResolvedValue(null);

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        queryStringParameters: { address: "999 Unknown Rd" },
        rawPath: "/api/venue/intelligence",
        routeKey: "GET /api/venue/intelligence",
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as { intelligence: VenueIntelligence | null };
    expect(body.intelligence).toBeNull();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when address query param is not provided", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        queryStringParameters: { incidentId: "inc-1" },
        rawPath: "/api/venue/intelligence",
        routeKey: "GET /api/venue/intelligence",
      }),
    );

    expect(res.statusCode).toBe(400);
    expect(mockGetIntelligence).not.toHaveBeenCalled();
  });
});
