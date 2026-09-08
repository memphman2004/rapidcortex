import { BOT_TEMPLATE_VERSION, type BotRebuildQueueEntry } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { LexBotProvisioner, mockLexModelsPort } from "./lex-bot-provisioner.js";
import { envLexQuotaPort } from "./lex-quota.js";
import { callAssistStore } from "../store.js";
import { tenantToVoiceConfig } from "../voice-config-map.js";

const bots = new LexBotProvisioner(mockLexModelsPort(), envLexQuotaPort());

export async function enqueueBotRebuild(
  agencyId: string,
  targetTemplateVersion: string,
  reason: BotRebuildQueueEntry["reason"],
): Promise<void> {
  await callAssistStore.enqueueRebuild({
    agencyId,
    queuedAt: new Date().toISOString(),
    targetTemplateVersion,
    reason,
    status: "QUEUED",
    attempts: 0,
  });
  const config = await callAssistStore.getConfig(agencyId);
  if (config) {
    await callAssistStore.putConfig({
      ...config,
      lexBotStatus: "UPDATE_PENDING",
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function enqueueAllAgencyRebuilds(targetTemplateVersion = BOT_TEMPLATE_VERSION): Promise<number> {
  const configs = await callAssistStore.listTenantConfigs();
  let enqueued = 0;
  for (const config of configs) {
    if (!config.lexBotId || config.lexBotTemplateVersion === targetTemplateVersion) continue;
    await enqueueBotRebuild(config.agencyId, targetTemplateVersion, "TEMPLATE_UPDATE");
    enqueued += 1;
  }
  return enqueued;
}

/** EventBridge: one queued rebuild per invocation. Old aliases keep serving until this switches them. */
export async function processBotRebuildQueue(): Promise<BotRebuildQueueEntry | null> {
  const entry = await callAssistStore.dequeueNextRebuild();
  if (!entry) return null;
  const config = await callAssistStore.getConfig(entry.agencyId);
  if (!config) {
    await callAssistStore.completeRebuild(entry, "FAILED", "missing tenant config");
    return entry;
  }
  try {
    await callAssistStore.putConfig({
      ...config,
      lexBotStatus: "UPDATING",
      updatedAt: new Date().toISOString(),
    });
    const record = await bots.rebuildBot(entry.agencyId, tenantToVoiceConfig(config), env.deploymentStage || "dev");
    await callAssistStore.putLexBot(record);
    await callAssistStore.putConfig({
      ...config,
      lexBotId: record.botId,
      lexBotAliasId: record.botAliasId,
      lexBotTemplateVersion: record.templateVersion,
      lexBotStatus: "BUILT",
      updatedAt: new Date().toISOString(),
    });
    await callAssistStore.completeRebuild(entry, "COMPLETE");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await callAssistStore.completeRebuild(entry, "FAILED", message);
    await callAssistStore.putConfig({
      ...config,
      lexBotStatus: "FAILED",
      updatedAt: new Date().toISOString(),
    });
  }
  return entry;
}

export async function handler(): Promise<{ ok: true }> {
  await processBotRebuildQueue();
  return { ok: true };
}
