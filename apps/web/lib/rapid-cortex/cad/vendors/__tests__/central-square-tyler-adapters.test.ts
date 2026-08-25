import { describe, expect, it, vi } from "vitest";
import { CentralSquareCadAdapter } from "../CentralSquareCadAdapter";
import { TylerNewWorldCadAdapter } from "../TylerNewWorldCadAdapter";

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("CentralSquareCadAdapter", () => {
  it("maps PascalCase incident fields and unwraps Incidents envelopes", async () => {
    const fetchFn = vi.fn(async () =>
      makeJsonResponse({
        Incidents: [
          {
            IncidentId: "CS-1",
            NatureOfCall: "FIRE",
            Address: "789 Elm St",
            UnitList: "E5,L2",
            Status: "DISPATCHED",
          },
        ],
      }),
    );
    const adapter = new CentralSquareCadAdapter({
      baseUrl: "https://cad.example.com/cs",
      apiKey: "test-key",
      fetchFn,
    });
    const rows = await adapter.searchIncidents({});
    expect(rows).toHaveLength(1);
    expect(rows[0]?.incidentId).toBe("CS-1");
    expect(rows[0]?.callType).toBe("FIRE");
    expect(rows[0]?.units).toEqual(["E5", "L2"]);
  });

  it("blocks write operations", async () => {
    const adapter = new CentralSquareCadAdapter({
      baseUrl: "https://cad.example.com/cs",
      apiKey: "test-key",
      fetchFn: vi.fn(async () => makeJsonResponse({ ok: true })),
    });
    await expect(
      adapter.createDraftUpdate({ incidentId: "1", summary: "x", fields: {}, source: "ai" }),
    ).rejects.toThrow(/disabled/i);
  });
});

describe("TylerNewWorldCadAdapter", () => {
  it("maps New World event fields and unwraps events envelopes", async () => {
    const fetchFn = vi.fn(async () =>
      makeJsonResponse({
        events: [
          {
            eventNumber: "2024-1234",
            callType: "ASSAULT",
            locationAddress: "456 Oak Ave",
            assignedUnits: "P12,F4",
            eventStatus: "ACTIVE",
          },
        ],
      }),
    );
    const adapter = new TylerNewWorldCadAdapter({
      baseUrl: "https://cad.example.com/nwcad",
      apiKey: "test-key",
      fetchFn,
    });
    const rows = await adapter.searchIncidents({});
    expect(rows[0]?.incidentId).toBe("2024-1234");
    expect(rows[0]?.callType).toBe("ASSAULT");
    expect(rows[0]?.location).toBe("456 Oak Ave");
    expect(rows[0]?.units).toEqual(["P12", "F4"]);
  });

  it("blocks write operations", async () => {
    const adapter = new TylerNewWorldCadAdapter({
      baseUrl: "https://cad.example.com/nwcad",
      apiKey: "test-key",
      fetchFn: vi.fn(async () => makeJsonResponse({ ok: true })),
    });
    await expect(
      adapter.submitApprovedUpdate({ incidentId: "1", draftId: "d", approvedByUserId: "u" }),
    ).rejects.toThrow(/disabled/i);
  });
});
