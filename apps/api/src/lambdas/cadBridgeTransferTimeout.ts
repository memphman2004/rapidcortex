import type { ScheduledHandler } from "aws-lambda";
import { cancelIncidentTransfer, isTransferTimedOut } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { cadBridgeStore, isCadBridgeStoreConfigured } from "../cad-bridge/store.js";

export const handler: ScheduledHandler = async () => {
  if (!env.enableCadBridge || !isCadBridgeStoreConfigured()) return;
  const nowIso = new Date().toISOString();
  const pending = await cadBridgeStore.listPendingTransfers(nowIso);
  for (const incident of pending) {
    if (!isTransferTimedOut(incident, nowIso)) continue;
    const next = cancelIncidentTransfer({ incident, nowIso, timedOut: true });
    await cadBridgeStore.saveIncident(next);
  }
};
