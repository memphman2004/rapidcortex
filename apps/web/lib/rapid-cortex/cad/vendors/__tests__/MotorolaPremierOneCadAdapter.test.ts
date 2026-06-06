import { describe, expect, it, vi } from "vitest";
import { MotorolaPremierOneCadAdapter } from "../MotorolaPremierOneCadAdapter";

function makeJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("MotorolaPremierOneCadAdapter", () => {
  it("authenticates implicitly via API key and passes health check", async () => {
    const fetchFn = vi.fn(async () => makeJsonResponse({ ok: true }));
    const adapter = new MotorolaPremierOneCadAdapter({
      baseUrl: "https://cad.example.com/premierone/api",
      apiKey: "test-key",
      fetchFn,
    });

    const health = await adapter.healthCheck();
    expect(health.ok).toBe(true);
    expect(health.provider).toBe("motorola-premierone");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("reads incident data", async () => {
    const fetchFn = vi.fn(async () =>
      makeJsonResponse({
        incidentId: "INC-101",
        status: "OPEN",
        callType: "MEDICAL",
        location: "123 Main St",
        units: ["M12", "E8"],
      }),
    );
    const adapter = new MotorolaPremierOneCadAdapter({
      baseUrl: "https://cad.example.com/premierone/api",
      apiKey: "test-key",
      fetchFn,
    });

    const incident = await adapter.getIncident("INC-101");
    expect(incident.incidentId).toBe("INC-101");
    expect(incident.callType).toBe("MEDICAL");
    expect(incident.units).toEqual(["M12", "E8"]);
  });

  it("reads unit data and active units", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ unitId: "U-1", status: "AVAILABLE" }))
      .mockResolvedValueOnce(makeJsonResponse([{ unitId: "U-1", status: "AVAILABLE" }]));
    const adapter = new MotorolaPremierOneCadAdapter({
      baseUrl: "https://cad.example.com/premierone/api",
      apiKey: "test-key",
      fetchFn,
    });

    const unit = await adapter.getUnit("U-1");
    const activeUnits = await adapter.listActiveUnits();
    expect(unit.unitId).toBe("U-1");
    expect(activeUnits).toHaveLength(1);
  });

  it("handles timeout failures", async () => {
    const fetchFn = vi.fn(async () => {
      throw new DOMException("signal aborted", "AbortError");
    });
    const adapter = new MotorolaPremierOneCadAdapter({
      baseUrl: "https://cad.example.com/premierone/api",
      apiKey: "test-key",
      timeoutMs: 10,
      fetchFn,
    });

    await expect(adapter.getIncident("INC-TIMEOUT")).rejects.toThrow(/timeout/i);
  });

  it("handles API down/unavailable errors", async () => {
    const fetchFn = vi.fn(async () => new Response("down", { status: 503, statusText: "Down" }));
    const adapter = new MotorolaPremierOneCadAdapter({
      baseUrl: "https://cad.example.com/premierone/api",
      apiKey: "test-key",
      fetchFn,
    });

    await expect(adapter.getIncident("INC-DOWN")).rejects.toThrow(/503/i);
  });

  it("handles malformed data", async () => {
    const fetchFn = vi.fn(async () => new Response("not-json", { status: 200 }));
    const adapter = new MotorolaPremierOneCadAdapter({
      baseUrl: "https://cad.example.com/premierone/api",
      apiKey: "test-key",
      fetchFn,
    });

    await expect(adapter.getIncident("INC-BAD")).rejects.toThrow(/malformed/i);
  });

  it("blocks write operations", async () => {
    const adapter = new MotorolaPremierOneCadAdapter({
      baseUrl: "https://cad.example.com/premierone/api",
      apiKey: "test-key",
      fetchFn: vi.fn(async () => makeJsonResponse({ ok: true })),
    });

    await expect(
      adapter.createDraftUpdate({
        incidentId: "INC-1",
        summary: "test",
        fields: {},
        source: "ai",
      }),
    ).rejects.toThrow(/disabled/i);

    await expect(
      adapter.submitApprovedUpdate({
        incidentId: "INC-1",
        draftId: "DRAFT-1",
        approvedByUserId: "user-1",
      }),
    ).rejects.toThrow(/disabled/i);
  });
});
