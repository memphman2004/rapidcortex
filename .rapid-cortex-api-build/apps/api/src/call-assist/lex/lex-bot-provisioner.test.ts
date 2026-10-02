import { describe, expect, it } from "vitest";
import { LEX_BOT_BUILD_TIMEOUT_MS, type CallAssistAgencyVoiceConfig } from "rapid-cortex-shared";
import { LexBotProvisioner, type LexModelsPort, type LexProvisionerClock } from "./lex-bot-provisioner.js";
import { LexBotQuotaExhaustedError, type LexQuotaPort } from "./lex-quota.js";

const fulton: CallAssistAgencyVoiceConfig = {
  agencyId: "fulton-county",
  agencyName: "Fulton County 911",
  agencyDisplayName: "Fulton County 911",
  agencyShortName: "Fulton County",
  agencyTypeLabel: "911 Center",
  officerLabel: "officer",
  emergencyLine: "911",
  disclosureText: "Thank you for calling Fulton County 911 non-emergency.",
  defaultLanguageCode: "en-US",
  supportedLanguages: ["en-US"],
  defaultLocale: "en_US",
  supportedLocales: ["en_US"],
};

function quota(currentBotCount: number, limit = 100): LexQuotaPort {
  return {
    getLimit: async () => limit,
    countBots: async () => currentBotCount,
  };
}

function models(overrides: Partial<LexModelsPort> = {}): LexModelsPort {
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
    ...overrides,
  };
}

describe("LexBotProvisioner", () => {
  it("blocks CreateBot when quota headroom is below 5", async () => {
    const provisioner = new LexBotProvisioner(models(), quota(95));
    await expect(provisioner.provisionBot("fulton-county", fulton, "dev")).rejects.toBeInstanceOf(
      LexBotQuotaExhaustedError,
    );
  });

  it("writes a mock bot id on successful provision", async () => {
    const provisioner = new LexBotProvisioner(models(), quota(1));
    const record = await provisioner.provisionBot("fulton-county", fulton, "dev");
    expect(record.botId).toBe("mock-RCCallAssistBot-fultoncounty-dev");
    expect(record.botAliasName).toBe("live-dev");
    expect(record.status).toBe("BUILT");
    expect(record.agencyId).toBe("fulton-county");
  });

  it("times out a hanging locale build using an injectable clock", async () => {
    let now = 0;
    const clock: LexProvisionerClock = {
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    };
    const provisioner = new LexBotProvisioner(
      models({
        async describeLocale() {
          return "Building";
        },
      }),
      quota(1),
      clock,
    );
    await expect(provisioner.provisionBot("fulton-county", fulton, "dev")).rejects.toThrow(/timed out/);
    expect(now).toBeGreaterThanOrEqual(LEX_BOT_BUILD_TIMEOUT_MS);
  });
});
