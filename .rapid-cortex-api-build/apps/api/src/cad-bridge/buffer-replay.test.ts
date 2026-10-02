import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultCadBridgeConfig, type BufferedOutboundEvent } from "rapid-cortex-shared";
import { replayBufferedCadBridgeEvents } from "./buffer-replay.js";

const {
  listConfigs,
  getCircuitBreaker,
  putCircuitBreaker,
  listBufferedForSlot,
  deleteBuffer,
  deadLetterBuffer,
  incrementBufferAttempt,
} = vi.hoisted(() => ({
  listConfigs: vi.fn(),
  getCircuitBreaker: vi.fn(),
  putCircuitBreaker: vi.fn(),
  listBufferedForSlot: vi.fn(),
  deleteBuffer: vi.fn(),
  deadLetterBuffer: vi.fn(),
  incrementBufferAttempt: vi.fn(),
}));

const deliverStoredOutboundEvent = vi.hoisted(() => vi.fn());

vi.mock("../lib/env.js", () => ({
  env: {
    enableCadBridge: true,
    cadBridgeMock: true,
    cadWritebackEnabled: false,
  },
}));

vi.mock("./store.js", () => ({
  isCadBridgeStoreConfigured: () => true,
  cadBridgeStore: {
    listConfigs,
    getCircuitBreaker,
    putCircuitBreaker,
    listBufferedForSlot,
    deleteBuffer,
    deadLetterBuffer,
    incrementBufferAttempt,
    countBuffered: vi.fn(async () => 0),
  },
}));

vi.mock("./publisher.js", () => ({
  deliverStoredOutboundEvent,
}));

vi.mock("./metrics.js", () => ({
  emitCadBridgeMetrics: vi.fn(),
}));

function buffered(overrides: Partial<BufferedOutboundEvent> = {}): BufferedOutboundEvent {
  return {
    eventId: "evt-1",
    agencyId: "kcpd",
    destinationSlot: "CAD_B",
    rcIncidentId: "rc-1",
    eventType: "INCIDENT_UPDATED",
    outboundPayload: { IncidentNumber: "A-1", Priority: 3 },
    endpoint: "https://cad-b.example/api/v1/incidents/B-1",
    method: "PUT",
    queuedAt: "2026-09-08T12:00:00.000Z",
    attemptCount: 0,
    expiresAt: 1_800_000_000,
    ...overrides,
  };
}

describe("CAD bridge buffer replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const config = buildDefaultCadBridgeConfig("kcpd", "br-1");
    config.enabled = true;
    listConfigs.mockResolvedValue([config]);
    getCircuitBreaker.mockResolvedValue(null);
    listBufferedForSlot.mockResolvedValue([]);
    deliverStoredOutboundEvent.mockResolvedValue({ outcome: "SUCCESS", retryable: false });
  });

  it("posts the stored payload without re-translation and deletes on success", async () => {
    const event = buffered();
    listBufferedForSlot.mockImplementation(async (_agencyId: string, slot: string) =>
      slot === "CAD_B" ? [event] : [],
    );
    const stats = await replayBufferedCadBridgeEvents();
    expect(deliverStoredOutboundEvent).toHaveBeenCalledWith({
      event,
      config: expect.objectContaining({ agencyId: "kcpd" }),
    });
    expect(deleteBuffer).toHaveBeenCalledWith("kcpd", "CAD_B", event.queuedAt, event.eventId);
    expect(stats.replayed).toBe(1);
  });

  it("probes an OPEN circuit once and skips the rest of the slot on failure", async () => {
    getCircuitBreaker.mockImplementation(async (_agencyId: string, slot: string) =>
      slot === "CAD_B"
        ? { agencyId: "kcpd", cadSlot: "CAD_B", state: "OPEN", failureCount: 5, openedAt: "2026-09-08T12:00:00.000Z" }
        : null,
    );
    const first = buffered({ eventId: "evt-old" });
    const second = buffered({ eventId: "evt-new", queuedAt: "2026-09-08T12:01:00.000Z" });
    listBufferedForSlot.mockImplementation(async (_agencyId: string, slot: string, limit?: number) => {
      if (slot !== "CAD_B") return [];
      if (limit === 1) return [first];
      return [first, second];
    });
    deliverStoredOutboundEvent.mockResolvedValue({
      outcome: "FAILED",
      retryable: true,
      errorCode: "NETWORK_ERROR",
    });
    await replayBufferedCadBridgeEvents();
    expect(putCircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({ state: "HALF_OPEN" }));
    expect(deliverStoredOutboundEvent).toHaveBeenCalledTimes(1);
    expect(putCircuitBreaker).toHaveBeenCalledWith(expect.objectContaining({ state: "OPEN" }));
    expect(incrementBufferAttempt).toHaveBeenCalledWith(first, "NETWORK_ERROR");
  });

  it("dead-letters after max retries and does not block the slot", async () => {
    const event = buffered({ attemptCount: 4 });
    listBufferedForSlot.mockImplementation(async (_agencyId: string, slot: string) =>
      slot === "CAD_B" ? [event] : [],
    );
    deliverStoredOutboundEvent.mockResolvedValue({
      outcome: "FAILED",
      retryable: true,
      errorCode: "NETWORK_ERROR",
    });
    const stats = await replayBufferedCadBridgeEvents();
    expect(deadLetterBuffer).toHaveBeenCalledWith(event, "NETWORK_ERROR");
    expect(stats.deadLettered).toBe(1);
    expect(incrementBufferAttempt).not.toHaveBeenCalled();
  });
});
