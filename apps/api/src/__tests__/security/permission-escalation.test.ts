/**
 * Permission boundaries (CJIS):
 * - Create tenant: only RC Super Admin (`rcsuperadmin`) (cannot be escalated from dispatcher or agency admin).
 * - Read-only (`auditor`): cannot use dispatcher panel actions (patch).
 * - Cross-jurisdiction read via share: cannot dispatch (patch) as recipient — owner-only.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createAgencyBodySchema } from "rapid-cortex-shared";
import { handler as createAgencyHandler } from "../../handlers/createAgency.js";
import { handler as patchIncidentHandler } from "../../handlers/patchIncident.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../../handlers/handlerTestUtils.js";
import { makeTestIncident, minimalCreateAgencyBody, TEST_AGENCY_B } from "../fixtures/multi-tenant-setup.js";

const { mockIncidentGet, mockShareFind, mockPatchFields } = vi.hoisted(() => ({
  mockIncidentGet: vi.fn(),
  mockShareFind: vi.fn(),
  mockPatchFields: vi.fn(),
}));

vi.mock("../../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {
    get = mockIncidentGet;
    listByAgency = vi.fn();
    patchDispatchFields = mockPatchFields;
  },
}));

vi.mock("../../repositories/incidentShareRepository.js", () => ({
  IncidentShareRepository: class {
    findActiveForRecipient = mockShareFind;
  },
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = vi.fn();
  },
}));

describe("permission escalation (RBAC)", () => {
  beforeEach(() => {
    mockIncidentGet.mockReset();
    mockShareFind.mockReset();
    mockPatchFields.mockReset();
  });

  it("dispatcher cannot create a new agency (tenant management)", async () => {
    const body = createAgencyBodySchema.parse(minimalCreateAgencyBody("laredo-tx"));
    const res = await invokeHttpHandler(
      createAgencyHandler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: "harris-tx",
        userId: "disp-1",
        body: JSON.stringify(body),
        rawPath: "/api/agencies",
        routeKey: "POST /api/agencies",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("read-only user cannot mark incident reviewed (dispatcher action)", async () => {
    mockIncidentGet.mockResolvedValue(
      makeTestIncident({ incidentId: "inc-ro", agencyId: "harris-tx" }),
    );
    const res = await invokeHttpHandler(
      patchIncidentHandler,
      makeAuthenticatedEvent({
        role: "auditor",
        agencyId: "harris-tx",
        pathParameters: { id: "inc-ro" },
        body: JSON.stringify({ action: "mark_reviewed" }),
        rawPath: "/api/incidents/inc-ro",
        routeKey: "PATCH /api/incidents/{id}",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("shared recipient cannot dispatch actions on a foreign incident (read-only for patch)", async () => {
    const inc = makeTestIncident({ incidentId: "inc-s", agencyId: TEST_AGENCY_B });
    mockIncidentGet.mockResolvedValue(inc);
    mockShareFind.mockResolvedValue({
      shareId: "sh2",
      incidentId: "inc-s",
      ownerAgencyId: TEST_AGENCY_B,
      recipientAgencyId: "harris-tx",
      status: "active",
      createdAt: new Date().toISOString(),
      createdByUserId: "admin-b",
      ttlEpoch: Math.floor((Date.now() + 3_600_000) / 1000),
    });
    const res = await invokeHttpHandler(
      patchIncidentHandler,
      makeAuthenticatedEvent({
        role: "commsupervisor",
        agencyId: "harris-tx",
        userId: "sup-a",
        pathParameters: { id: "inc-s" },
        body: JSON.stringify({ action: "escalate_supervisor" }),
        rawPath: "/api/incidents/inc-s",
        routeKey: "PATCH /api/incidents/{id}",
      }),
    );
    expect(res.statusCode).toBe(403);
    expect(mockPatchFields).not.toHaveBeenCalled();
  });
});
