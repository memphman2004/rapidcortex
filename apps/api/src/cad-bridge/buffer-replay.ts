import { BUFFER_MAX_RETRY_ATTEMPTS, type BufferedOutboundEvent, type CADBridgeConfig, type CADSlot } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { emitCadBridgeMetrics } from "./metrics.js";
import { deliverStoredOutboundEvent } from "./publisher.js";
import { cadBridgeStore, isCadBridgeStoreConfigured } from "./store.js";

const SLOTS: CADSlot[] = ["CAD_A", "CAD_B"];
const MAX_PER_SLOT = 20;

export interface BufferReplayStats {
  replayed: number;
  failed: number;
  deadLettered: number;
  bufferDepth: number;
}

/**
 * Oldest-first replay of stored outbound payloads.
 * OPEN circuits get a single HALF_OPEN probe; failure skips the rest of that slot.
 */
export async function replayBufferedCadBridgeEvents(): Promise<BufferReplayStats> {
  const stats: BufferReplayStats = { replayed: 0, failed: 0, deadLettered: 0, bufferDepth: 0 };
  if (!env.enableCadBridge || !isCadBridgeStoreConfigured()) return stats;

  const configs = await cadBridgeStore.listConfigs();
  for (const config of configs) {
    if (!config.enabled) continue;
    for (const slot of SLOTS) {
      stats.bufferDepth += await replaySlot(config, slot, stats);
    }
  }

  await emitCadBridgeMetrics({ bufferDepth: stats.bufferDepth });
  return stats;
}

async function replaySlot(
  config: CADBridgeConfig,
  slot: CADSlot,
  stats: BufferReplayStats,
): Promise<number> {
  const { agencyId } = config;
  const cb = await cadBridgeStore.getCircuitBreaker(agencyId, slot);

  if (cb?.state === "OPEN") {
    await cadBridgeStore.putCircuitBreaker({
      agencyId,
      cadSlot: slot,
      state: "HALF_OPEN",
      failureCount: cb.failureCount,
      openedAt: cb.openedAt,
    });
    const [probe] = await cadBridgeStore.listBufferedForSlot(agencyId, slot, 1);
    if (!probe) return 0;
    const ok = await settleEvent(probe, config, stats);
    if (!ok) {
      await cadBridgeStore.putCircuitBreaker({
        agencyId,
        cadSlot: slot,
        state: "OPEN",
        failureCount: Math.max(cb.failureCount, 1),
        openedAt: new Date().toISOString(),
      });
    }
    return (await cadBridgeStore.listBufferedForSlot(agencyId, slot, 50)).length;
  }

  const items = await cadBridgeStore.listBufferedForSlot(agencyId, slot, MAX_PER_SLOT);
  for (const item of items) {
    const ok = await settleEvent(item, config, stats);
    if (!ok) {
      await cadBridgeStore.putCircuitBreaker({
        agencyId,
        cadSlot: slot,
        state: "OPEN",
        failureCount: 1,
        openedAt: new Date().toISOString(),
      });
      break;
    }
  }
  return (await cadBridgeStore.listBufferedForSlot(agencyId, slot, 50)).length;
}

async function settleEvent(
  event: BufferedOutboundEvent,
  config: CADBridgeConfig,
  stats: BufferReplayStats,
): Promise<boolean> {
  const result = await deliverStoredOutboundEvent({ event, config });
  if (result.outcome === "SUCCESS" || result.outcome === "SKIPPED") {
    await cadBridgeStore.deleteBuffer(event.agencyId, event.destinationSlot, event.queuedAt, event.eventId);
    stats.replayed += 1;
    await emitCadBridgeMetrics({
      agencyId: event.agencyId,
      cadSlot: event.destinationSlot,
      replaySuccess: 1,
    });
    return true;
  }

  stats.failed += 1;
  await emitCadBridgeMetrics({
    agencyId: event.agencyId,
    cadSlot: event.destinationSlot,
    replayFailed: 1,
    failedPublishCount: 1,
  });

  const attempts = event.attemptCount + 1;
  if (!result.retryable || attempts >= BUFFER_MAX_RETRY_ATTEMPTS) {
    await cadBridgeStore.deadLetterBuffer(event, result.errorCode);
    stats.deadLettered += 1;
    return true;
  }

  await cadBridgeStore.incrementBufferAttempt(event, result.errorCode);
  return false;
}
