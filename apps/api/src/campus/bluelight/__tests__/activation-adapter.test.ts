import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActivationAdapter, ActivationAdapterError } from "../activation-adapter.js";
import type { BlueLightRegistry } from "../blue-light-registry.js";
import type { BlueLightPole } from "rapid-cortex-shared";

const stubPole: BlueLightPole = {
  poleId: "BLP-001",
  campusId: "test_campus",
  label: "Student Union – North",
  location: { lat: 40.123, lng: -75.456 },
  zone: "Zone A",
  linkedCameras: [],
  status: "active",
  vendor: "code_blue",
  sipExtension: "7001",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function makeRegistry(overrides?: Partial<BlueLightRegistry>): BlueLightRegistry {
  return {
    getPoleById: vi.fn().mockResolvedValue(stubPole),
    getPolesByCampus: vi.fn().mockResolvedValue([stubPole]),
    getPoleBySipExtension: vi.fn().mockResolvedValue(stubPole),
    registerPole: vi.fn(),
    updatePoleStatus: vi.fn(),
    seedDemoData: vi.fn(),
    ...overrides,
  } as unknown as BlueLightRegistry;
}

describe("ActivationAdapter", () => {
  let adapter: ActivationAdapter;

  beforeEach(() => {
    adapter = new ActivationAdapter(makeRegistry());
  });

  it("normalizes a webhook button_press payload with poleId", async () => {
    const result = await adapter.normalize({
      event: "button_press",
      poleId: "BLP-001",
      timestamp: "2026-11-10T12:00:00Z",
    });
    expect(result.poleId).toBe("BLP-001");
    expect(result.eventType).toBe("button_press");
    expect(result.eventId).toBeTruthy();
    expect(result.campusId).toBe("test_campus");
  });

  it("normalizes a SIP call payload via sipExtension", async () => {
    const registry = makeRegistry({
      getPoleBySipExtension: vi.fn().mockResolvedValue(stubPole),
    });
    adapter = new ActivationAdapter(registry);
    const result = await adapter.normalize({
      event: "sip_call",
      sipExtension: "7001",
      callId: "call-abc",
      timestamp: "2026-11-10T12:00:00Z",
    });
    expect(result.poleId).toBe("BLP-001");
    expect(result.eventType).toBe("sip_call");
    expect(result.callId).toBe("call-abc");
  });

  it("throws POLE_NOT_FOUND when webhook poleId is unknown", async () => {
    const registry = makeRegistry({
      getPoleById: vi.fn().mockResolvedValue(null),
    });
    adapter = new ActivationAdapter(registry);
    await expect(
      adapter.normalize({
        event: "button_press",
        poleId: "BLP-UNKNOWN",
        timestamp: "2026-11-10T12:00:00Z",
      }),
    ).rejects.toThrow(ActivationAdapterError);
  });

  it("throws SIP_EXTENSION_NOT_MAPPED when sipExtension is unknown", async () => {
    const registry = makeRegistry({
      getPoleBySipExtension: vi.fn().mockResolvedValue(null),
    });
    adapter = new ActivationAdapter(registry);
    await expect(
      adapter.normalize({
        event: "sip_call",
        sipExtension: "9999",
        callId: "call-xyz",
        timestamp: "2026-11-10T12:00:00Z",
      }),
    ).rejects.toThrow(ActivationAdapterError);
  });
});
