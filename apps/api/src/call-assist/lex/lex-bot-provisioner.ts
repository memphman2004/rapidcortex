import {
  BOT_TEMPLATE_VERSION,
  callAssistLexBotName,
  type CallAssistAgencyVoiceConfig,
  type CallAssistLocale,
  type LexBotRecord,
  LEX_BOT_BUILD_POLL_MS,
  LEX_BOT_BUILD_TIMEOUT_MS,
} from "rapid-cortex-shared";
import { checkLexBotQuota, type LexQuotaPort } from "./lex-quota.js";

export type LexProvisionerClock = {
  now(): number;
  sleep(ms: number): Promise<void>;
};

const defaultClock: LexProvisionerClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export type LexModelsPort = {
  createBot(input: { botName: string; agencyId: string }): Promise<{ botId: string }>;
  createLocale(input: { botId: string; locale: CallAssistLocale }): Promise<void>;
  createIntentsAndSlots(input: { botId: string; locale: CallAssistLocale }): Promise<void>;
  updateIntents(input: { botId: string; locale: CallAssistLocale }): Promise<void>;
  buildLocale(input: { botId: string; locale: CallAssistLocale }): Promise<void>;
  describeLocale(input: { botId: string; locale: CallAssistLocale }): Promise<"Building" | "Built" | "Failed">;
  createBotVersion(botId: string): Promise<string>;
  upsertAlias(input: {
    botId: string;
    aliasName: string;
    version: string;
    agencyId: string;
    stage: string;
  }): Promise<{ botAliasId: string }>;
};

export function mockLexModelsPort(): LexModelsPort {
  return {
    async createBot({ botName }) {
      return { botId: `mock-${botName}`.slice(0, 50) };
    },
    async createLocale() {},
    async createIntentsAndSlots() {},
    async updateIntents() {},
    async buildLocale() {},
    async describeLocale() {
      return "Built";
    },
    async createBotVersion() {
      return "1";
    },
    async upsertAlias({ aliasName }) {
      return { botAliasId: `mock-alias-${aliasName}`.slice(0, 50) };
    },
  };
}

export class LexBotProvisioner {
  constructor(
    private readonly models: LexModelsPort,
    private readonly quota: LexQuotaPort,
    private readonly clock: LexProvisionerClock = defaultClock,
  ) {}

  async provisionBot(
    agencyId: string,
    config: CallAssistAgencyVoiceConfig,
    stage: string,
  ): Promise<LexBotRecord> {
    await checkLexBotQuota(this.quota);
    const botName = callAssistLexBotName(agencyId, stage);
    const aliasName = `live-${stage}`;
    const bot = await this.models.createBot({ botName, agencyId });
    const locales = config.supportedLocales?.length ? config.supportedLocales : (["en_US"] as CallAssistLocale[]);
    const started = new Date(this.clock.now()).toISOString();

    for (const locale of locales) {
      await this.models.createLocale({ botId: bot.botId, locale });
      await this.models.createIntentsAndSlots({ botId: bot.botId, locale });
      await this.models.buildLocale({ botId: bot.botId, locale });
      await this.waitUntilBuilt(bot.botId, locale);
    }

    const version = await this.models.createBotVersion(bot.botId);
    const alias = await this.models.upsertAlias({
      botId: bot.botId,
      aliasName,
      version,
      agencyId,
      stage,
    });
    const now = new Date(this.clock.now()).toISOString();
    return {
      agencyId,
      locale: config.defaultLocale ?? "en_US",
      botId: bot.botId,
      botName,
      botAliasId: alias.botAliasId,
      botAliasName: aliasName,
      botVersion: version,
      templateVersion: BOT_TEMPLATE_VERSION,
      status: "BUILT",
      buildStartedAt: started,
      buildCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  async rebuildBot(agencyId: string, config: CallAssistAgencyVoiceConfig, stage: string): Promise<LexBotRecord> {
    const lexBotId = config.lexBotId;
    if (!lexBotId) throw new Error(`No lexBotId for agency ${agencyId}`);
    const locales = config.supportedLocales?.length ? config.supportedLocales : (["en_US"] as CallAssistLocale[]);
    for (const locale of locales) {
      await this.models.updateIntents({ botId: lexBotId, locale });
      await this.models.buildLocale({ botId: lexBotId, locale });
      await this.waitUntilBuilt(lexBotId, locale);
    }
    const version = await this.models.createBotVersion(lexBotId);
    const alias = await this.models.upsertAlias({
      botId: lexBotId,
      aliasName: `live-${stage}`,
      version,
      agencyId,
      stage,
    });
    const now = new Date(this.clock.now()).toISOString();
    return {
      agencyId,
      locale: config.defaultLocale ?? "en_US",
      botId: lexBotId,
      botName: config.lexBotName || callAssistLexBotName(agencyId, stage),
      botAliasId: alias.botAliasId,
      botAliasName: `live-${stage}`,
      botVersion: version,
      templateVersion: BOT_TEMPLATE_VERSION,
      status: "BUILT",
      buildCompletedAt: now,
      createdAt: config.lexBotId ? now : now,
      updatedAt: now,
    };
  }

  private async waitUntilBuilt(botId: string, locale: CallAssistLocale): Promise<void> {
    const start = this.clock.now();
    while (this.clock.now() - start < LEX_BOT_BUILD_TIMEOUT_MS) {
      const status = await this.models.describeLocale({ botId, locale });
      if (status === "Built") return;
      if (status === "Failed") {
        throw new Error(`Bot locale build failed for ${botId}/${locale}`);
      }
      await this.clock.sleep(LEX_BOT_BUILD_POLL_MS);
    }
    throw new Error(`Bot locale build timed out for ${botId}/${locale}`);
  }
}
