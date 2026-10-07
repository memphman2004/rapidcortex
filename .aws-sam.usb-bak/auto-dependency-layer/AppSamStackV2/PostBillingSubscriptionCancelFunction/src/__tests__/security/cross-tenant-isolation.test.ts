/**
 * Cross-tenant isolation (CJIS):
 * - Authenticated users only see own-tenant data (unless RC Admin or explicit share).
 * - Cross-jurisdiction share is read-only for patch/dispatch paths (see incident service).
 * - Incident ID guessing does not leak existence (403 both for wrong-tenant and unknown in get path).
 * - Active share: resolveIncidentRead returns `shared`; no share: null for other agency’s incident.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Incident, IncidentShareRecord } from "rapid-cortex-shared";
import { TranscriptService } from "../../services/transcriptService.js";
import { resolveIncidentRead } from "../../lib/incidentReadAccess.js";
import { handler as getIncidentHandler } from "../../handlers/getIncident.js";
import { handler as listIncidentsHandler } from "../../handlers/listIncidents.js";
import { invokeHttpHandler, makeAuthenticatedEvent } from "../../handlers/handlerTestUtils.js";
import type { TranscriptChunkInput } from "rapid-cortex-shared";
import {
  TEST_AGENCY_A,
  TEST_AGENCY_B,
  TEST_INCIDENT_A,
  TEST_INCIDENT_B,
  makeTestIncident,
  makeUserContext,
} from "../fixtures/multi-tenant-setup.js";

const { mockIncidentGet, mockListByAgency, mockShareFind } = vi.hoisted(() => ({
  mockIncidentGet: vi.fn(),
  mockListByAgency: vi.fn(),
  mockShareFind: vi.fn(),
}));

vi.mock("../../repositories/incidentRepository.js", () => ({
  IncidentRepository: class {
    get = mockIncidentGet;
    listByAgency = mockListByAgency;
  },
}));

vi.mock("../../repositories/incidentShareRepository.js", () => ({
  IncidentShareRepository: class {
    findActiveForRecipient = mockShareFind;
  },
}));

describe("cross-tenant isolation", () => {
  beforeEach(() => {
    mockIncidentGet.mockReset();
    mockListByAgency.mockReset();
    mockShareFind.mockReset();
    mockShareFind.mockResolvedValue(null);
  });

  it("denies Agency A user from reading Agency B incident by id", async () => {
    mockIncidentGet.mockResolvedValue(
      makeTestIncident({ incidentId: TEST_INCIDENT_B, agencyId: TEST_AGENCY_B }),
    );

    const res = await invokeHttpHandler(
      getIncidentHandler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: TEST_AGENCY_A,
        userId: "user-a",
        pathParameters: { id: TEST_INCIDENT_B },
        rawPath: `/api/incidents/${TEST_INCIDENT_B}`,
        routeKey: "GET /api/incidents/{id}",
      }),
    );
    expect(res.statusCode).toBe(403);
  });

  it("lists only the caller agency (ignores forged query agency for non–RC Admin)", async () => {
    mockListByAgency.mockImplementation(async (agencyId: string) => {
      expect(agencyId).toBe(TEST_AGENCY_A);
      return [makeTestIncident({ incidentId: TEST_INCIDENT_A, agencyId: TEST_AGENCY_A })];
    });

    const res = await invokeHttpHandler(
      listIncidentsHandler,
      makeAuthenticatedEvent({
        role: "dispatcher",
        agencyId: TEST_AGENCY_A,
        userId: "user-a",
        queryStringParameters: { agencyId: TEST_AGENCY_B },
        rawPath: "/api/incidents",
        routeKey: "GET /api/incidents",
      }),
    );
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? "{}") as { items: Incident[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.agencyId).toBe(TEST_AGENCY_A);
  });

  it("does not return 200 with another tenant payload when ids are guessed", async () => {
    mockIncidentGet.mockResolvedValue(
      makeTestIncident({ incidentId: "inc_guessed", agencyId: TEST_AGENCY_B }),
    );
    const res = await invokeHttpHandler(
      getIncidentHandler,
      makeAuthenticatedEvent({
        role: "commsupervisor",
        agencyId: TEST_AGENCY_A,
        pathParameters: { id: "inc_guessed" },
        rawPath: "/api/incidents/inc_guessed",
        routeKey: "GET /api/incidents/{id}",
      }),
    );
    expect(res.statusCode).not.toBe(200);
  });

  it("resolveIncidentRead: no access to other agency incident when share is missing", async () => {
    mockIncidentGet.mockResolvedValue(makeTestIncident({ incidentId: "inc-no-share", agencyId: TEST_AGENCY_B }));
    const r = await resolveIncidentRead("inc-no-share", makeUserContext({ userId: "u1", agencyId: TEST_AGENCY_A, role: "dispatcher" }));
    expect(r).toBeNull();
  });

  it("resolveIncidentRead: active cross-jurisdiction share grants read as shared", async () => {
    const inc = makeTestIncident({ incidentId: "inc-shared", agencyId: TEST_AGENCY_B });
    mockIncidentGet.mockResolvedValue(inc);
    const share: IncidentShareRecord = {
      shareId: "sh_1",
      incidentId: "inc-shared",
      ownerAgencyId: TEST_AGENCY_B,
      recipientAgencyId: TEST_AGENCY_A,
      status: "active",
      createdAt: new Date().toISOString(),
      createdByUserId: "admin-b",
      ttlEpoch: Math.floor((Date.now() + 3_600_000) / 1000),
    };
    mockShareFind.mockResolvedValue(share);
    const r = await resolveIncidentRead("inc-shared", makeUserContext({ userId: "u1", agencyId: TEST_AGENCY_A, role: "dispatcher" }));
    expect(r).not.toBeNull();
    expect(r!.kind).toBe("shared");
    expect(r!.incident.incidentId).toBe("inc-shared");
  });

  it("rejects appending STT / transcript to another agency incident (not shared write)", async () => {
    mockIncidentGet.mockResolvedValue(
      makeTestIncident({ incidentId: "inc-foreign", agencyId: TEST_AGENCY_B }),
    );
    const svc = new TranscriptService();
    const chunk: TranscriptChunkInput = { speaker: "caller", text: "Cross-tenant must not be writable." };
    await expect(
      svc.add("inc-foreign", chunk, makeUserContext({ userId: "u1", agencyId: TEST_AGENCY_A, role: "dispatcher" })),
    ).rejects.toMatchObject({ message: "FORBIDDEN" });
  });

  it("rejects listing transcript for another agency incident when no share exists", async () => {
    mockIncidentGet.mockResolvedValue(makeTestIncident({ incidentId: "inc-list", agencyId: TEST_AGENCY_B }));
    const svc = new TranscriptService();
    await expect(
      svc.list("inc-list", makeUserContext({ userId: "u1", agencyId: TEST_AGENCY_A, role: "dispatcher" })),
    ).rejects.toMatchObject({ message: "FORBIDDEN" });
  });

  /*
   * TODO(prod) — Section 3.2: extend with HTTP mocks for tenant isolation on analytics + media proxies,
   * and assert rcsuperadmin breakout paths emit `admin.staff_access`-style audits with ticket linkage.
   */
});
