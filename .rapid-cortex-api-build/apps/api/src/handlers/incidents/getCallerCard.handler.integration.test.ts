import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGet = vi.hoisted(() => vi.fn());
const mockAuditCreate = vi.hoisted(() => vi.fn());

vi.mock("../../services/callerCardService.js", () => ({
  CallerCardService: class {
    get = mockGet;
  },
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = mockAuditCreate;
  },
}));

import { handler } from "./getCallerCard.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../handlerTestUtils.js";
import type { GetCallerCardResponse } from "rapid-cortex-shared";

describe("getCallerCard handler", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockAuditCreate.mockReset();
  });

  it("rejects when role cannot access caller card", async () => {
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "auditor",
        agencyId: "agency-a",
        pathParameters: { id: "inc-1" },
        rawPath: "/api/incidents/inc-1/caller-card",
        routeKey: "GET /api/incidents/{id}/caller-card",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("returns 200 and audits view", async () => {
    const card: GetCallerCardResponse = {
      incidentId: "inc-1",
      agencyId: "agency-a",
      normalizedAddress: "100 main st",
      location: { address: "100 Main", source: "incident" },
      priorIncidents: [],
      priorIncidentsTotal: 0,
      premiseNotes: [],
      addressTraumaFlags: { count: 0, mostRecentAt: null, mostRecentTraumaFlagType: null },
      cadData: { status: "mock", source: "cad" },
      provenanceSummary: "x",
      generatedAt: "2025-01-01T00:00:00.000Z",
    };
    mockGet.mockResolvedValue(card);
    mockAuditCreate.mockResolvedValue(undefined);

    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-1" },
        rawPath: "/api/incidents/inc-1/caller-card",
        routeKey: "GET /api/incidents/{id}/caller-card",
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when service denies", async () => {
    mockGet.mockResolvedValue(null);
    const res = await invokeHttpHandler(
      handler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "agency-a",
        pathParameters: { id: "inc-x" },
        rawPath: "/api/incidents/inc-x/caller-card",
        routeKey: "GET /api/incidents/{id}/caller-card",
      }),
    );
    expect(res.statusCode).toBe(403);
  });
});
