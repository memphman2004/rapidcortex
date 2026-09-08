import type { ScheduledHandler } from "aws-lambda";
import { env } from "../lib/env.js";
import { cadBridgeStore, isCadBridgeStoreConfigured } from "../cad-bridge/store.js";
import { getCadBridgeAdapter } from "../cad-bridge/adapters/index.js";
import { resolveCadBridgeSecret } from "../cad-bridge/secrets.js";
import { emitCadBridgeMetrics } from "../cad-bridge/metrics.js";

/**
 * Polling fallback for CAD slots that do not expose webhooks.
 * Mock mode records connectivity only. Live poll requires CAD_WRITEBACK_ENABLED.
 */
export const handler: ScheduledHandler = async () => {
  if (!env.enableCadBridge || !isCadBridgeStoreConfigured()) return;
  const configs = await cadBridgeStore.listConfigs();
  for (const config of configs) {
    if (!config.enabled) continue;
    for (const slot of ["CAD_A", "CAD_B"] as const) {
      const slotConfig = slot === "CAD_A" ? config.cadA : config.cadB;
      if (!slotConfig.pollingIntervalSeconds || slotConfig.inboundEnabled) continue;
      const adapter = getCadBridgeAdapter(slotConfig.vendor);
      if (env.cadBridgeMock || !env.cadWritebackEnabled) {
        await emitCadBridgeMetrics({ agencyId: config.agencyId, cadSlot: slot, cadConnected: true });
        continue;
      }
      try {
        const apiKey = await resolveCadBridgeSecret(slotConfig.apiKeySecretArn, "apiKey");
        const res = await fetch(`${slotConfig.baseUrl}${adapter.getEndpoints().listIncidents}`, {
          headers: { Authorization: `Bearer ${apiKey}`, "X-RC-Bridge-Source": "RC_BRIDGE" },
          signal: AbortSignal.timeout(slotConfig.timeoutMs),
        });
        await emitCadBridgeMetrics({
          agencyId: config.agencyId,
          cadSlot: slot,
          cadConnected: res.ok,
        });
      } catch {
        await emitCadBridgeMetrics({ agencyId: config.agencyId, cadSlot: slot, cadConnected: false });
      }
    }
  }
};
