import { describe, expect, it, vi } from "vitest";
import { buildDefaultCadBridgeConfig, type CanonicalIncident } from "rapid-cortex-shared";
import { publishCadBridgeEvent } from "./publisher.js";
import { MotorolaPremierOneBridgeAdapter } from "./adapters/motorola.js";
import { cadBridgeStore } from "./store.js";

vi.mock("../lib/env.js", () => ({
  env: {
    region: "us-east-1",
    cadBridgeMock: true,
    cadWritebackEnabled: false,
  },
}));

vi.mock("./store.js", () => ({
  cadBridgeStore: {
    getCircuitBreaker: vi.fn(async () => null),
    putCircuitBreaker: vi.fn(),
    putBuffer: vi.fn(),
    countBuffered: vi.fn(async () => 0),
    incrementCircuitFailure: vi.fn(),
  },
}));

vi.mock("./metrics.js", () => ({
  emitCadBridgeMetrics: vi.fn(),
}));

vi.mock("./loop-guard.js", () => ({
  registerOutboundEvent: vi.fn(async () => "[RC-BRIDGE:1]"),
  registerOutboundFingerprint: vi.fn(),
  buildContentFingerprint: () => "abc",
}));

function incident(): CanonicalIncident {
  return {
    rcIncidentId: "rc-1",
    agencyId: "kcpd",
    owner: "CAD_A",
    cadA: { incidentId: "A-1", vendor: "MOTOROLA", lastSyncedAt: new Date().toISOString() },
    cadB: { vendor: "TYLER" },
    type: "TEST",
    priority: 3,
    status: "ACTIVE",
    location: { address: "1 Main", city: "KC", state: "MO" },
    caller: {},
    narrative: "n",
    units: [],
    comments: [],
    syncState: "PENDING_MIRROR",
    pendingConflicts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("CAD bridge publisher", () => {
  it("does not call vendor HTTP in mock mode and returns a mock partner incident id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const config = buildDefaultCadBridgeConfig("kcpd", "br-1");
    config.cadA.baseUrl = "https://cad-a.example";
    config.cadB.baseUrl = "https://cad-b.example";
    const result = await publishCadBridgeEvent({
      incident: incident(),
      eventType: "INCIDENT_CREATED",
      canonicalChanges: {},
      destinationSlot: "CAD_B",
      destinationIncidentId: undefined,
      destAdapter: new MotorolaPremierOneBridgeAdapter(),
      config,
      isNewIncident: true,
      receivedAt: new Date().toISOString(),
    });
    expect(result.outcome).toBe("SUCCESS");
    expect(result.createdIncidentId?.startsWith("MOCK-CAD_B-")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("buffers the already-built outbound payload when the destination circuit is open", async () => {
    vi.mocked(cadBridgeStore.getCircuitBreaker).mockResolvedValueOnce({
      agencyId: "kcpd",
      cadSlot: "CAD_B",
      state: "OPEN",
      failureCount: 5,
      openedAt: new Date().toISOString(),
    });
    const config = buildDefaultCadBridgeConfig("kcpd", "br-1");
    config.cadA.baseUrl = "https://cad-a.example";
    config.cadB.baseUrl = "https://cad-b.example";
    const result = await publishCadBridgeEvent({
      incident: incident(),
      eventType: "INCIDENT_CREATED",
      canonicalChanges: {},
      destinationSlot: "CAD_B",
      destinationIncidentId: undefined,
      destAdapter: new MotorolaPremierOneBridgeAdapter(),
      config,
      isNewIncident: true,
      receivedAt: new Date().toISOString(),
    });
    expect(result.outcome).toBe("BUFFERED");
    expect(cadBridgeStore.putBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: expect.stringContaining("https://cad-b.example"),
        method: "POST",
        outboundPayload: expect.any(Object),
      }),
    );
  });
});
